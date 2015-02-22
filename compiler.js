// compiler-based CHR for JS
// optimisations presume 'tab' format: [<table>,{<column>:<value>,...},...] is used.
//
//N.B. this file parses itself: top-level functions whose names start with
//     the value of `template_marker` are extracted and stashed away for
//     later editing and re-emission.  They are not directly run.

"use strict";
/*eslint-disable*/

var  recast = require('recast');
var      fs = require('fs');
var  parser = require('./parser.js');
var  assert = require('assert');
var  events = require('events');
var    util = require('./util.js');
var    path = require('path');
var       _ = require('underscore');

var templates       = {};
var template_marker = 'TEMPLATE_';

var b = recast.types.builders;

function TEMPLATE_store() {
    (function() {
	var  store = this;
	var      _ = require('underscore');
	var assert = require('assert');
	var     ee = new (require('events').EventEmitter)();
	var      t = 1;	             // must be > 0 always?
	var  facts = {};	     // 't' -> fact; this is the main fact store
	var  index = {};	     // term1 -> [t,...]  where t is number not string
	var   adds = [];	     // <t>,...
	var   dels = [];	     // <t>,...
	var   refs = {};	     // <t>:<fact>,...
	var    err = null;
	var   _add = function(fact) {
	    if (fact instanceof Array && fact.length>0 && (typeof fact[0])==='string') {
		var     ti = t++;
		var t_fact = ''+ti;  // `t_fact` is a string , use ti in indices
		facts[t_fact] = fact;
		adds.push(t_fact);
		ee.emit('add',t_fact,fact); // +++ only if `debug` set +++
		if (index[fact[0]]===undefined)
		    index[fact[0]] = [];
		index[fact[0]].push(ti);
		INSERT_INDEXED_MATCHES;
		INSERT_GENERIC_MATCHES;
		return t_fact;
	    } else
		throw new Error("unloved fact format: "+JSON.stringify(fact));
	};
	var   _del = function(t) {
	    var   ti = parseInt(t);  // use this in indices
	    var    i = adds.indexOf(t);
	    var fact = facts[t];
	    ee.emit('del',t,fact);   // +++ only if `debug` set +++
	    if (i!==-1)
		adds.splice(i,1);    // here today, gone today
	    else {
		refs[t] = facts[t];
		dels.push(t);
	    }
	    index[fact[0]].splice(_.indexOf(index[fact[0]],ti,true),1);
	    delete facts[t];
	};
	var _rebuild = function() {
	    index = {};
	    for (var t in facts) {
		var fact = facts[t];
		var   ti = parseInt(t);
		if (fact instanceof Array && fact.length>0 && (typeof fact[0])==='string') {
		    if (index[fact[0]]===undefined)
			index[fact[0]] = [];
		    index[fact[0]].push(ti);
		}
	    }
	    for (var tag in index)
		index[tag].sort(function(p,q){return p-q;});
	};
	var    obj = {
	    on:   function(ev,cb) {ee.on(ev,cb);},
	    once: function(ev,cb) {ee.once(ev,cb);},
	    get:  function(t) {assert.equal(typeof t,'string');return facts[t];},
	    add:  function(fact) {
		assert.strictEqual(adds.length,0);
		assert.strictEqual(dels.length,0);
		_add(fact);
		ee.emit('fire',obj,fact,adds,dels,refs);
		var ans = {err:null,adds:adds,dels:dels,refs:refs};
		adds = [];dels = [];refs = {};
		return ans;
	    },
	    get t()       {return t;},
	    get size()    {return Object.keys(facts).length;},
	    get queries() {return queries;},
	    reset: function(){t=1;index={};facts={};init();},
	    
	    // business logic protocol
	    tag: null,
	    init: function() {
		obj.reset();
	    },
	    get_root: function() {
		return {tag:  obj.tag,
		        t:    t,
			facts:facts};
	    },
	    set_root: function(r) {
		if (r.tag!==obj.tag)
		    throw new Error("wrong tag: "+JSON.stringify(r.tag)+", expected: "+JSON.stringify(obj.tag));
		t     = r.t;
		facts = r.facts;
		_rebuild();
	    },
	    query: function(qs) {
		assert.equal(typeof qs[0],'string');
		var ans = queries[qs[0]].apply(null,qs.slice(1));
		return ans;
	    },
	    update: function(u) {
		var res = obj.add(u);
		res.adds.forEach(function(t) {res.refs[t]=facts[t];});
		return res;
	    }
	};
	if (process.env.NODE_ENV==='test')
	    obj._private = {
		get facts()   {return facts;},
		get size()    {return Object.keys(facts).length;}
	    };
	// +++ obj = Object.freeze(obj) if it's not too slow. +++

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

function TEMPLATE_indexed_matches() {
    switch (fact[0]) {
    case INSERT_CASE:
	break;
    }
}

// to be embedded in store above, whence `adds`, `dels` &c
function TEMPLATE_rule() {	
    var INSERT_NAME = function (t_fact) {
	var    fact;
	var in_play = [];

	INSERT_MATCH;  // all the term matches, then the addenda and delenda
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

	return {t:t,result:INSERT_ANS};
    };
}

function TEMPLATE_sort() {
    var SORTED = [];
    for (var T in facts) {
	fact = facts[T];
	GENMATCH;
    }
    SORTED.sort(function(p,q){return p[0]-q[0];})
    for (var S=0;S<SORTED.length;S++) {
	T    = SORTED[S][1];
	fact = facts[T];
	REST;
    }
}

//??? why isn't `sourceFileName` doing anything? ???
var autoparse = recast.parse(fs.readFileSync(__filename),{esprima:       require('esprima'),
							  sourceFileName:__filename});
for (var i in autoparse.program.body) {
    var x = autoparse.program.body[i];
    if (x.type==='FunctionDeclaration' && x.id.name.indexOf(template_marker)===0) {
	templates[x.id.name.substr(template_marker.length)] = x.body;
    }
}

function deepClone(json) {
    return JSON.parse(JSON.stringify(json)); // lazy, very
}

function annotateParse1(js) {	// poor man's attribute grammar - pass one
    var vars = null;
    var item = null;	// `op` of active item or `null`
    var stmt = null;
    js = deepClone(js);
    parser.visit(js,{
	markItemsWithId:          function(node) {
	    for (var i=0;i<node.items.length;i++)
		node.items[i].attrs.itemId = i;
	},
	doFunction:               function(path) {
	    var save = {vars:vars,stmt:stmt};
	    vars = {};
	    stmt = 'function';
	    this.traverse(path);
	    path.node.attrs.vars = vars;
	    stmt = save.stmt;;
	    vars = save.vars;
	},
	visitProgram:             function(path) {
	    vars = {};
	    stmt = 'program';
	    this.traverse(path);
	    path.node.attrs.vars = vars;
	    stmt = null;
	    vars = null;
	},
	visitFunctionDeclaration: function(path) {
	    var name = path.node.id.name;
	    if (vars[name])
		throw new util.Fail(util.format("function shadowed or overloaded: %s",name));
	    vars[name] = {declared:true,type:'function'};
	    return this.doFunction(path);
	},
	visitFunctionExpression:  function(path) {return this.doFunction(path);},
	visitVariableDeclarator:  function(path) {
	    var name = path.node.id.name;
	    this.traverse(path);
	    vars[name].declared = true;
	    vars[name].mutable  = path.parent.kind!=='const';
	    vars[name].type     = (path.node.init&&path.node.init.type==='FunctionExpression') ? 'function' : null;
	    if (!_.contains(['program','function',null],stmt)) // !!! null is for TESTING !!!
		throw new util.Fail(util.format("variable %s declared in inappropriate context %s",name,stmt));
	},
	visitRuleStatement:       function(path) {
	    this.markItemsWithId(path.node);
	    var save = {vars:vars};
	    vars = {};
	    stmt = 'rule';
	    this.traverse(path.get('items'));
	    path.node.attrs.vars = vars;
	    stmt = null;
	    vars = save.vars;
	},
	visitQueryStatement:      function(path) {
	    this.markItemsWithId(path.node);
	    var save = {vars:vars};
	    vars = {};
	    stmt = 'query';
	    this.visit(path.get('items'));
	    this.visit(path.get('args'));
	    this.visit(path.get('init'));
	    this.visit(path.get('accum'));
	    path.node.attrs.vars = vars;
	    stmt = null;
	    vars = save.vars;
	    return false;
	},
	visitSnapExpression:      function(path) {
	    this.markItemsWithId(path.node);
	    var save = {vars:vars,stmt:stmt,item:item};
	    vars = {};
	    stmt = 'snap';
	    item = null;
	    this.visit(path.get('init'));
	    this.visit(path.get('items'));
	    this.visit(path.get('accum'));
	    path.node.attrs.vars = vars;
	    vars = save.vars;
	    stmt = save.stmt;
	    item = save.item;
	    return false;
	},
	visitItemExpression:      function(path) {
	    if (stmt!=='rule' && _.contains(['+','-'],path.node.op))
		throw new util.Fail(util.format("updating store outside of rule: %j/%s",path.node,stmt));
	    this.traverse(path);
	    item = null;
	},
	visitIdentifier:          function(path) {
	    vars[path.node.name] = vars[path.node.name] || {};
	    return false;
	},
	visitMemberExpression:    function(path) {
	    if (path.node.computed)
		this.traverse(path);
	    else if (path.node.object.type==='Identifier') 
		return this.visitIdentifier(path.get('object'));
	    else if (path.node.object.type==='MemberExpression')
		return this.visitMemberExpression(path.get('object'));
	    else
		return false;
	},
	visitProperty:            function(path) { // keys may be Identifiers, don't mangle
	    var prop = path.node;
	    if (prop.value===null) 
		return false;
	    else if (prop.value.type==='Identifier') 
		return this.visitIdentifier(path.get('value'));
	    else {
		this.visit(path.get('value'));
		return false;
	    }
	},
	doCall:                   function(path) {
	    // don't track function names yet
	    if (path.node.callee.type==='FunctionExpression')
		this.traverse(path.get('callee'));
	    this.traverse(path.get('arguments'));
	},
	visitCallExpression:      function(path){return this.doCall(path);},
	visitNewExpression:       function(path){return this.doCall(path);}
    });
    return js;
}

function annotateParse2(chrjs) {	// poor man's attribute grammar - pass two
    var setBoundHereAttr = function(js,vars) {
	parser.visit(js,{
	    visitIdentifier:          function(path) {
		if (vars[path.node.name]!==undefined) {
		    if (!vars[path.node.name].bound) {
			path.node.attrs.boundHere  = true;
			vars[path.node.name].bound = true;
		    }
		}
		return false;
	    },
	    visitAssignmentExpression:function(path) {
		if (path.node.left.type!=='Identifier')
		    throw new util.Fail(util.format("bad assignment statement: %j",path.node));
		return this.visitIdentifier(path.get('left'));
	    },
	    visitSnapExpression:      function(path) {
		path.replace(annotateParse2(path.node));
		return false;
	    },
	    // don't visit sites that can't bind vars
	    visitUnaryExpression:     function(path){return false;},
	    visitBinaryExpression:    function(path){return false;},
	    visitMemberExpression:    function(path){return false;}
	});
	_.map(_.keys(vars),function(k) {
	    if (!vars[k].bound)
		throw new util.Fail(util.format("variable never bound: %s",k));
	});
    };
    chrjs = deepClone(chrjs);
    parser.visit(chrjs,{
	visitRuleStatement: function(path) {
	    //console.log("*** rule: %j",path.node);
	    setBoundHereAttr(path.node,path.node.attrs.vars);
	    return false;
	},
	visitQueryStatement:function(path) {
	    //console.log("*** query: %j",path.node);
	    setBoundHereAttr(path.node,path.node.attrs.vars);
	    return false;
	},
	visitSnapExpression:function(path) {
	    //console.log("*** snap: %j",path.node);
	    setBoundHereAttr(path.node,path.node.attrs.vars);
	    return false;
	}
    });
    return chrjs;
}

function insertCode(chrjs,replaces,opts) {
    var js = deepClone(chrjs);
    var rs = {};
    opts = opts || {};
    opts.strict = opts.strict===undefined ? true : !!opts.strict;
    parser.visit(js,{
	visitExpressionStatement: function(path) {
	    var expr = path.node.expression;
	    if (expr.type==='Identifier') {
		var m = /^INSERT_([A-Z_]+)$/.exec(expr.name);
		if (m) {
		    var r = replaces[m[1]];
		    if (r)
			path.replace(r)
		    else if (opts.strict)
			throw new Error(util.format("can't find code insertion for %s",m[1]));
		    rs[m[1]] = true;
		}
	    }
	    return false;
	},
    });
    if (opts.strict) {
	var ds = _.difference(_.keys(replaces),_.keys(rs));
	if (ds.length>0)
	    throw new Error(util.format("not replaced: %j",ds));
    }
    return js;
}

var bNoOp = b.blockStatement([]); // ??? is this the best no-op? ???

function generateJS2(chrjs) {	// `js` is an annotated parse tree
    var js = deepClone(chrjs);
    parser.visit(js,{
	visitStoreStatement: function(path) {
	    var         storeJS = deepClone(templates['store'].body[0].expression);
	    var           rules = [];
	    var         queries = [];
	    var        indexeds = [];
	    var        generics = [];
	    var           inits = [];
	    var          genAdd = function(){}; // +++
	    var  genRuleVariant = function(variant,js,chrjs,payload) {
		var addenda = [];
		var delenda = [];
		var     pl1 = b.blockStatement([payload]);
		for (var id=chrjs.items.length-1;id>=0;id--) {
		    switch (chrjs.items[id].op) {
		    case '+':
			addenda.push(id);
			break;
		    case '-':
			delenda.push(id);
		    case'M':
			// +++
			break;
		    case '=':
			// +++
			break;
		    case '?':
			// +++
			break;
		    default:
			throw new Error(util.format("unknown item: %j",chrjs.items[id]));
		    }
		    // +++ update `payload` statement by statement
		}
		delenda.forEach(function(i) {
		    var bv = b.identifier(variant===i ? 't_fact' : 't'+j);
		    pl1.push(b.expressionStatement(
			b.callExpression(b.identifier('_del'),[bv]) ));
		});
		
		addenda.forEach(function(i) {
		    pl1.push(b.expressionStatement(
			b.callExpression(b.identifier('_add'),[genAdd(chr.items[i].expr)]) ) );
		});
	    };
	    parser.visit(path.node,{
		visitRuleStatement: function(path) {
		    var ruleJS = deepClone(templates['rule'].body[0].declarations[0].init);
		    genRule(ruleJS,path.node);
		    rules.push(ruleJS);
		},
		visitQueryStatement: function(path) {
		    var queryJS = deepClone(templates['query'].body[0].declarations[0].init);
		    genRule(queryJS,path.node);
		    queries.push(queryJS,payload); // +++ payload
		}
	    });
	    parser.visit(storeJS,{ // +++ rewrite template code after move to new compiler +++
		seenSwitch:false,
		visitSwitchStatement:function(path) {
		    assert(!seenSwitch); // There Should Be Only One
		    seenSwitch = true;
		}
	    });
	    insertCode(storeJS,{
		INDEXED_MATCHES: indexeds,
		GENERIC_MATCHES: generics,
		RULES:           rules,
		QUERIES:         queries,
		INIT:            inits
	    });
	}
    });
    return js;
}

function mangle(js,vars) {
    if ((typeof js)==='string') {
	assert(js.charAt(js.length-1)!=='_'); // !!! TESTING !!!
	assert.equal(vars,undefined);
	return js+'_';
    } else {
	var doIdentifier = function(path) {
	    var id = path.node;
	    if (vars.indexOf(id.name)!==-1) {
		//console.log(new Error(util.format("*** mangling id %j",id.name)).stack);
		path.replace(b.identifier(mangle(id.name)));
	    }
	};
	js = parser.visit(js,{
	    visitIdentifier: function(path) {
		doIdentifier(path);
		return false;
	    },
	    visitProperty: function(path) {           // keys may be Identifiers, don't mangle
		//console.log("*** mangle Property: %j",path.node);
		var prop = path.node;
		if (prop.value===null) {
		    //console.log("*** mangle Property 1");
		    return false;
		} else if (prop.value.type==='Identifier') {
		    //console.log("*** mangle Property 2: %j",path.get('value').node);
		    doIdentifier(path.get('value'));
		    return false;
		}
		else {
		    //console.log("*** mangle Property 3: %j",path.get('value').node);
		    this.traverse(path.get('value'));
		}
	    },
	    visitMemberExpression: function(path) {
		var expr = path.node;
		if (expr.computed)
		    this.traverse(path);
		else {
		    doIdentifier(path.get('object'));
		    return false;
		}
	    },
	    visitSnapExpression: function(path) {
		//console.log("*** mangle SnapExpression: %j",path.node);
		if (js.type==='SnapExpression')
		    this.traverse(path);
		else		// don't descend into a snap expression
		    return false;
	    }
	});
	return [js,_.map(vars,function(x){return mangle(x);})];
    }
}
function unmangle(v) {
    assert.strictEqual(v.charAt(v.length-1),'_');
    return v.substr(v,v.length-1);
}

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
	    if (expr.properties[i].kind==='init') {
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
    case 'StoreExpression':
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
    case 'SnapExpression':
    case 'QueryStatement': {
	var ans = [];
	for (var i in expr.items)
	    ans = _.union(ans,exprGetFreeVariables(expr.items[i]));
	ans = _.union(ans,exprGetFreeVariables(expr.accum));
	ans = _.union(ans,exprGetFreeVariables(expr.init.right));
	return ans;
    }
    case 'ItemExpression': {
	var ans = exprGetFreeVariables(expr.expr);
	if (expr.rank!==null)
	    ans = _.union(ans,exprGetFreeVariables(expr.rank));
	return ans;
    }
    case 'BindRest':
	return [];
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
		ans.push(expr.properties[i].value.name);
		break;
	    case 'bindRest':
		if (expr.properties[i].value!==null)
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
	switch (expr.left.type) {
	case 'Identifier':
	    return [expr.left.name];
	case 'MemberExpression':
	    return [expr.left.object.name];
	default:
	    throw new Error('NYI');
	}
	break;
    case 'BindRest':
	if (expr.id===null)
	    return []
	else
	    return [expr.id.name];
    case 'RuleStatement': {
	var ans = [];
	for (var i in expr.items)
	    ans = _.union(ans,exprGetVariablesWithBindingSites(expr.items[i]));
	return ans;
    }
    case 'SnapExpression':
    case 'QueryStatement': {
	assert.equal(expr.init.type,     'AssignmentExpression');
	assert.equal(expr.init.operator, '=');
	assert.equal(expr.init.left.type,'Identifier');
	var ans = _.map(expr.args,function(x){return x.name;});
	for (var i in expr.items)
	    ans = _.union(ans,exprGetVariablesWithBindingSites(expr.items[i]));
	ans = _.union(ans,[expr.init.left.name]);
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
    case 'StoreExpression':
    case 'StoreDeclaration': {
	var ans = [];
	for (var i in expr.body)
	    if (expr.body[i].type==='RuleStatement')
		ans = _.union(ans,exprGetVariablesWithBindingSites(expr.body[i]))
	return ans;
    }
    case 'SnapExpression':
    default:
	return [];
    }
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

var bProp    = function(bobj,prop) {return b.memberExpression(bobj,b.identifier(prop),false)};
var bIsEqual = bProp(b.identifier('_'),'isEqual');

function genEqual(p,q) {
    if (p.type=='Literal' || q.type=='Literal')
	return b.binaryExpression('===',p,q);
    else
	return b.callExpression(bIsEqual,[p,q]);
}

function bWrapFunction(bid,bargs,fn) {
    return b.functionExpression(null,bargs,b.blockStatement([fn(b.callExpression(bid,bargs))]));
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
		if (prop.key==='' && prop.value===null) {
		    // anonymous, ignore
		} else if (prop.key==='') {
		    visit(prop,path.concat(prop.value.name));
		} else {
		    visit(prop,path.concat(prop.key.name));
		}
	    }
	    break;
	}
	case 'ArrayExpression': {
	    var   min_size = term.elements.length;
	    var rest_bound = false;
	    for (var i=0;i<term.elements.length;i++) {
		if (i!=term.elements.length-1       &&
		    term.elements[i].type==='BindRest') { // not in final position +++ handle this +++
		    term.elements[i]._leave_count = term.elements.length-i-1;
		}
		if (term.elements[i].type==='BindRest') {
		    min_size--;
		    rest_bound = true;
		}
		visit(term.elements[i],path.concat(i));
	    }
	    // gen check that enough elements are offered
	    bools.push(b.binaryExpression(rest_bound ? '>=' : '===', 
	     				  b.memberExpression(genAccessor(bIdFact,path),
							     b.identifier('length'),
							     false),
	     				  b.literal(min_size) ));
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
	    var sliced  = b.callExpression(bProp(acc,'slice'),sl_args);
	    if (term.id===null) {
		// anonymous, ignore
	    } else if (vars[term.id.name].bound) {
		bools.push(genEqual(term,sliced));
	    } else {
		binds[term.id.name]      = sliced;
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
	case 'MemberExpression': {
	    if (term.computed)
		throw new Error("NYI: computed member: %j",term);
	    var root;
	    for (root=term;root.type==='MemberExpression';root=root.object)
		;
	    if (vars[root.name]===undefined) {
		throw new Error(util.format("can't find var: %s %j\n*** %j",root.name,vars,term));
	    } else if (vars[root.name].bound) {
		bools.push(genEqual(term,genAccessor(bIdFact,path)));
	    } else if (root!==term) {
		throw new Error("can't bind to subobject");
	    } else {
		binds[term.name]      = genAccessor(bIdFact,path);
		vars[term.name].bound = true;
	    }
	    break;
	}
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
		visit(term.value,path);
		break;
	    case 'bindRest':
		if (path.length===0)
		    throw new Error("ellipsis operator not valid here");
		var bRest = b.callExpression(bProp(b.identifier('_'),'omit'),
					     [genAccessor(bIdFact,path.slice(0,path.length-1))].concat(
						 _.map(term._leave_names,
						       function(n){return b.literal(n);} ) ) );
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

function generateJS(js,what) {
    // +++ allow for malaya code referencing top-level JS vars +++
    // +++ N.B. this has implications for mangling             +++
    // +++      should mangle whole file, need to track TLVs   +++

    what = what || 'Program'
    
    var genCheckInPlay = function(jss,vt) { // >> Statement
	parser.namedTypes.Statement.assert(jss[0]); // CBB
	parser.namedTypes.Identifier.assert(vt);
	var popStmt = b.expressionStatement(b.callExpression(b.memberExpression(b.identifier('in_play'),
										b.identifier('pop'),
										false),
							     []));
	return b.ifStatement(b.binaryExpression(
	    '===',
	    b.callExpression(b.memberExpression(b.identifier('in_play'),
						b.identifier('indexOf'),
						false),
			     [vt]),
	    b.unaryExpression('-',b.literal(1)) ),
			     b.blockStatement([b.expressionStatement(
				 b.callExpression(b.memberExpression(b.identifier('in_play'),
								     b.identifier('push'),
								     false),
						  [vt]) )].concat(jss,popStmt)),
			     null);
    };

    var genForFacts = function(item,bv,body,vars) { // >> [Statement]
	if (item.rank) {
	    var        bSort = deepClone(templates['sort'].body);
	    var bvCandidates = b.identifier(bv.name+'Candidates');
	    var          bv1 = b.identifier(bv.name+'S');
	    parser.visit(bSort,{
		visitIdentifier: function(path) {
		    switch (path.node.name) {
		    case 'SORTED':
			path.replace(bvCandidates);
			break;
		    case 'T':
			path.replace(bv);
			break;
		    case 'S':
			path.replace(bv1);
			break;
		    case 'RANK':
			path.replace(item.rank);
			break;
		    }
		    this.traverse(path);
		},
		visitExpressionStatement: function(path) {
		    if (path.node.expression.type==='Identifier')
			switch (path.node.expression.name) {
			case 'GENMATCH':
			    path.replace(genMatch(item.expr,vars,function(){
				return [b.expressionStatement(
				    b.callExpression(b.memberExpression(bvCandidates,
									b.identifier('push'),
									false),
						     [b.arrayExpression([item.rank,bv])] ) )]
			    }));
			    break;
			case 'REST':
			    path.replace(body);
			    break;
			}
		    this.traverse(path);
		}
	    });
	    return bSort;
	}
	if (item.expr.type==='ArrayExpression'            &&
	    item.expr.elements.length>0                   &&
	    item.expr.elements[0].type==='Literal'        &&
	    (typeof item.expr.elements[0].value)==='string')
	{
	    var bvx = b.identifier(bv.name+'x');
	    var  bx = b.binaryExpression('+',
					 b.literal(''),
					 b.memberExpression(b.memberExpression(b.identifier('index'),
									       item.expr.elements[0],
									       true),
							    bvx,
							    true) );
	    return [b.forInStatement(b.variableDeclaration('var',[b.variableDeclarator(bvx,null)]),
				     b.memberExpression(b.identifier('index'),
							item.expr.elements[0],
							true),
				     b.blockStatement([
					 b.variableDeclaration('var',[b.variableDeclarator(bv,bx)]),
					 body]),
				    false)];
	} else {
	    return [b.forInStatement(b.variableDeclaration('var',[b.variableDeclarator(bv,null)]),
				     b.identifier('facts'),
				     body,
				     false)];
	}
    };
    
    var genAdd = function(x) {
	var bindRest = null;
	return parser.visit(deepClone(x),{
	    visitObjectExpression: function(path) {
		var bRsave = bindRest;
		bindRest = null;
		this.traverse(path);
		if (bindRest!==null) {
		    path.replace(b.callExpression(b.memberExpression(b.identifier('_'),
								     b.identifier('extend'),
								     false),
						  [b.objectExpression([]),bindRest.value,path.node]) );
		}
		bindRest = bRsave;
	    },
	    visitProperty: function(path) {
		var prop = path.node;
		if (prop.kind==='bindRest') {
		    bindRest = prop;
		    if (bindRest.value===null)
			throw new Error("anonymous ellipsis in value expression");
		    path.replace();
		}
		this.traverse(path);
	    },
	    visitArrayExpression: function(path) {
		var bRsave = bindRest;
		bindRest = null;
		this.traverse(path);
		if (bindRest!==null) {
		    var before = b.arrayExpression([]);
		    var  after = b.arrayExpression([]);
		    var   rest = null;
		    for (var i=0;i<path.node.elements.length;i++) {
			if (path.node.elements[i].type==='BindRest') 
			    rest = path.node.elements[i].id; 
			else if (rest!==null)
			    after.elements.push(path.node.elements[i]);
			else
			    before.elements.push(path.node.elements[i]);
		    }
		    var rep = b.callExpression(b.memberExpression(before,b.identifier('concat'),false),
					       [rest,after]);
		    path.replace(rep);
		}
		bindRest = bRsave;
	    },
	    visitBindRest: function(path) {
		bindRest = path.node;
		if (bindRest.id===null)
		    throw new Error("anonymous ellipsis in value expression");
		this.traverse(path);
	    },
	    visitSnapExpression: function(path) {
		var qjs = genQuery(path.node,[]); // ??? what is `args` here? ???
		throw new Error("NYI: snap");
	    }
	});
    };
    
    var genRuleVariant = function(chr,i,prebounds,genPayload) {
	var bIdFact = b.identifier('fact');
	var addenda = [];
	var delenda = [];
	var genItem = function(item_id,fixed_item,next) { // >> [Statement,...]
	    var    js;
	    var vars0 = deepClone(vars);
	    var next1 = (item_id<chr.items.length-1) ?
		function(){return genItem(item_id+1,fixed_item,next)} : next;
	    var   js1;
	    switch (chr.items[item_id].op) {
	    case '-':
		delenda.push(item_id);
		// FALLTHROUGH
	    case 'M':
		js1 = genMatch(chr.items[item_id].expr,vars,next1,bIdFact).body;
		break;
	    case '?':
		js1 = [b.ifStatement(chr.items[item_id].expr,b.blockStatement(next1()),null)];
		break;
	    case '=':
		if (chr.items[item_id].expr.left.type!=="Identifier")
		    throw new Error(util.format("can't bind to non-variable: %j",chr.items[item_id].expr.left));
		vars[chr.items[item_id].expr.left.name].bound = true;
		js1 = [b.expressionStatement(chr.items[item_id].expr)].concat(next1())
		break;
	    case '+':
		addenda.push(item_id);
		js1 = next1();
		break;
	    default:
		throw new Error('NYI: '+chr.items[item_id].op);
	    }
	    if (item_id==fixed_item) { // fixed assignment to `t_fact`
		// the new fact can have been deleted by a previous rule, allow for this
		js = [b.expressionStatement(b.assignmentExpression('=',
								   bIdFact,
								   b.memberExpression(b.identifier('facts'),
										      b.identifier('t_fact'),
										      true) )),
		      b.ifStatement(b.binaryExpression('===',bIdFact,b.identifier('undefined')),
				    b.returnStatement(null),
				    null),
		      genCheckInPlay(js1,b.identifier('t_fact'))];
	    } else if (['M','-'].indexOf(chr.items[item_id].op)!==-1) {
		var v = 't'+item_id;
		js1.unshift(b.expressionStatement(b.assignmentExpression(
		    '=',
		    bIdFact,
		    b.memberExpression(b.identifier('facts'),
				       b.identifier(v),
				       true) )));
		js = genForFacts(chr.items[item_id],b.identifier(v),genCheckInPlay(js1,b.identifier(v)),vars0);
	    } else
		js = js1;
	    return js;
	};
	assert.strictEqual(templates['rule'].body.length,1);
	var    js = deepClone(templates['rule'].body[0].declarations[0].init);
	
	var frees = exprGetFreeVariables(chr);
	var binds = exprGetVariablesWithBindingSites(chr);
	var  vars = {};
	if (_.difference(frees,binds).length>0)
	    throw new Error(util.format("cannot be assigned values: %j // %j %j",_.difference(frees,binds),frees,binds));

	if (true) {		// !!! TESTING !!!
	    if (_.difference(_.keys(chr.attrs.vars),binds).length>0 ||
		_.difference(binds,_.keys(chr.attrs.vars)).length>0 ) {
		console.log("*** free/bind: %j/%j\n=== %j",frees,binds,chr.attrs.vars)
		console.log("... %j %j",_.difference(_.keys(chr.attrs.vars),binds),_.difference(binds,_.keys(chr.attrs.vars)))
	    }
	}
	
	var mangled = mangle(chr,binds);
	chr   = mangled[0];
	binds = mangled[1];

	binds.forEach(function(n){vars[n] = {bound:false};});
	for (var pb in prebounds) { // non-empty for parametric ruley things
	    vars[prebounds[pb]].bound = true;
	}

	genPayload = genPayload || function() { // >> [Statement]
	    var payload = [];
	    if (exports.debug) {
		var vars = [];
		for (var j=0;j<chr.items.length;j++) {
		    if (['M','-'].indexOf(chr.items[j].op)!==-1) {
			vars.push(b.identifier((i===j) ? 't_fact' : 't'+j));
		    } else
			vars.push(b.literal(null));
		}
		payload.push(b.expressionStatement(
		    b.callExpression(b.memberExpression(b.identifier('ee'),
							b.identifier('emit'),
							false),
				     [b.literal('queue-rule'),b.literal(chr.id.name),b.arrayExpression(vars)] ) ));
	    }
	    delenda.forEach(function(j) {
		var bv = b.identifier(i===j ? 't_fact' : 't'+j);
		payload.push(b.expressionStatement(
		    b.callExpression(b.identifier('_del'),[bv]) ));
	    });
	    addenda.forEach(function(j) {
		payload.push(b.expressionStatement(
		    b.callExpression(b.identifier('_add'),[genAdd(chr.items[j].expr)]) ) );
	    });
	    return payload;
	};

	var js1 = genItem(0,i,genPayload);
	if (binds.length!=0) 
	    js1.unshift(b.variableDeclaration('var',
					      _.map(binds,function(v){
						  return b.variableDeclarator(b.identifier(v),null);} ) ))
	parser.visit(js,{
	    visitExpressionStatement: function(path) {
		var expr = path.node.expression;
		if (expr.type==='Identifier' && expr.name==='INSERT_MATCH') {
		    path.replace(b.blockStatement(js1));
		    return false;
		} else
		    this.traverse(path);
	    }
	});
	
	return js;
    };

    var genQuery = function(chr,args) {
	// a query is a hacked-up rule.  Do this better.
	for (var item in chr.items)
	    if (item.op=='+' || item.op=='-')
		throw new Error("query statement must not modify the store");

	var genQueryPayload = function() {
	    var payload = [];
	    payload.push(b.expressionStatement(b.assignmentExpression('=',chr.init.left,chr.accum)));
	    return payload;
	};
	var              rv = genRuleVariant(chr,
					     null, // `null` as there's no incoming fact
					     _.map(args,function(arg){return mangle(arg.name);}),
					     genQueryPayload);

	rv.params = args;
	if (exports.debug) {
	    rv.body.body.push(b.expressionStatement(
		b.callExpression(b.memberExpression(b.identifier('ee'),
						    b.identifier('emit'),
						    false),
				 [b.literal('query-done'),b.literal(chr.id.name)] ) ));
	}
	rv.body.body.push(b.returnStatement(chr.init.left));
	parser.visit(rv,{	// remove query args and accum variable from binding site decls
	    visitVariableDeclarator: function(path) {
		var decl = path.node;
		if (decl.id.name===chr.init.left.name ||
		    _.any(args,function(bId){return bId.name===decl.id.name}) )
		    path.replace();
		return false;
	    }
	});
	parser.visit(rv,{	// if we just removed all the declarators, remove the declaration
	    visitVariableDeclaration: function(path) {
		var decl = path.node;
		if (decl.declarations.length===0)
		    path.replace();
		return false;
	    }
	});
	// +++
	rv.body.body.unshift(b.variableDeclaration('var',[b.variableDeclarator(chr.init.left,chr.init.right)]));
	
	return rv;
    };
    
    var genStore = function(path) {
	var storeCHR = path.node;
	// generate a JS `function` to implement a CHRJS `store`
	var  findTag = function(t) {
	    return Ref.flatAt(storeJS.callee.body.body,
			      function(x){return x.type==='ExpressionStatement' && x.expression.name===t} );
	};
	assert(['StoreDeclaration','StoreExpression'].indexOf(storeCHR.type)!=-1);
	assert(templates['store'].type=='BlockStatement' && templates['store'].body.length===1);
	assert(templates['store'].body[0].type=='ExpressionStatement');

	var storeJS = deepClone(templates['store'].body[0].expression);
	var    code = {rules:[],queries:{},inits:[]};

	// !!! just while I rewrite the compiler !!!
	assert.deepEqual(templates['indexed_matches'].body[0].type,'SwitchStatement');
	storeJS = insertCode(storeJS,{
	    INDEXED_MATCHES:deepClone(templates['indexed_matches'].body[0])
	},
			     {strict:false});

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
			noteDispatch(chr.items[j].expr,r,variants.length);  // variants.length will be...
			variants.push(genRuleVariant(deepClone(chr),j,[])); // ...allocated now
		    }
		}
		code.rules.push(b.arrayExpression(variants));
		r++;
		break;
	    }
	    case 'QueryStatement': {
		code.queries[storeCHR.body[i].id.name] = genQuery(storeCHR.body[i],storeCHR.body[i].args);
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
	var bQueryReturn = function(bq) {
	    return b.returnStatement(b.objectExpression([b.property('init',
								    b.identifier('t'),
								    b.identifier('t') ),
							 b.property('init',
								    b.identifier('result'),
								    bq) ]));
	};
	if (_.keys(code.queries).length>0)
	    findTag('INSERT_QUERIES').insertAfter(b.variableDeclaration('var',[
		b.variableDeclarator(b.identifier('queries'),
				     b.callExpression(b.functionExpression(
					 null,
					 [],
					 b.blockStatement([
					     b.variableDeclaration('var',
								   _.map(_.keys(code.queries),
									 function(k) {
									     return b.variableDeclarator(
										 b.identifier(k),
										 code.queries[k]); } ) ),
					     b.returnStatement(b.objectExpression(
						 _.map(_.keys(code.queries),
						       function(k) {
							   return b.property(
							       'init',
							       b.identifier(k),
							       bWrapFunction(b.identifier(k),
									     code.queries[k].params,
									     bQueryReturn) ); } ) )) ]) ),
						      []) ) ]));
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
		[b.identifier('t_fact')] ));
	};
	
	var    _addDef = Ref.flatAt(storeJS.callee.body.body,
				 function(x){return x.type==='VariableDeclaration' &&
					     x.declarations[0].id.name==='_add';}).get();
	if (_.keys(dispatchBranches).length>128)
	    console.log("Warning: more than 128 cases in switch statement");
	var _addSwitch = _addDef.declarations[0].init.body.body[0].consequent.body[7];
	assert.equal(_addSwitch.type,'SwitchStatement');
	assert.equal(_addSwitch.cases.length,1);
	assert.equal(_addSwitch.cases[0].test.name,'INSERT_CASE');
	_addSwitch.cases.shift(); // we have now found and extracted the case INSERT_CASE from the template
	for (var k in dispatchBranches) {
	    var brs = _.map(dispatchBranches[k],genInvokeRuleItem);
	    _addSwitch.cases.push(b.switchCase(b.literal(k),brs.concat(b.breakStatement())));
	}
	var ins_gen = _addDef.declarations[0].init.body.body[0].consequent.body;
	assert.equal(ins_gen.length,10);
	assert.equal(ins_gen[8].type,'ExpressionStatement');
	assert.equal(ins_gen.splice(8,1)[0].expression.name,'INSERT_GENERIC_MATCHES');
	dispatchGeneric.forEach(function(ri){ins_gen.push(genInvokeRuleItem(ri));});
	    
	return storeJS;
    };

    switch (what) {
    case 'Program': {
	js = annotateParse2(annotateParse1(js)); // !!! TESTING !!!
	parser.namedTypes.Program.assert(js);
	parser.visit(js,{
	    visitStoreDeclaration: function(path) {
		if (path.node.id===null)
		    path.replace(b.expressionStatement(genStore(path)))
		else
		    path.replace(b.variableDeclaration('var',[
			b.variableDeclarator(path.node.id,genStore(path)) ]));
		return false;
	    },
	    visitStoreExpression: function(path) {
		path.replace(genStore(path))
		return false;
	    }
	});
	break;
    }
    case 'add': {
	parser.namedTypes.Expression.assert(js);
	js = genAdd(js);
	break;
    }
    default:
	throw new Error(util.format("what?!: %j",what));
    }

    return js;
}

exports.compile = generateJS;

exports.debug   = false;

var stanzas = {};		// <path> -> <stanzas>,...

exports.getStanzas = function(p) {
    if (!exports.debug)
	throw new Error("stanza building off");
    return stanzas[path.resolve(p)];
};

function setCharAt(str,index,chr) {
    if (index>str.length-1)
	return str;
    return str.substr(0,index)+chr+str.substr(index+1);
}

function compile(chr,opts) {
    var js;
    opts = opts || {ep:'Program'};
    var markup = function(chr) {
	var rule = null;
	parser.visit(chr,{
	    visitRuleStatement: function(path) {
		rule = path.node;
		this.traverse(path);
		rule = null;
	    }
	});
	throw new Error("NYI");
    };
    var finalEmit = function(chr) {
	parser.visit(chr,{
	    visitStoreStatement: function(path) {
		this.traverse(path);
		var js = deepClone(templates['store'].body[0].expression);
		parser.visit(js,{
		    visitSwitchCase: function(path) {
			if (path.node.test.type==='Identifier' && path.node.test.name==='INSERT_CASE') {
			    throw new Error("NYI"); // path.replace
			}
			return false;
		    },
		    visitIdentifier: function(path) {
			this.traverse(path);
			switch (path.node.name) {
			case 'INSERT_GENERIC_MATCHES':
			case 'INSERT_RULES':
			case 'INSERT_QUERIES':
			case 'INSERT_INIT':
			    throw new Error("NYI"); // path.replace
			}
		    }
		});
		path.replace(js);
	    },
	    visitRuleStatement: function(path) {
		throw new Error("NYI");
	    },
	    visitQueryStatement: function(path) {
		throw new Error("NYI");
	    },
	    visitItemExpression: function(path) {
		throw new Error("NYI");
	    },
	});
    };
    switch (opts.ep) {
    case 'Program':
	parser.namedTypes.Program.assert(js);
	js = finalEmit(markup(chr));
    default:
	throw new util.Fail(util.format("can't compile: %j",js));
    }
    return js;
}


function buildStanzas(code,parsed) {
    assert(code.search('\t')===-1,"code should be tab-free");
    var  lines = [""].concat(code.split('\n')); // make zero-based
    var lines1 = _.map(lines,function(s) {
	return Array(s.length).join(' ');       // initially a blank copy
    });
    var    stanzas = [];
    var    sources = {};	                // {<line>:{<column>:<source>,...},...}
    var noteSource = function(node,node1) {
	if (node1===undefined)
	    node1 = node;
	if (sources[node.loc.start.line]===undefined)
	    sources[node.loc.start.line] = {};
	sources[node.loc.start.line][node.loc.start.column] = node1;
    }

    if (parsed===undefined)
	parsed = parser.parse(code,{loc:true,attrs:true});
    var currentRule;
    parser.visit(parsed,{
	visitRuleStatement: function(path) {
	    var node = path.node;
	    for (var i=0;i<'rule'.length;i++)
		lines1[node.loc.start.line] = setCharAt(lines1[node.loc.start.line],node.loc.start.column+i,'R');
	    noteSource(node);
	    currentRule = node;
	    this.traverse(path);
	},
	visitQueryStatement: function(path) {
	    var node = path.node;
	    for (var i=0;i<'query'.length;i++)
		lines1[node.loc.start.line] = setCharAt(lines1[node.loc.start.line],node.loc.start.column+i,'Q');
	    noteSource(node);
	    currentRule = node;
	    this.traverse(path);
	}, 
	visitItemExpression: function(path) {
	    var node = path.node;
	    for (var l=node.loc.start.line;l<=node.loc.end.line;l++)
		for (var c=node.loc.start.column;c<node.loc.end.column;c++) {
		    lines1[l] = setCharAt(lines1[l],c,node.op);
		}
	    noteSource(node,currentRule);
	    this.traverse(path);
	}
    });
    
    var stanza = null;
    var    tag = null;
    for (var l=0;l<lines1.length;l++) {
	var  blank = (lines[l].search(/[^ ]/)===-1);
	var blank1 = (lines1[l].search(/[^ ]/)===-1);
	if (l>0) {
	    var m = lines[l-1].match(/ *\/\/ +([^: ]+)/);
	    if (m!=null && m[1]!=='+++')
		tag = m[1];
	}
	if (stanza===null) {
	    if (!blank1) {
		stanza = {lines:[lines1[l]],tag:tag,line:l,draws:[]}
		tag    = null;
	    }
	} else {
	    if (!blank1)
		stanza.lines.push(lines1[l]);
	    else if (blank) {
		stanzas.push(stanza);
		stanza = null;
	    }
	    else
		stanza.lines.push(''); // to keep line numbers aligned with source
	}
    }
    if (stanza!==null)
	stanzas.push(stanza);

    // run-length encoding (H and V) to build drawing instructions
    stanzas.forEach(function(stanza) {
	var addDraw = function(l,l1,c,n,ch) {
	    if (ch!=null && n>0 && stanza.lines[l][c]!=' ') {
		if (sources[stanza.line+l])
		    stanza.draws.push({node:sources[stanza.line+l][c],
				       ch:ch,
				       x:c,
				       y:l1,
				       n:n+1});
		else
		    console.warn("cqn't find draw for stanza %d line %d",stanza.line,l);
	    }
	};
	var l1 = 0;
	for (var l=0;l<stanza.lines.length;l++) {
	    var line = stanza.lines[l];
	    if (line.search(/[^ ]/)!==-1) {
		var   ch = null;
		var    c = 0;
		var    n = 0;
		l1++;
		for (var i=0;i<line.length;i++) {
		    if (ch!==line[i]) {
			addDraw(l,l1,c,n,ch);
			ch = line[i];
			c  = i;
			n  = 0;
		    }
		    else
			n++;
		}
		addDraw(l,l1,c,n,ch);
	    }
	}
    });
    
    return stanzas;
}

var ee = new events.EventEmitter();

exports.on = function(what,handler) {
    ee.on(what,handler);
};
exports.once = function(what,handler) {
    ee.once(what,handler);
};

require.extensions['.chrjs'] = function(module,filename) {
    filename = path.resolve(filename);
    var codegen = require('escodegen');
    var content = fs.readFileSync(filename,'utf8').replace(/\t/g,'        '); // remove tabs
    var   chrjs = parser.parse(content,{loc:exports.debug,attrs:true});
    if (exports.debug)
	stanzas[filename] = buildStanzas(content,chrjs); // +++ clone the parse! +++
    module._compile(codegen.generate(generateJS(chrjs)),filename);
    ee.emit('compile',filename);
};

if (util.env==='test') {
    exports._private = {
	exprContainsVariable:             exprContainsVariable,
	exprGetFreeVariables:             exprGetFreeVariables,
	exprGetVariablesWithBindingSites: exprGetVariablesWithBindingSites,
	Ref:                              Ref,
	mangle:                           mangle,
	genAccessor:                      genAccessor,
	genAdd:                           function(chrjs) {return generateJS(chrjs,'add');},
	genMatch:                         genMatch,
	buildStanzas    :                 buildStanzas,
	insertCode:                       insertCode,
	annotateParse1:                   annotateParse1,
	annotateParse2:                   annotateParse2,
	generateJS2:                      generateJS2
    };
}
