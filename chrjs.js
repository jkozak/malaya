var       _ = require('underscore');
var util    = require('./util.js');
var codegen = require('escodegen');
var eschrjs = require('./eschrjs.js');
var chr     = require('./chr.js');
var fs      = require('fs');
var path    = require('path');
var assert  = require('assert');
var vm      = require('vm');

function transformToInterpreter(chrjs) {
    assert.strictEqual(chrjs.type,'Program');
    var chrThing = function(thing) {
	return {
	    type:     'MemberExpression',
	    computed: false,
	    object:   {type:'Identifier',name:'chr'},
	    property: {type:'Identifier',name:thing}
	}
    };
    var tfmItemMatch = function(expr) {
	switch (expr.type) {
	case 'ArrayExpression':
	    expr = _.clone(expr);
	    for (var i in expr.elements) 
		expr.elements[i] = tfmItemMatch(expr.elements[i]);
	    return expr;
	case 'ObjectExpression':
	    expr = _.clone(expr);
	    for (var i in expr.properties) 
		expr.properties[i] = tfmItemMatch(expr.properties[i]);
	    return expr;
	case 'Property':
	    if (expr.kind==='bindRest') {
		if (expr.value.type!=='Identifier')
		    throw new Error("only bindRest to arbitrary expr in compiler");
		return {
		    type: 'Property',
		    kind: 'init',
		    key:  {type:'Literal',value:'',raw:"''"},
		    value: {
			type:   'NewExpression',
			callee: chrThing('VariableRest'),
			arguments: [
			    {
				type:  'Literal',
				value: expr.value.name,
				raw:   "'"+expr.value.name+"'"
			    }
			]
		    }
		}
	    } else if (expr.kind==='bindOne') {
		return {
		    type: 'Property',
		    kind: 'init',
		    key:  expr.key,
		    value: {
			type:   'NewExpression',
			callee: chrThing('Variable'),
			arguments: [
			    {
				type:  'Literal',
				value: expr.value.name,
				raw:   "'"+expr.value.name+"'"
			    }
			]
		    }
		}
	    } else {
		expr       = _.clone(expr);
		expr.value = tfmItemMatch(expr.value);
		return expr;
	    }
	case 'Identifier':
	    return {
		type:   'NewExpression',
		callee: chrThing('Variable'),
		arguments: [
		    {
			type:  'Literal',
			value: expr.name,
			raw:   "'"+expr.name+"'"
		    }
		]
	    };
	case 'BindRest':
	    return {
		type:   'NewExpression',
		callee: chrThing('VariableRest'),
		arguments: [
		    {
			type:  'Literal',
			value: expr.id.name,
			raw:   "'"+expr.id.name+"'"
		    }
		]
	    };
	case 'Literal':
	    return expr;
	case 'MemberExpression':
	case 'UnaryExpression':
	case 'BinaryExpression':
	case 'CallExpression':
	    return tfmFunctionalise(expr);
	default:
	    throw new Error("tfmItemMatch: not handled (yet): "+expr.type);
	    return expr;
	}
    };
    var tfmFunctionalise = function(expr) {
	var tfmItemTermExpr = function(expr) {
	    switch (expr.type) {
	    case 'Literal':
		return expr;
	    case 'Identifier':
		return {
		    type:      'CallExpression',
		    callee:    {type:    'MemberExpression',
				object:  {type:'Identifier',name:'ctx'},
				property:{type:'Identifier',name:'get'} },
		    arguments: [{type:'Literal',value:expr.name,raw:"'"+expr.name+"'"}]
		};
	    case 'MemberExpression':
		expr        = _.clone(expr);
		expr.object = tfmItemTermExpr(expr.object);
		return expr;
	    case 'UnaryExpression':
		expr          = _.clone(expr);
		expr.argument = tfmItemTermExpr(expr.argument);
		return expr;
	    case 'BinaryExpression':
		expr       = _.clone(expr);
		expr.left  = tfmItemTermExpr(expr.left);
		expr.right = tfmItemTermExpr(expr.right);
		return expr;
	    case 'CallExpression':
		expr = _.clone(expr);
		for (var i in expr.arguments) 
		    expr.arguments[i] = tfmItemTermExpr(expr.arguments[i]);
		return expr;
	    default:
		throw new Error("tfmItemTermExpr: not handled (yet): "+expr.type);
		return expr;
	    }
	};
	var expr1 = tfmItemTermExpr(expr);
	return {
	    type:      'FunctionExpression',
	    id:        null,
	    params:    [{type:'Identifier',name:'ctx'}],
	    defaults:  [],
	    body:      {
		type: 'BlockStatement',
		body: [{
		    type:     'ReturnStatement',
		    argument: expr1
		}]
	    }
	};
    }
    var tfmItem = function(item) {
	assert.strictEqual(item.type,'ItemExpression');
	switch (item.op) {
	case '+':
	    return {
		type:   'NewExpression',
		callee: chrThing('ItemAdd'),
		arguments: [tfmItemMatch(item.expr)]
	    };
	case '-': {
	    var arguments = [tfmItemMatch(item.expr)];
	    if (item.rank) 
		arguments.push(tfmFunctionalise(item.rank));
	    return {
		type:   'NewExpression',
		callee: chrThing('ItemDelete'),
		arguments: arguments
	    };
	}
	case 'M': {
	    var arguments = [tfmItemMatch(item.expr)];
	    if (item.rank)
		arguments.push(tfmFunctionalise(item.rank));
	    return {
		type:   'NewExpression',
		callee: chrThing('ItemMatch'),  
		arguments: arguments
	    };
	}
	case '=':
	    assert.strictEqual(item.expr.type,    'AssignmentExpression');
	    assert.strictEqual(item.expr.operator,'=');
	    assert.strictEqual(item.expr.left.type,'Identifier');
	    return {
		type:   'NewExpression',
		callee: chrThing('ItemBind'),
		arguments: [{
		    type:  'Literal',
		    value: item.expr.left.name,
		    raw:   "'"+item.expr.left.name+"'"},
			    tfmFunctionalise(item.expr.right) ]
	    };
	case '?':
	    return {
		type:   'NewExpression',
		callee: chrThing('ItemGuard'),
		arguments: [tfmFunctionalise(item.expr)]
	    };
	default:
	    throw new Error("not handled (yet): "+item.op);
	}
    };
    var tfmRuleStatement = function(rule) {
	assert.equal(rule.type,'RuleStatement');
	var items = [];
	rule.items.forEach(function(item) {
	    items.push(tfmItem(item));
	});
	return {
            type:       'ExpressionStatement',
            expression: {
		type:   'CallExpression',
		callee: {
		    type: 'MemberExpression',
		    computed: false,
		    object:   {type:'Identifier',name:'store'},
		    property: {type:'Identifier',name:'_add_rule'}
		},
		arguments: [
		    {
			type:      'NewExpression',
			callee:    chrThing('Rule'),
			arguments: [{
			    type: 'ArrayExpression',
			    elements: items
			}]
		    }
		]
	    }
	};
    };
    var tfmQueryStatement = function(query) {
	throw new Error('NYI');
    };
    for (var i in chrjs.body) {
	if (chrjs.body[i].type==='StoreDeclaration') {
	    var ss = chrjs.body[i];
	    // +++
	    if (ss.id) {
		var reqChr = path.resolve(__dirname,'./chr.js');
		ss.type         = 'VariableDeclaration';
		ss.kind         = 'var'; // ??? maybe `const`? ???
		ss.declarations = [
		    {
			type: 'VariableDeclarator',
			id:    ss.id,
			init:  {
			    type:   'CallExpression',
			    callee: {
				type: 'FunctionExpression',
				id:   null,
				params:   [],
				defaults: [],
				body:    {
				    type: 'BlockStatement',
				    body: [
					{
					    type:         'VariableDeclaration',
					    kind:         'var',
					    declarations: [
						{
						    type: 'VariableDeclarator',
						    id:    {type:'Identifier',name:'chr'},
						    init: {
							type:   'CallExpression',
							callee: {
							    type: 'Identifier',
							    name: 'require'
							},
							arguments: [
							    {
								type:  'Literal',
								value: reqChr,
								raw:   "'"+reqChr+"'"
							    }
							]
						    }
						},
						{
						    type: 'VariableDeclarator',
						    id:    {type:'Identifier',name:'store'},
						    init: {
							type:   'NewExpression',
							callee: chrThing('Store'),
							arguments: []
						    }
						}
					    ]
					},
					// store setup is poked in here below
					{
					    type:     'ReturnStatement',
					    argument: {type:'Identifier',name:'store'}
					}
				    ]
				}
			    },
			    arguments: []
			}
		    }
		];
		for (var j in ss.body) {
		    var stmt;
		    switch (ss.body[j].type) {
		    case 'ArrayExpression':
		    case 'ObjectExpression':
			stmt = {
                            type:       'ExpressionStatement',
                            expression: {
				type: 'CallExpression',
				callee: {
				    type: 'MemberExpression',
				    computed: false,
				    object:   {type:'Identifier',name:'store'},
				    property: {type:'Identifier',name:'_add'}
				},
				arguments: [ss.body[j]]
			    }
			};
			break;
		    case 'RuleStatement': 
			stmt = tfmRuleStatement(ss.body[j]);
			break;
		    case 'QueryStatement':
			stmt = tfmQueryStatement(ss.body[j]);
			break;
		    default:
			throw new Error("not handled (yet): "+ss.body[j].type);
		    }
		    ss.declarations[0].init.callee.body.body.splice(-1,0,stmt);
		}
	    }
	    else
		throw new Error('NYI');
	}
    }
    return chrjs;
}

function transform(chrjs) {
    return transformToInterpreter(chrjs);
}

require.extensions['.chrjs'] = function(module,filename) {
    var content = fs.readFileSync(filename,'utf8');
    module._compile(codegen.generate(transform(eschrjs.parse(content))),filename);
};

if (util.env==='test') {
    exports._private = {
	compile: function(script) {
            return codegen.generate(transform(eschrjs.parse(script)));
        },
	parse: function(script) {
	    return eschrjs.parse(script,{range:true,loc:true});
	} };
}
