// compiler-based CHR for JS
// optimisations presume 'tab' format: [<table>,{<column>:<value>,...},...] is used.
//
//N.B. this file parses itself: top-level functions whose names start with
//     the value of `template_marker` are extracted and stashed away for
//     later editing and re-emission.  They are not directly run.

"use strict";

var  recast = require('recast');
var      fs = require('fs');
var eschrjs = require('./eschrjs.js');
var  assert = require('assert');
var    util = require('./util.js');
var       _ = require('underscore');

var templates       = {};
var template_marker = 'TEMPLATE_';

function TEMPLATE_store() {
    (function() {
	var     _ = require('underscore');
	var     t = 1;		// must be > 0 always?
	var facts = {};		// t -> fact; this is the main fact store
	var  adds = [];
	var  dels = [];
	var  news = [];
	var   err = null;
	var  _add = function(fact) {
	    if (fact instanceof Array && fact.length>0) {
		switch (fact[0]) {
		case INSERT_CASE:
		    break;
		}
		INSERT_GENERIC_MATCHES;
	    } else
		return {err:"unloved fact format: "+JSON.stringify(fact)};
	};
	var obj =  Object.freeze({
	    get: function(t) {return facts[t];},
	    add: function(fact) {
		news.push(fact);
		while (news.length>0) {
		    _add(news.shift());
		    if (err)
			return {err:err};
		}
		return {err:err,adds:adds,dels:dels};
	    },
	    get t()       {return t;},
	    get queries() {return queries;},
	    reset: function(){facts={};init();}
	});

	// `rules` is an array [[variant,...],...]
	INSERT_RULES;		

	// `queries` is an object {name:query,...}
	INSERT_QUERIES;

	// initial store contents
	INSERT_INIT;
	init();
	
	return obj;
    })();
}

// to be embedded in store above, whence `adds`, `dels` &c
function TEMPLATE_rule() {	
    var INSERT_NAME = function (t_fact) {
	var    fact;
	var addenda = [];
	var delenda = [];
	var in_play = {};

	INSERT_MATCH;  // all the term matches, then the addenda and delenda

	delenda.forEach(function(d) {
	    //INSERT_DEL_INDEX;
	    delete facts[d];
	    dels.push(d);
	});
	addenda.forEach(function(a){
	    //INSERT_ADD_INDEX;
	    news.push(a);
	    adds.push(a);
	});
	
    };
}

function TEMPLATE_query() {	// to be embedded in store above, whence `adds`, `dels` &c
    var INSERT_NAME = function () {
	var       fact;
	var INSERT_ANS = INSERT_INIT; // `INSERT_ANS` is replaced with `accum`
	var    in_play = {};

	INSERT_MATCH;
	{
	    INSERT_ANS = INSERT_FOLD(INSERT_ANS);
	}

	return INSERT_ANS;
    };
}

function TEMPLATE_scan_store() {
    for (var INSERT_NAME=0;INSERT_NAME<facts.length;INSERT_NAME++) {
	if (!in_play[INSERT_NAME]) {
	    in_play[INSERT_NAME] = true;
	    INSERT_REST;
	}
    }
}

var autoparse = recast.parse(fs.readFileSync(__filename),{esprima:require('esprima')});
for (var i in autoparse.program.body) {
    var x = autoparse.program.body[i];
    if (x.type==='FunctionDeclaration' && x.id.name.indexOf(template_marker)===0) {
	//console.log("*** %s: %j",x.id.name,x);
	templates[x.id.name.substr(template_marker.length)] = x.body;
    }
}

//console.log("autoparse: %j",autoparse);
//console.log("templates.rule: %j",templates.rule);

//recast.parse("test/bl/match.chrjs",{esprima:eschrjs});

function exprContainsVariable(expr) {
    return exprGetFreeVariables(expr).length!=0;
}
function exprGetFreeVariables(expr) {
    switch (expr.type) {
    case 'Identifier':
	return [expr.name];
    case 'BreakStatement':
    case 'Literal':
	return [];
    case 'UnaryExpression':
	return exprGetFreeVariables(expr.argument);
    case 'LogicalExpression':
    case 'BinaryExpression':
	return _.union(exprGetFreeVariables(expr.left),exprGetFreeVariables(expr.right));
    case 'SwitchStatement': {
	var ans = exprGetFreeVariables(expr.discriminant);
	for (var i in expr.cases) {
	    assert(expr.cases[i].type=='SwitchCase');
	    if (expr.cases[i].test!==null)
		ans = _.union(ans,exprGetFreeVariables(expr.cases[i].test));
	    for (var j in expr.cases[i].consequent)
		ans = _.union(ans,exprGetFreeVariables(expr.cases[i].consequent[j]));
	}
	return ans;
    }
    case 'WhileStatement': 
	return _.union(exprGetFreeVariables(expr.test),
		       exprGetFreeVariables(expr.body) );
    case 'ArrayExpression': {
	var ans = [];
	for (var i in expr.elements) 
	    ans = _.union(ans,exprGetFreeVariables(expr.elements[i]));
	return ans;
    }
    case 'ObjectExpression': {
	var ans = [];
	for (var i in expr.properties) {
	    if (expr.properties[i].kind=='init') {
		ans = _.union(ans,exprGetFreeVariables(expr.properties[i].value));
	    }
	}
	return ans;
    }
    case 'NewExpression':	
    case 'CallExpression': {
	var ans = [];
	if (expr.callee.type==='FunctionExpression') // don't record function names as free vars
	    ans = exprGetFreeVariables(expr.callee);
	for (var i in expr.arguments)
	    ans = _.union(ans,exprGetFreeVariables(expr.arguments[i]))
	return ans;
    }
    case 'FunctionExpression': {
	var params = _.map(expr.params,function(e){return e.name;});
	var    all = [];
	for (var i in expr.body.body)
	    all = _.union(all,exprGetFreeVariables(expr.body.body[i]));
	return _.difference(all,params);
    }
    case 'ReturnStatement':
	return exprGetFreeVariables(expr.argument);
    case 'ConditionalExpression':
	return _.union(exprGetFreeVariables(expr.test),
		       exprGetFreeVariables(expr.consequent),
		       exprGetFreeVariables(expr.alternate) );
    case 'ExpressionStatement':
	return exprGetFreeVariables(expr.expression);
    case 'Program':
    case 'StoreDeclaration':
    case 'BlockStatement': {
	var ans = [];
	for (var i in expr.body)
	    ans = _.union(ans,exprGetFreeVariables(expr.body[i]))
	return ans;
    }
    case 'VariableDeclaration': {
	var ans = [];
	for (var i in expr.declarations)
	    ans = _.union(ans,exprGetFreeVariables(expr.declarations[i]));
	return ans;
    }
    case 'VariableDeclarator': 
	return expr.init!==null ? exprGetFreeVariables(expr.init) : [];
    case 'AssignmentExpression':
	return exprGetFreeVariables(expr.right);
    case 'MemberExpression':
	return exprGetFreeVariables(expr.object);
    case 'IfStatement': 
	return _.union(exprGetFreeVariables(expr.test),
		       exprGetFreeVariables(expr.consequent),
		       expr.alternate!==null ? exprGetFreeVariables(expr.alternate) : [] );
    case 'RuleStatement': {
	var ans = [];
	for (var i in expr.items)
	    ans = _.union(ans,exprGetFreeVariables(expr.items[i]));
	return ans;
    }
    case 'ItemExpression': {
	var ans = exprGetFreeVariables(expr.expr);
	if (expr.rank!==null)
	    ans = _.union(ans,exprGetFreeVariables(expr.rank));
	return ans;
    }
    default:
	throw new Error(util.format("NYI: %j",expr));
    }
}

function exprGetVariablesWithBindingSites(expr) {
    switch (expr.type) {
    case 'ArrayExpression': {
	var ans = [];
	for (var i in expr.elements) {
	    if (expr.elements[i].type==='Identifier')
		ans.push(expr.elements[i].name);
	    else
		ans = _.union(ans,exprGetVariablesWithBindingSites(expr.elements[i]));
	}
	return ans;
    }
    case 'ObjectExpression': {
	var ans = [];
	for (var i in expr.properties) {
	    switch (expr.properties[i].kind) {
	    case 'bindOne':
	    case 'bindRest':
		ans.push(expr.properties[i].value.name);
		break;
	    case 'init':
		ans = _.union(ans,exprGetVariablesWithBindingSites(expr.properties[i].value));
		break;
	    default:
		throw new Error('SNO');
	    }
	}
	return ans;
    }
    case 'AssignmentExpression':
	return [expr.left.name];
    case 'BindRest':
	return [expr.id.name];
    case 'RuleStatement': {
	var ans = [];
	for (var i in expr.items)
	    ans = _.union(ans,exprGetVariablesWithBindingSites(expr.items[i]));
	return ans;
    }
    case 'ItemExpression': {
	var ans = exprGetVariablesWithBindingSites(expr.expr);
	if (expr.rank!==null)
	    ans = _.union(ans,exprGetVariablesWithBindingSites(expr.rank));
	return ans;
    }
    case 'Literal':
    case 'Identifier':
	return [];
    case 'StoreDeclaration': {
	var ans = [];
	for (var i in expr.body)
	    if (expr.body[i].type==='RuleStatement')
		ans = _.union(ans,exprGetVariablesWithBindingSites(expr.body[i]))
	return ans;
    }
    default:
	return [];
    }
}

function deepClone(json) {
    return JSON.parse(JSON.stringify(json)); // lazy, very
}

function Ref(obj,path) {	// a location in a JSON structure
    this.obj  = obj;
    this.path = path;
}
Ref.prototype.get = function() {
    var  obj = this.obj;
    var path = this.path;
    for (var i in path) 
	obj = obj[path[i]];
    return obj;
};
Ref.prototype.set = function(v) {
    var  obj = this.obj;
    var path = this.path;
    for (var i in path) {
	if (i==path.length-1)
	    obj[path[i]] = v;
	else
	    obj = obj[path[i]];
    }
};
Ref.prototype.cut = function() {
    var  obj = this.obj;
    var path = this.path;
    var  ans;
    for (var i in path) {
	if (i==path.length-1) {
	    ans = obj[path[path.length-1]];
	    if (obj instanceof Array) {
		obj.splice(path[path.length-1],1);
	    }
	    else if (obj instanceof Object)
		delete obj[path[i]];
	    else
		throw new Error('SNO');
	} else
	    obj = obj[path[i]];
    }
    return ans;
};
Ref.prototype.insertAfter = function(v) {
    var  obj = this.obj;
    var path = this.path;
    for (var i in path) {
	if (i==path.length-1) {
	    assert.equal(typeof path[i],'number'); // must be a list
	    obj.splice(path[i]+1,0,v);
	}
	else
	    obj = obj[path[i]];
    }
};
Ref.prototype.next = function() {
    var  obj = this.obj;
    var path = this.path;
    assert.equal(typeof path[path.length-1],'number');
    path.push(path.pop()+1);
};
Ref.prototype.previous = function() {
    var  obj = this.obj;
    var path = this.path;
    assert.equal(typeof path[path.length-1],'number');
    path.push(path.pop()-1);
};
Ref.flatAt = function(obj,fn) {
    assert(obj instanceof Array);
    for (var i=0;i<obj.length;i++) {
	if (fn(obj[i])) 
	    return new Ref(obj,[i]);
    }
    throw new Error("not found");
};

var b        = recast.types.builders;
var bProp    = function(bobj,prop) {return b.memberExpression(bobj,b.identifier(prop),false)};
var bIsEqual = bProp(b.identifier('_'),'isEqual');

function genEqual(p,q) {
    if (p.type=='Literal' || q.type=='Literal')
	return b.binaryExpression('===',p,q);
    else
	return b.callExpression(bIsEqual,[p,q]);
}

function genAccessor(x,path) {
    if (path.length===0)
	return x;
    else if ((typeof path[0])==='string')
	return genAccessor(b.memberExpression(x,b.identifier(path[0]),false),path.slice(1));
    else if ((typeof path[0])==='number')
	return genAccessor(b.memberExpression(x,b.literal(path[0]),true),path.slice(1));
    else
	throw new Error(util.format("SNO: %j",path));
}

function genMatch(term,vars,genRest,bIdFact) { // genRest() >> [stmt,...]; returns BlockStatement

    bIdFact = bIdFact || b.identifier('fact');
    
    var    bools = [];
    var    binds = {};
    var    visit = function(term,path) { // generates boolean terms to && together
	switch (term.type) {
	case 'ObjectExpression': {
	    var non_rests = [];
	    var     rest  = null;
	    for (var p in term.properties) {
		var prop = term.properties[p];
		if (prop.kind==='bindRest') {
		    if (rest!==null)
			throw new Error("only one ... allowed");
		    rest = prop;
		} else
		    non_rests.push(prop);
	    }
	    if (rest!==null)
		rest._leave_names = _.map(non_rests,function(p){return p.key.name;});
	    for (var p in term.properties) {
		var prop = term.properties[p];
		var name = prop.key==='' ? prop.value.name : prop.key.name;
		visit(prop,path.concat(name));
	    }
	    break;
	}
	case 'ArrayExpression': {
	    for (var i=0;i<term.elements.length;i++) {
		if (i!=term.elements.length-1       &&
		    term.elements[i].type==='BindRest') { // not in final position +++ handle this +++
		    term.elements[i]._leave_count = term.elements.length-i-1;
		}
		visit(term.elements[i],path.concat(i));
	    }
	    break;
	}
	case 'Literal':
	    bools.push(genEqual(term,genAccessor(bIdFact,path)));
	    break;
	case 'BindRest':
	    if (path.length===0)
		throw new Error("ellipsis operator not valid here");
	    var    acc  = genAccessor(bIdFact,path.slice(0,path.length-1));
	    var sl_args = !term._leave_count ? [b.literal(path[path.length-1])] : [
		b.literal(path[path.length-1]),
		b.binaryExpression('-',bProp(acc,'length'),b.literal(term._leave_count)) ];
	    var sliced  = b.callExpression(bProp(acc,'slice'),sl_args)
	    if (vars[term.id.name].bound) {
		bools.push(genEqual(term,sliced));
	    } else {
		binds[term.id.name] = sliced;
		vars[term.id.name].bound = true;
	    }
	    break;
	case 'Identifier':
	    if (vars[term.name].bound) {
		bools.push(genEqual(term,genAccessor(bIdFact,path)));
	    } else {
		binds[term.name]      = genAccessor(bIdFact,path);
		vars[term.name].bound = true;
	    }
	    break;
	case 'Property': {
	    switch (term.kind) {
	    case 'bindOne':
		if (vars[term.value.name].bound) {
		    bools.push(genEqual(b.identifier(term.value.name),genAccessor(bIdFact,path)));
		} else {
		    binds[term.value.name]      = genAccessor(bIdFact,path);
		    vars[term.value.name].bound = true;
		}
		break;
	    case 'init':
		bools.push(genEqual(term.value,genAccessor(bIdFact,path)));
		break;
	    case 'bindRest':
		if (path.length===0)
		    throw new Error("ellipsis operator not valid here");
		var bRest = b.callExpression(bProp(b.identifier('_'),'omit'),
					     [genAccessor(bIdFact,path.slice(0,path.length-1))].concat(
						 _.map(term._leave_names,
						       function(n){return b.literal(n);} ) ) );
		//console.log("*** bR vars: %j  term: %j",vars,term);
		if (vars[term.value.name].bound) {
		    bools.push(genEqual(b.identifier(term.value.name),bRest));
		} else {
		    binds[term.value.name]      = bRest;
		    vars[term.value.name].bound = true;
		}
		break;
	    default:
		throw new Error('SNO '+term.kind);
	    }
	    break;
	}
	default:
	    throw new Error(util.format('NYI: %j %j',term.type,term));
	}
    };
    visit(term,[]);

    var stmt = b.blockStatement(genRest());
    for (var p in binds) 
	stmt.body.unshift(b.expressionStatement(b.assignmentExpression('=',b.identifier(p),binds[p])));
    if (bools.length>0) {
	var test = bools.pop();
	while (bools.length>0) {
	    var test1 = bools.pop();
	    test = b.logicalExpression('&&',test,test1);
	}
	stmt = b.blockStatement([b.ifStatement(test,stmt,null)]);
    }
    return stmt;
}

function generateJS(js) {
    // +++ allow for malaya code referencing top-level JS vars +++
    
    assert.equal(js.type,'Program');
    
    var genRuleVariant = function(chr,i) {
	var bIdFact = b.identifier('fact')
	var genItem = function(item_id,fixed_item,next) { // >> [Statement,...]
	    var    js;
	    var next1 = (item_id<chr.items.length-1) ?
		function(){return genItem(item_id+1,fixed_item,next)} : next;
	    var   js1;
	    switch (chr.items[item_id].op) {
	    case '-':
	    case 'M':
		js1 = [genMatch(chr.items[item_id].expr,vars,next1,bIdFact)];
		break;
	    case '?':
		js1 = [b.ifStatement(chr.items[item_id].expr,b.blockStatement(next1()),null)];
		break;
	    case '=': {
		var n = next1();
		console.log("*** = %j %s",n,next1);
		js1 = [b.expressionStatement(chr.items[item_id].expr)].concat(n)
		break;
	    }
	    case '+':
		js1 = [b.expressionStatement(b.identifier('WRITE_ME'))];
		break;
	    default:
		throw new Error('NYI: '+chr.items[item_id].op);
	    }
	    if (item_id==fixed_item) { // fixed assignment to `t_fact`
		js = b.expressionStatement(b.assignmentExpression('=',
								  bIdFact,
								  b.memberExpression(b.identifier('facts'),
										     b.identifier('t_fact'),
										     true) ));
		js = [js].concat(js1);
	    } else {
		var v = 't'+item_id;
		js = b.forStatement(b.variableDeclaration('var',[b.variableDeclarator(b.identifier(v),
										      b.literal(0) ) ]),
				    b.binaryExpression('<',
						       b.identifier(v),
						       b.memberExpression(b.identifier('facts'),
									  b.identifier('length'),
									  false) ),
				    b.updateExpression('++',b.identifier(v),false),
				    b.blockStatement(js1));
		js = [js];
	    }
	    return js;
	};
	assert.strictEqual(templates['rule'].body.length,1);
	var    js = deepClone(templates['rule'].body[0].declarations[0].init);
	
	var frees = exprGetFreeVariables(chr);
	var binds = exprGetVariablesWithBindingSites(chr);
	var  vars = {};
	binds.forEach(function(n){vars[n] = {bound:false};});
	if (_.difference(frees,binds).length>0)
	    throw new Error(util.format("cannot be assigned values: %j",_.difference(frees,binds)));

	var js1 = genItem(0,i,function(){return [b.returnStatement(null)]});
	console.log("*** "+recast.print(b.blockStatement(js1)).code);
	// +++ insert `js1` into function template +++
	
	return js;
    };
    
    var genQuery = function(chr,id) {
	var js = deepClone(templates['query']);
	// +++ insert parameters per query statement +++
	// +++ ensure no adds or deletes +++
	return genRuleVariant(chr,null);
    };
    
    var genStore = function(storeCHR) {
	// generate a JS `function` to implement a CHRJS `store`
	var findTag = function(t) {
	    return Ref.flatAt(storeJS.callee.body.body,
			      function(x){return x.type==='ExpressionStatement' && x.expression.name===t} );
	};
	assert(['StoreDeclaration','StoreExpression'].indexOf(storeCHR.type)!=-1);
	assert(templates['store'].type=='BlockStatement' && templates['store'].body.length===1);
	assert(templates['store'].body[0].type=='ExpressionStatement');

	var storeJS = deepClone(templates['store'].body[0].expression);
	var    code = {rules:[],queries:{},inits:[]};

	var dispatchBranches = {};                    // used to build the `_add` function below 
	var  dispatchGeneric = [];
	var     noteDispatch = function(item,r,i) {
	    if (item.type==='ArrayExpression' && item.elements.length>0 && item.elements[0].type=='Literal') {
		assert.equal(typeof item.elements[0].value,'string'); // +++ think about numbers here +++
		if (dispatchBranches[item.elements[0].value]===undefined)
		    dispatchBranches[item.elements[0].value] = [[r,i]];
		else
		    dispatchBranches[item.elements[0].value].push([r,i]);
	    } else
		dispatchGeneric.push([r,i]);
	}

	for (var i=0,r=0;i<storeCHR.body.length;i++) {
	    switch (storeCHR.body[i].type) {
	    case 'RuleStatement': {
		var variants = [];
		var      chr = storeCHR.body[i];
		for (var j=0;j<chr.items.length;j++) {
		    if (chr.items[j].op=='-' || chr.items[j].op=='M') {
			noteDispatch(chr.items[j].expr,r,j);
			variants.push(genRuleVariant(chr,j));
		    }
		}
		code.rules.push(b.arrayExpression(variants));
		r++;
		break;
	    }
	    case 'QueryStatement': {
		// +++
		//findTag('INSERT_QUERIES').insertAfter(genQuery(storeCHR.body[i],util.format("__query_%s",i)));
		code.queries[storeCHR.body[i].id.name] = genQuery(storeCHR.body[i]);
		break;
	    }
	    case 'ObjectExpression':
	    case 'ArrayExpression': {
		var init = storeCHR.body[i];
		var call = b.callExpression(bProp(b.identifier('obj'),'add'),[init]);
		code.inits.push(b.expressionStatement(call));
		break;
	    }
	    default:
		throw new Error(util.format("Unknown store content: %j",init));
	    }
	}
	
	findTag('INSERT_RULES').insertAfter(b.variableDeclaration('var',[
	    b.variableDeclarator(b.identifier('rules'),
				 b.arrayExpression(code.rules))
	] ));
	findTag('INSERT_QUERIES').insertAfter(b.variableDeclaration('var',[
	    b.variableDeclarator(b.identifier('queries'),
				 b.objectExpression(
				     _.map(_.keys(code.queries),
					   function(k) {return b.property('init',k,code.queries[k]);} ) ) )
	] ));
	findTag('INSERT_INIT').insertAfter(b.variableDeclaration('var',[
	    b.variableDeclarator(b.identifier('init'),
				 b.functionExpression(null,[],b.blockStatement(code.inits)) ) ]));
				     
	findTag('INSERT_RULES').cut();
	findTag('INSERT_QUERIES').cut();
	findTag('INSERT_INIT').cut();

	var genInvokeRuleItem = function(ri) {
	    return b.expressionStatement(b.callExpression(
		b.memberExpression(b.memberExpression(b.identifier('rules'),
						      b.literal(ri[0]),
						      true),
				   b.literal(ri[1]),
				   true),
		[b.identifier('fact')] ));
	};
	
	// +++ generate `_add` using `dispatch*` stuff above +++
	var    _addDef = Ref.flatAt(storeJS.callee.body.body,
				 function(x){return x.type==='VariableDeclaration' &&
					     x.declarations[0].id.name==='_add';}).get();
	//console.log("*** _addDef: %j",_addDef);
	if (_.keys(dispatchBranches).length>128)
	    console.log("Warning: more than 128 cases in switch statement");
	var _addSwitch = _addDef.declarations[0].init.body.body[0].consequent.body[0];
	assert.equal(_addSwitch.type,'SwitchStatement');
	assert.equal(_addSwitch.cases.length,1);
	assert.equal(_addSwitch.cases[0].test.name,'INSERT_CASE');
	_addSwitch.cases.shift(); // we have now found and extracted the case INSERT_CASE from the template
	for (var k in dispatchBranches) {
	    var brs = _.map(dispatchBranches[k],genInvokeRuleItem);
	    _addSwitch.cases.push(b.switchCase(b.literal(k),brs.concat(b.breakStatement())));
	}
	var ins_gen = _addDef.declarations[0].init.body.body[0].consequent.body;
	assert.equal(ins_gen.length,2);
	assert.equal(ins_gen[1].type,'ExpressionStatement');
	assert.equal(ins_gen[1].expression.name,'INSERT_GENERIC_MATCHES');
	ins_gen.pop();		// delete INSERT_GENERIC_MATCHES
	dispatchGeneric.forEach(function(ri){ins_gen.push(genInvokeRuleItem(ri));});
	    
	return storeJS;
    }

    for (var i in js.body) {
	if (js.body[i].type=='StoreDeclaration')
	    js.body[i] = b.variableDeclaration('var',[
		b.variableDeclarator(js.body[i].id,genStore(js.body[i])) ]);
    }

    return js;
}

exports.generateJS = generateJS;

if (util.env==='test') {
    exports._private = {
	exprContainsVariable:             exprContainsVariable,
	exprGetFreeVariables:             exprGetFreeVariables,
	exprGetVariablesWithBindingSites: exprGetVariablesWithBindingSites,
	Ref:                              Ref,
	genAccessor:                      genAccessor,
	genMatch:                         genMatch,
	generateJS:                       generateJS
    };
}
