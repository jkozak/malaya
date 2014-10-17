// compiler-based CHR for JS
// optimisations presume 'tab' format: [<table>,{<column>:<value>,...},...] is used.
//
//N.B. this file parses itself: top-level functions whose names start with
//     the value of `template_marker` are extracted and stashed away for
//     later editing and re-emission.  They are not directly run.

"use strict";

var  recast = require('recast');
var      fs = require('fs');
var  parser = require('./parser.js');
var  assert = require('assert');
var    util = require('./util.js');
var       _ = require('underscore');

var templates       = {};
var template_marker = 'TEMPLATE_';

function TEMPLATE_store() {
    (function() {
	var  store = this;
	var      _ = require('underscore');
	var assert = require('assert');
	var     ee = new (require('events').EventEmitter)();
	var      t = 1;	             // must be > 0 always?
	var  facts = {};	     // 't' -> fact; this is the main fact store
	var  index = {};	     // term1 -> [t,...]  where t is number not string
	var   adds = [];
	var   dels = [];
	var    err = null;
	var   _add = function(fact) {
	    if (fact instanceof Array && fact.length>0 && (typeof fact[0])==='string') {
		var     ti = t++;
		var t_fact = ''+ti; // `t_fact` is a string , use ti in indices
		facts[t_fact] = fact;
		adds.push(t_fact);
		if (index[fact[0]]===undefined)
		    index[fact[0]] = [];
		index[fact[0]].push(ti);
		switch (fact[0]) {
		case INSERT_CASE:
		    break;
		}
		INSERT_GENERIC_MATCHES;
		return t_fact;
	    } else
		throw new Error("unloved fact format: "+JSON.stringify(fact));
	};
	var   _del = function(t) {
	    var   ti = parseInt(t);   // use this in indices
	    var    i = adds.indexOf(t);
	    var fact = facts[t];
	    if (i!==-1)
		adds.splice(i,1);
	    else
		dels.push(facts[t]);
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
		index[tag].sort();
	};
	var    obj = {
	    on:   function(ev,cb) {ee.on(ev,cb);},
	    once: function(ev,cb) {ee.once(ev,cb);},
	    get:  function(t) {assert.equal(typeof t,'string');return facts[t];},
	    add:  function(fact) {
		assert.strictEqual(adds.length,0);
		assert.strictEqual(dels.length,0);
		_add(fact);
		ee.emit('fire',obj,fact,adds,dels);
		var ans = {err:null,adds:adds,dels:dels};
		adds = [];dels = [];
		return ans;
	    },
	    get t()       {return t;},
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
		res.adds = _.map(res.adds,function(t){return facts[t];});
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

function mangle(js,vars) {
    if ((typeof js)==='string') {
	assert(js.charAt(js.length-1)!=='_'); // !!! TESTING !!!
	return js+'_';
    } else {
	var doIdentifier = function(path) {
	    var id = path.node;
	    if (vars.indexOf(id.name)!==-1)
		path.replace(b.identifier(mangle(id.name)));
	};
	js = parser.visit(js,{
	    visitIdentifier: function(path) {
		doIdentifier(path);
		return false;
	    },
	    visitProperty: function(path) {           // keys may be Identifiers, don't mangle
		var prop = path.node;
		if (prop.value.type==='Identifier') {
		    doIdentifier(path.get('value'));
		    return false;
		}
		else
		    this.traverse(path.get('value'));
	    },
	    visitMemberExpression: function(path) {
		var expr = path.node;
		doIdentifier(path.get('object'));
		if (expr.computed)
		    this.traverse(path.get('property'));
		else
		    return false;
	    }
	});
	return [js,_.map(vars,mangle)];
    }
}
function unmangle(v) {
    assert.strictEqual(v.charAt(v.length),'_');
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
	return [expr.id.name];
    case 'RuleStatement': {
	var ans = [];
	for (var i in expr.items)
	    ans = _.union(ans,exprGetVariablesWithBindingSites(expr.items[i]));
	return ans;
    }
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

function genAdd(x) {
    parser.namedTypes.Expression.assert(x);
    var bindRest = null;
    x = deepClone(x);
    parser.visit(x,{
	visitObjectExpression: function(path) {
	    var bRsave = bindRest;
	    bindRest = null;
	    this.traverse(path);
	    if (bindRest!==null) {
		path.replace(b.callExpression(b.memberExpression(b.identifier('_'),
								 b.identifier('extend'),
								 false),
					      [bindRest.value,path.node]) );
	    }
	    bindRest = bRsave;
	},
	visitProperty: function(path) {
	    // ??? what about `...{}` ???
	    var prop = path.node;
	    if (prop.kind==='bindRest') {
		bindRest = prop;
		path.replace();
	    }
	    this.traverse(path);
	}
    });
    return x;
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
    // +++ N.B. this has implications for mangling             +++
    // +++      should mangle whole file, need to track TLVs   +++
    
    assert.equal(js.type,'Program');

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
    }

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

	var mangled = mangle(chr,binds);
	chr   = mangled[0];
	binds = mangled[1];

	binds.forEach(function(n){vars[n] = {bound:false};});
	for (var pb in prebounds) { // non-empty for parametric ruley things
	    vars[prebounds[pb]].bound = true;
	}

	genPayload = genPayload || function() { // >> [Statement]
	    var payload = [];
	    delenda.forEach(function(j) {
		var bv = b.identifier(i===j ? 't_fact' : 't'+j);
		payload.push(b.expressionStatement(
		    b.callExpression(b.identifier('_del'),[bv]) ));
	    });
	    addenda.forEach(function(j) {
		payload.push(b.expressionStatement(
		    b.callExpression(b.identifier('_add'),
				     [genAdd(chr.items[j].expr)]) ) );
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

    var genQuery = function(chr) {
	// a query is a hacked-up rule.  Do this better.
	for (var item in chr.items)
	    if (item.op=='+' || item.op=='-')
		throw new Error("query statement must not modify the store");

	// `null` as there's no incoming fact
	var rv = genRuleVariant(chr,
				null,
				_.map(chr.args,function(arg){return mangle(arg.name);}),
				function() {
	    return [b.expressionStatement(b.assignmentExpression('=',chr.init.left,chr.accum))];
	});

	rv.params = chr.args;
	rv.body.body.push(b.returnStatement(b.objectExpression([b.property('init',
									   b.identifier('t'),
									   b.identifier('t') ),
								b.property('init',
									   b.identifier('result'),
									   chr.init.left) ])));
	parser.visit(rv,{	// remove query args and accum variable from binding site decls
	    visitVariableDeclarator: function(path) {
		var decl = path.node;
		if (decl.id.name===chr.init.left.name ||
		    _.any(chr.args,function(bId){return bId.name===decl.id.name}) )
		    path.replace();
		return false;
	    }
	});
	rv.body.body.unshift(b.variableDeclaration('var',[b.variableDeclarator(chr.init.left,chr.init.right)]));
	
	return rv;
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
			variants.push(genRuleVariant(deepClone(chr),j,[]));
		    }
		}
		code.rules.push(b.arrayExpression(variants));
		r++;
		break;
	    }
	    case 'QueryStatement': {
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
					   function(k) {return b.property('init',
									  b.identifier(k),
									  code.queries[k]); } ) ) )
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
		[b.identifier('t_fact')] ));
	};
	
	var    _addDef = Ref.flatAt(storeJS.callee.body.body,
				 function(x){return x.type==='VariableDeclaration' &&
					     x.declarations[0].id.name==='_add';}).get();
	if (_.keys(dispatchBranches).length>128)
	    console.log("Warning: more than 128 cases in switch statement");
	var _addSwitch = _addDef.declarations[0].init.body.body[0].consequent.body[6];
	assert.equal(_addSwitch.type,'SwitchStatement');
	assert.equal(_addSwitch.cases.length,1);
	assert.equal(_addSwitch.cases[0].test.name,'INSERT_CASE');
	_addSwitch.cases.shift(); // we have now found and extracted the case INSERT_CASE from the template
	for (var k in dispatchBranches) {
	    var brs = _.map(dispatchBranches[k],genInvokeRuleItem);
	    _addSwitch.cases.push(b.switchCase(b.literal(k),brs.concat(b.breakStatement())));
	}
	var ins_gen = _addDef.declarations[0].init.body.body[0].consequent.body;
	assert.equal(ins_gen.length,9);
	assert.equal(ins_gen[7].type,'ExpressionStatement');
	assert.equal(ins_gen.splice(7,1)[0].expression.name,'INSERT_GENERIC_MATCHES');
	dispatchGeneric.forEach(function(ri){ins_gen.push(genInvokeRuleItem(ri));});
	    
	return storeJS;
    }

    parser.visit(js,{
	visitStoreDeclaration: function(path) {
	    var decl = path.node;
	    if (decl.id===null)
		path.replace(b.expressionStatement(genStore(decl)))
	    else
		path.replace(b.variableDeclaration('var',[
		    b.variableDeclarator(decl.id,genStore(decl)) ]));
	    return false;
	},
	visitStoreExpression: function(path) {
	    var decl = path.node;
	    path.replace(genStore(decl))
	    return false;
	}
    });

    return js;
}

exports.compile = generateJS;

require.extensions['.chrjs'] = function(module,filename) {
    var codegen = require('escodegen');
    var content = fs.readFileSync(filename,'utf8');
    module._compile(codegen.generate(generateJS(parser.parse(content))),filename);
};

if (util.env==='test') {
    exports._private = {
	exprContainsVariable:             exprContainsVariable,
	exprGetFreeVariables:             exprGetFreeVariables,
	exprGetVariablesWithBindingSites: exprGetVariablesWithBindingSites,
	Ref:                              Ref,
	mangle:                           mangle,
	genAccessor:                      genAccessor,
	genAdd:                           genAdd,
	genMatch:                         genMatch
    };
}
