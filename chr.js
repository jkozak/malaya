//
// direct interpreted implementation of CHR refined operational semantics
//
//  rule format:
//    [[<match>,...],[<delete>,...],[<assert>,...],<guard>,[<add>,...]]
//
//  <match>,<delete>,<add> are all instance of <term>
//    where <term>:
//      <string> | <number> | <list> | <map>
//        where <list>:
//          [<term>|Variable|VariableRest,...]
//        where <map>:
//          {<string>:(<term>|Variable)|null:VariableRest,...}
//    where <assert>:
//      <rel>(<name>,...)
//        where <rel>:
//          eq | gt | lt | le  &c

"use strict";

var _ = require('underscore');

function Variable(name) {
    this.name = name;
}

function VariableRest(name) {
    this.name = name;
}

function copy_context(context) {
    var ans = {};
    for (k in context)
	ans[k] = context[k];
    return ans;
}

// context is a map of names to objects
function match(term,datum,context) {
    var bind = function(n,v) {
	var bound = context[n];
	if (bound!==undefined)
	    return match(bound,v,context);
	else {
	    context[n] = v;
	    return true;
	}
    }
    if (datum===undefined)	// undefined can't match anything
	return false;
    if (term instanceof Variable) {
	return bind(term.name,datum,context);
    } else if (term instanceof VariableRest) {
	throw new Error("can't handle this here");
    } else if (term instanceof Array) {
	var rest_taken = false;
	if (!(datum instanceof Array))
	    return false;
	for (var i=0,j=0;i<term.length;i++,j++) {
	    //console.log("*** matching "+i+","+j+" "+term[i]+" "+datum[j]);
	    if (term[i] instanceof VariableRest) {
		if (rest_taken)
		    throw new Error("only one VariableRest per match");
		rest_taken = true;
		//console.log("**** VariableRest");
		var n_end_data = term.length-i-1;        // #taken at end
		var var_data   = datum.slice(j,j+datum.length-term.length+1);
		//console.log("**** VariableRest 2: "+n_end_data+" "+JSON.stringify(var_data));
		if (!bind(term[i].name,var_data,context))
		    return false;
		//console.log("**** VariableRest 3");
		j += var_data.length-1;
	    } else if (!match(term[i],datum[j],context))
		return false;
	}
	//console.log("**** i,j: "+i+","+j+" term.length: "+term.length+" datum.length: "+datum.length);
	//console.log("**** context: "+JSON.stringify(context));
	return term.length==i && datum.length==j;
    } else if (term instanceof Object) {
	if (!(datum instanceof Object))
	    return false;
	for (var k in term) {	// k=='' for VariableRest
	    var m = term[k];
	    if (m instanceof VariableRest) {
		if (k!='')
		    throw new Error("VariableRest key must be ''");
		var rest = _.difference(_.keys(datum),_.keys(term));
		var  obj = {};
		for (var n in rest)
		    obj[rest[n]] = datum[rest[n]];
		if (!bind(term[k].name,obj,context))
		    return false;
	    } else {
		if (!bind(term[k].name,datum[k],context))
		    return false;
	    }
	}
	return true;
    } else 
	return term==datum;
}

function Rule(matches,deletes,guards,asserts,adds) {
}

function Store(rules) {
    this.init = function() {
    };
    this.get_root = function(root0) {
	throw new Error("NYI");
    };
    this.set_root = function(root0) {
	throw new Error("NYI");
    };
    this.update = function(u) {
	throw new Error("NYI");
    }
    this.query = function(q) {
	throw new Error("NYI");
    }
}

exports.match        = match
exports.Variable     = Variable
exports.VariableRest = VariableRest

//N.B. top-level
