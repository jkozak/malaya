//
// direct interpreted implementation of CHR refined operational semantics
//
//  rule format:
//    [[<match>,...],[<delete>,...],[<assert>,...],<guard>,[<add>,...]]
//
//  <match>,<delete>,<add> are all instances of <item>
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

var         _ = require('underscore');
var      util = require('./util.js');
var       Map = util.Map;
var Immutable = require('immutable');
var    assert = require('assert');

function Variable(name) {
    this.name = name;
    return this;
}

function VariableRest(name) {
    this.name = name;
    return this;
}

function clone(obj) {
    if(obj == null || typeof(obj)!='object')
        return obj;

    var temp = obj.constructor(); // changed

    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            temp[key] = clone(obj[key]);
        }
    }
    return temp;
}

function match(term,datum,context) {
    if (datum===undefined)	// undefined can't match anything
	return false;
    if (term instanceof Variable) {
	return context.bind(term.name,datum);
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
		if (!context.bind(term[i].name,var_data))
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
		if (!context.bind(term[k].name,obj))
		    return false;
	    } else {
		if (!context.bind(term[k].name,datum[k]))
		    return false;
	    }
	}
	return true;
    } else 
	return term==datum;
}

function ItemMatch(terms) {	// e.g. ["user",{name}]    
    this.terms = terms;
    return this;
}
function ItemDelete(match) {	// e.g. -["user",{name:"cole"}]
    this.match = match;
    return this;
}
function ItemGuard(expr) {	// e.g. ?name=='jimson'
    this.expr = expr;
    return this;
}
function ItemBind(name,expr) {	// e.g. new_name="mr "+name
    this.name = name;
    this.expr = expr;
    return this;
}
function ItemAdd(match) {	// e.g. +["user",{name:"watts"}]
    this.match = match;
    return this;
}
function ItemFail(msg) {
    this.msg = msg;
    return this;
}

function Snap(items,zero,accumulate) {
    if (accumulate===undefined) {
	accumulate = zero;
	zero       = undefined;
    }
    this.items      = items;
    this.zero       = zero;
    this.accumulate = accumulate;
    return this;
}

function Rule(items) {		// item is one of RHead,RDelete,RGuard,RBind,RAdd
    this.items = items;
    return this;
}

function Index(type) {
    this.type = type===undefined ? 'string' : type;
    if (!['string','number'].contains(this.type))
	throw new Error("unknown type to index");
    // +++ also want Date, bignum then a proper JSONy type system +++
}

function Store(rules) {
    var store = this;
    this.t             = 0;
    this.facts         = new Map();          // <t> -> <<fact>
    this.rules         = rules || [];
    this.indices       = [];
    this.Context       = function() {
	this.parent   = null;
	this.bindings = new Immutable.Map(); 
	this.in_play  = new Immutable.Set(); // t,...
	this.fail     = null;
	this.adds     = new Immutable.Set(); // [t,fact],...
	this.deletes  = new Immutable.Set(); // [t,fact],...
	return this;
    };
    this.Context.prototype.bind = function(n,v) {
	var bound = this.get(n);
	if (bound!==undefined)
	    return match(bound,v,this);
	else {
	    this.set(n,v);
	    return true;
	}
    };
    this.Context.prototype.get = function(n) {
	return this.bindings.get(n);
    };
    this.Context.prototype.set = function(n,v) {
	this.bindings = this.bindings.set(n,v);
    };
    this.Context.prototype.bump = function() {
	var ctx = store.createContext();
	ctx.parent   = this;
	ctx.bindings = this.bindings;
	ctx.in_play  = this.in_play;
	ctx.fail     = this.fail;
	return ctx;
    };
    this.createContext = function() {return new store.Context();};
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
Store.prototype.delete = function(t) {
    this.facts.delete(t);
};
Object.defineProperty(Store.prototype,'size',{get:function() {return this.facts.size;}});
Store.prototype.match_single_item = function(item,context,consume) {
    var store = this;
    if (item instanceof ItemMatch) {
	store.facts.forEach(function(t,fact) {
	    if (!context.in_play.has(t)) {
		var ctx = context.bump();
		ctx.in_play = context.in_play.add(t);
		if (match(item.terms,fact,ctx)) {
		    consume(fact,ctx);
		}
	    }
	});
    } else if (item instanceof ItemGuard) {
	if (item.expr(context.bindings))
	    consume(null,context);
    } else if (item instanceof ItemAdd) {
	throw new Error('NYI');
    } else if (item instanceof ItemDelete) {
	throw new Error('NYI');
    } else if (item instanceof ItemBind) {
	if (context.bind(item.name,item.expr(context)))
	    consume(null,context);
    } else if (item instanceof ItemFail) {
	this.fail = item.msg;
	consume(null,ctx);
    } else 
	throw new Error(util.format("bad item: %j",item));
};
Store.prototype.match_items = function(items,context,consume) {
    var store = this;
    if (items.length===0)
	consume(null,context);
    else 
	this.match_single_item(items[0],context,
			       function(item,context) {
				   store.match_items(items.slice(1),context,consume);
			       });
};
Store.prototype.snap = function(snap,context) {
    var value = snap.zero;
    context = context || this.createContext();
    this.match_items(snap.items,context,
		     function(item,context) {
			     value = snap.accumulate(value,context.bindings);
		     });
    return value;
};
Store.prototype.apply_rule_item_to_fact = function(rule,i,fact) {
    var context = this.createContext();
    var    item = rule.items[i];
    if (item instanceof ItemMatch || item instanceof ItemDelete)
    {
	// +++ match fact against item
	// +++ for item' in rule.items
	// +++   if item' is not item
	// +++      match item' against store
	// +++ return [fail|null,[[null,add],...],[[t,delete],...]]
	throw new Error("NYI");
    } else
	return [null,[],[]];
};
Store.prototype.rollback = function(t_adds,t_deletes) {
    var store = this;
    t_adds.forEach(function(t_add) {
	store.delete(t_add[0]);
    });
    t_deletes.forEach(function(t_delete) {
	store.add(t_delete[1]);
    });
};
Store.prototype._merge_results = function(res,res1) {
    var store = this;
    assert.equal(res[0],null);
    if (res1[0]!==null) {
	store.rollback(res1[1],res1[2]);
	res = [res1[0],[],[]];
	return false;
    } else {
	res1[1].forEach(function(t_add) {
	    t_add[0] = store.add(t_add[1]);
	});
	res1[2].forEach(function(t_delete) {
	    store.delete(t_delete[0]);
	});
	res[1].concat(res1[1]);
	res[2].concat(res1[2]);
    }
    return true;
};
Store.prototype.apply_rule_to_fact = function(rule,fact) {
    var   store = this;
    var   res = [null,[],[]];	// return [fail|null,[[t,add],...],[[t,delete],...]]
    // !!! this should be using a r/w variant of `match_items` !!!
    throw new Error('NYI');
    for (var i in rule.items) {
	var res1 = this.apply_rule_item_to_fact(rule,i,fact);
	if (!store._merge_results(res,res1))
	    return res;
    }
    return res;
};
Store.prototype.apply_fact = function(fact) {
    var store = this;
    var   res = [null,[],[]];	// return [fail|null,[[t,add],...],[[t,delete],...]]
    // !!! WRONG - fact must be put in store and marked as in_play !!!
    // !!!         create a Context and put it in as an `add`      !!!
    throw new Error('NYI');
    store.rules.forEach(function(rule) {
	var res1 = this.apply_rule_to_fact(rule,fact);
	if (!store._merge_results(res,res1))
	    return res;
    });
    return res;
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
    if (!(q instanceof Snap))
	throw new Error("query argument must be an Snap");
    return this.snap(q,{});
};

exports.Variable     = Variable;
exports.VariableRest = VariableRest;
exports.Rule         = Rule;
exports.Snap         = Snap;
exports.Store        = Store;
exports.Index        = Index;

if (util.env==='test')
    exports._private = {Map:         Map,
			match:       match,
			ItemMatch:   ItemMatch,
			ItemDelete:  ItemDelete,
			ItemAdd:     ItemAdd,
			ItemGuard:   ItemGuard,
			ItemBind:    ItemBind,
			ItemFail:    ItemFail
		       };
