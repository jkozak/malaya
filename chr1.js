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
var    util = require('./util.js');
var       _ = require('underscore');

var templates       = {};
var template_marker = 'TEMPLATE_';

function TEMPLATE_store() {
    (function() {
	var     t = 1;		// must be > 0 always?
	var facts = {};		// t -> fact

	"INSERT:RULES";

	"INSERT:QUERIES";
	
	var   ans = {
	    get: function(t) {return facts[t];},
	    add: function(fact) {
		var news = [fact];
		var adds = [];
		var dels = [];
		var  err = null;
		var _add = function(fact) {
		    if (fact instanceof Array && fact.length>0)
			switch (fact[0]) {
			case "INSERT:CASE": {
			    "INSERT:MATCHES";
			    break;
			}
			}
		    else
			return {err:"unloved fact format: "+JSON.stringify(fact)};
		};
		while (news.length>0) {
		    _add(news.shift());
		    if (err)
			return {err:err};
		}
		return {err:err,adds:adds,dels:dels};
	    }
	};
	Object.defineProperty(ans,'t',{get:function(){return t;}});
	return ans;
    })();
}

function TEMPLATE_rule() {	// to be embedded in store above, whence `adds`, `dels` &c
    var INSERT_NAME = function () {
	var addenda = [];
	var delenda = [];
	var in_play = {};

	"INSERT:MATCH";
	{
	    delenda.forEach(function(d) {
		"INSERT:DEL_INDEX";
		delete facts[d];
		dels.push(d);
	    });
	    addenda.forEach(function(a){
		"INSERT:ADD_INDEX";
		news.push(a);
		adds.push(a);
	    });
	}
	
    };
}

function TEMPLATE_scan_store() {
    for (var INSERT_NAME=0;INSERT_NAME<facts.length;INSERT_NAME++) {
	
    }
}

var autoparse = recast.parse(fs.readFileSync(__filename),{esprima:require('esprima')});
for (var i in autoparse.program.body) {
    var x = autoparse.program.body[i];
    if (x.type==='FunctionDeclaration' && x.id.name.indexOf(template_marker)===0) {
	templates[x.id.name.substr(template_marker.length)] = x.body.body;
    }
}
//console.log("autoparse: %j",autoparse);
//console.log("templates: %j",templates);

//recast.parse("test/bl/match.chrjs",{esprima:eschrjs});

function exprContainsVariable(expr) {
    return exprGetFreeVariables(expr).length!=0;
}
function exprGetFreeVariables(expr) {
    switch (expr.type) {
    case 'Identifier':
	return [expr.name];
    case 'Literal':
	return [];
    case 'UnaryExpression':
	return exprGetFreeVariables(expr.argument);
    case 'BinaryExpression':
	return _.union(exprGetFreeVariables(expr.left),exprGetFreeVariables(expr.right));
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

// +++ rewrite stage 1 +++
//     eventually:
//        reorder items
//        extract complex expressions:
//           e.g. ['a',{p:p,q:p+1}] -> ['a',{p:p,q:g234}],g234==p+1

var gensym_i = 1;

function rewritePassOne(rules) {
    assert.equal(rule.type,RuleStatement);
    
}

// +++ dataflow analysis +++
//     for each rule
//       <var> -> [<item>,R|W],...
//       <var> -> [<item>,<term>]     first W
//       <var> -> bool                written? (as we go along genning)


function variableAnalysis(rule) {
    // VarRef is an object:
    //  type: R|W
    //  item: <index>
    //  term: <index>
    //  path: e.g. [1,'name','xian']  for ['user',{name:{xian:x}}]
    //  expr: containing var
    var findVars = function(expr,type,vars,path) {
	var addRef = function(name,ref) {
	    if (vars[name]===undefined)
		vars[name] = [];
	    vars[name].push(ref);
	};
	switch (expr.type) {
	case 'ArrayExpression':
	    for (var i in expr.elements) {
		findVars(expr.elements[i],type,vars,path.concat(i));
	    }
	    break;
	case 'ObjectExpression':
	    for (var i in expr.properties) {
		if (expr.properties[i].kind=='init')
		    findVars(expr.properties[i].init,vars,path.concat(expr.properties[i].key.name));
		else if (expr.properties[i].kind=='bindOne' || expr.properties[i].kind=='bindRest')
		    addRef(expr.properties[i].key.name,{type:type,item:item_i,term:term_i,path:path});
	    }
	    break;
	case 'Identifier':
	    addRef(vars[expr.name],{type:type,item:item_i,term:term_i,path:path});
	    break;
	case 'UnaryExpression':
	case 'BinaryExpression':
	    // ...
	    // type = 'R'
	default:
	    throw new Error(util.format("!!! can't handle: %j",expr));
	}
    };
    for (var i in parsedRule.items) {
    }
}


if (util.env==='test') {
    exports._private = {
	rewritePassOne:       rewritePassOne,
	exprContainsVariable: exprContainsVariable,
	exprGetFreeVariables: exprGetFreeVariables
    };
}
