var       _ = require('underscore');
var util    = require('./util.js');
var codegen = require('escodegen');
var eschrjs = require('./eschrjs.js');
var fs      = require('fs');
var path    = require('path');
var assert  = require('assert');

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
		return {
		    type:   'NewExpression',
		    callee: chrThing('VarRest'),
		    arguments: [
			{
			    type:  'Literal',
			    value: expr.key.name,
			    raw:   "'"+expr.key.name+"'"
			}
		    ]
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
		callee: chrThing('VarRest'),
		arguments: [
		    {
			type:  'Literal',
			value: expr.id.name,
			raw:   "'"+expr.id.name+"'"
		    }
		]
	    };
	case 'MemberExpression':
	    expr        = _.clone(expr);
	    expr.object = tfmItemMatch(expr.object);
	    return expr;
	case 'Literal':
	    return expr;
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
	case '-':
	    return {
		type:   'NewExpression',
		callee: chrThing('ItemDelete'),
		arguments: [tfmItemMatch(item.expr)
			    // +++ `rank`
			   ]
	    };
	case 'M':
	    return {
		type:   'NewExpression',
		callee: chrThing('ItemMatch'),  
		arguments: [tfmItemMatch(item.expr)
			    // +++ `rank`
			   ] 
	    };
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
		arguments: [{
		    type:  'Literal',
		    value: item.expr.left.name,
		    raw:   "'"+item.expr.left.name+"'"},
			    tfmFunctionalise(item.expr) ]
	    };
	default:
	    throw new Error("not handled (yet): "+item.op);
	}
    };
    var tfmRuleStatement = function(rule) {
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
								value: './chr.js',
								raw:   '"./chr.js"'
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
			stmt = tfmRuleStatement(ss.body[i]);
			break;
		    case 'QueryStatement':
			stmt = tfmQueryStatement(ss.body[i]);
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
