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

var    _ = require('underscore');
var  Map = require('data-structures').Map;
var util = require('./util.js');

function Set() {
    this.map = new Map();
    return this;
}
Set.prototype.has    = function(k) {return this.map.has(k);};
Set.prototype.add    = function(k) {this.map.set(k,null);}
Set.prototype.remove = function(k) {this.map.delete(k);}

function Variable(name) {
    this.name = name;
}

function VariableRest(name) {
    this.name = name;
}

// context is a map of names to objects
function copy_context(context) {
    var ans = {};
    for (var k in context)
	ans[k] = context[k];
    return ans;
}

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
	    if (term[i] instanceof VariableRest) {
		if (rest_taken)
		    throw new Error("only one VariableRest per match");
		rest_taken = true;
		var n_end_data = term.length-i-1;        // #taken at end
		var var_data   = datum.slice(j,j+datum.length-term.length+1);
		if (!bind(term[i].name,var_data,context))
		    return false;
		j += var_data.length-1;
	    } else if (!match(term[i],datum[j],context))
		return false;
	}
	return term.length==i && datum.length==j;
    } else if (term instanceof Object) {
	if (!(datum instanceof Object))
	    return false;
	for (var k in term) {	// k=='' for VariableRest
	    var m = term[k];
	    if (m instanceof VariableRest) {
		if (k!=='')
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

function Aggregate(matches,guard,zero,accumulate) {
    // +++ accumulate(value,term,context) >> value+value(term,context) +++
    this.matches    = matches;
    this.guard      = guard;
    this.zero       = zero;
    this.accumulate = accumulate;
    return this;
}

function Rule(matches,deletes,guards,asserts,adds) {
}

function Index(type) {
    this.type = type===undefined ? 'string' : type;
    if (!['string','number'].contains(this.type))
	throw new Error("unknown type to index");
    // +++ also want Date, bignum then a proper JSONy type system +++
}

function Store(rules) {
    this.t            = 0;
    this.facts        = new Map();
    this.rules        = [];
    this.indices      = [];
    this.active       = new Set();	// of fact indices (+++ s/be in a Context +++)
    this.compilations = new Map();
    return this;
}
Store.prototype._rebuild = function() {
    // +++ rebuild indices &c +++
    throw new Error("NYI");
};
Store.prototype.add_rule = function(rule) {
    if (this.facts)
	throw new Error("can't add rules to an active Store");
    this.rules.push(rule);
    this._rebuild();
};
Store.prototype.add_index = function(idx) {
    this.indices.push(idx);
    this._rebuild();
};
Store.prototype.lastUpdate = function() {
    return this.t;
};
Store.prototype.add = function(fact) {
    this.t++;
    if (this.rules.length!==0)
	throw new Error("NYI");
    this.facts.set(this.t,fact);
    return this.t;
};
Store.prototype.remove = function(t) {
    this.facts.delete(t);
};
Store.prototype.size = function() {
    return this.facts.size;
};
Store.prototype.match_single_term = function(term,context,consume) {
    var self = this;
    this.facts.forEach(function(t,fact) {
	if (!self.active.has(t)) {
	    self.active.add(t);
	    var ctx = copy_context(context);
	    if (match(term,fact,ctx)) 
		consume(fact,ctx);
	    self.active.remove(t);
	}
    });
};
Store.prototype.match_terms = function(terms,context,consume) {
    var store = this;
    if (terms.length===0)
	consume(null,context);
    else 
	this.match_single_term(terms[0],context,
			       function(term,context) {
				   store.match_terms(terms.slice(1),context,consume);
			       });
};
Store.prototype.aggregate = function(aggr,context) {
    var value   = aggr.zero;
    var context = {}
    this.match_terms(aggr.matches,context,
		     function(term,context) {
			 if (aggr.guard(context))
			     value = aggr.accumulate(value,term,context);
		     });
    return value;
};
// BusinessLogic protocol (so can do `module.exports = <store>;`)
Store.prototype.get_root = function() {
    return {t:    this.t,
	    facts:this.facts};
};
Store.prototype.set_root = function(r) {
    this.t     = r.t;
    this.facts = r.facts;
    this._rebuild();
};
Store.prototype.update = function(u) {
    this.add(u);
};
Store.prototype.query = function(q) {
    if (!(q instanceof Aggregate))
	throw new Error("query argument must be an Aggregate");
    return this.aggregate(q,{});
};

exports.Variable     = Variable;
exports.VariableRest = VariableRest;
exports.Rule         = Rule;
exports.Aggregate    = Aggregate;
exports.Store        = Store;
exports.Index        = Index;

if (util.env==='test')
    exports._private = {match:       match,
			copy_context:copy_context};
