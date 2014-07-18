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

function Variable(name) {
    this.name = name;
}

function VariableRest(name) {
    this.name = name;
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
    if (datum===undefined)
	return false;
    if (term instanceof Variable) {
	return bind(term.name,datum,context);
    } else if (term instanceof VariableRest) {
	throw new Error("can't handle this here");
    } else if (term instanceof Array) {
	if (!datum instanceof Array)
	    return false;
	for (var i=0;i<term.length;i++) {
	    if (term[i] instanceof VariableRest) {
		var n_end_terms = (datum.length-i-1); // #taken at end
		var var_terms   = term.slice(i,-n_end_terms);
		if (!bind(term[i].name,var_terms,context))
		    return false;
		i += var_terms.length;
	    } else if (!match(term[i],datum[i],context))
		return false;
	}
	return term.length==datum.length;
    } else if (term instanceof Object) {
	if (!datum instanceof Object)
	    return false;
	for (var k in term) {	// k==null for VariableRest
	    if (k===null) {
		if (!(term[k] instanceof VariableRest))
		    throw new Error("ill-formed map matcher");
		// +++ VariableRest +++
	    } else {
		// +++
	    }
	}
	return true;
    } else 
	return term==datum;
}

exports.match        = match
exports.Variable     = Variable
exports.VariableRest = VariableRest

function copy_context(context) {
    var ans = {};
    for (k in context)
	ans[k] = context[k];
    return ans;
}

//N.B. top-level
