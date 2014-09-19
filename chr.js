//
// direct interpreted implementation of CHR refined operational semantics
//
//  rule format:
//    [<item>,...]
//
//  where <item> is one of:
//    ItemMatch
//    ItemGuard
//    ItemBind
//    ItemAdd
//    ItemDelete
//    ItemFail

//  <match>,<delete>,<add> are <term>s
//    where <term> is one of:
//      <string> | <number> | <list> | <map>
//        where <list> is:
//          [<term>|Variable|VariableRest,...]
//        and <map> is:
//          {<string>:(<term>|Variable)|'':VariableRest,...}

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
function match_single_item_match(item,context,consume) {
    var t = null;
    if (item.sources) 
	t = item.sources.get(context.index);
    if (t!==null) {
	var ctx = context.bump();
	assert.ok(context.in_play.has(t)); // should have been set up already
	if (match(item.terms,context.store.facts.get(t),ctx)) {
	    consume(t,ctx);
	}
    } else 
	context.store.facts.forEach(function(t,fact) {
	    if (!context.in_play.has(t)) {
		var ctx = context.bump();
		ctx.in_play = context.in_play.add(t);
		if (match(item.terms,fact,ctx)) {
		    consume(t,ctx);
		}
	    }
	});
}
ItemMatch.prototype.match_single_item = function(context,consume) {
    match_single_item_match(this,context,consume);
};
ItemGuard.prototype.match_single_item = function(context,consume) {
    if (this.expr(context.bindings))
	consume(null,context);
};
ItemAdd.prototype.match_single_item = function(context,consume) {
    var item = this;
    match_single_item_match(this,context,function(t,context) {
	context.add_fact(context.instantiate(item.match.terms));
	consume(item,context);
    });
};
ItemDelete.prototype.match_single_item = function(context,consume) {
    match_single_item_match(this,context,function(t,context) {
	context.delete_fact(t);
	consume(item,context);
    });
};
ItemBind.prototype.match_single_item = function(context,consume) {
    if (context.bind(this.name,this.expr(context)))
	consume(null,context);
};
ItemFail.prototype.match_single_item = function(context,consume) {
    context.fail = this.msg;
    consume(null,ctx);
};

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
    this.facts         = new Map();           // t -> fact
    this.rules         = rules || [];
    this.indices       = [];
    this.Context       = function() {
	this.store    = store;
	this.index    = null;	              // item # in rule, 0-based 
	this.sources  = null;	              // index->t
	this.bindings = new Immutable.Map(); 
	this.in_play  = new Immutable.Set();  // t,...
	this.fail     = null;
	this.adds     = new Immutable.Set();  // [t,fact],...
	this.deletes  = new Immutable.Set();  // [t,fact],...
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
	ctx.sources  = this.sources;
	ctx.bindings = this.bindings;
	ctx.in_play  = this.in_play;
	ctx.fail     = this.fail;
	return ctx;
    };
    this.Context.prototype.add_fact = function(fact) {
	this.adds = this.adds.add([null,fact]);
    };
    this.Context.prototype.delete_fact = function(t) {
	this.deletes = this.deletes.add([t,null]);
    };
    this.Context.prototype.instantiate = function(term) {
	var context = this;
	if (term instanceof Array) {
	    var ins = [];
	    for (var i=0;i<term.length;i++) {
		if (term[i] instanceof VariableRest)
		    ins = ins.concat(context.get(term[i].name));
		else
		    ins.push(context.instantiate(term[i]));
	    }
	    return ins;
	} else if (term instanceof Variable) {
	    return context.get(term.name);
	} else if (term instanceof Object) {
	    var ins = {};
	    for (var k in term) 
		if (term.hasOwnProperty(k)) {
		    if (k==='' && term[k] instanceof VariableRest) {
			var rest = context.get(term[k].name);
			for (var k1 in rest) {
			    if (rest.hasOwnProperty(k1)) 
				ins[k1] = rest[k1];
			}
		    } else
			ins[k] = context.instantiate(term[k]);
		}
	    return ins;
	} else
	    return term;
    };
    this.Context.prototype.install = function() {
	var context = this;
	var   store = context.store;
	context.adds = this.adds.map(function(v,k) {
	    assert.equal(v[0],null);
	    return [store.add_fact(v[1]),v[1]];
	});
	context.deletes = this.deletes.map(function(v,k) {
	    assert.equal(v[1],null);
	    return [v[0],store.delete_fact(v[0])];
	});
    };
    this.Context.prototype.uninstall = function() {
	var context = this;
	var   store = context.store;
	context.adds = this.adds.map(function(v,k) {
	    assert.notEqual(v[0],null);
	    store.delete_fact(v[0])
	    return [null,v[1]];
	});
	context.deletes = this.deletes.map(function(v,k) {
	    assert.notEqual(v[1],null);
	    return [store.add_fact(v[1]),null];
	});
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
    this.facts.set(this.t,fact);
    return this.t;
};
Store.prototype.delete = function(t) {
    var fact = this.facts.get(t);
    this.facts.delete(t);
    return fact;
};
Object.defineProperty(Store.prototype,'size',{get:function() {return this.facts.size;}});
Store.prototype.match_items_indexed = function(items,i,context,consume) {
    var store = this;
    if (i>=items.length)
	consume(null,context);
    else {
	context.index = i;
	items[i].match_single_item(context,
				   function(t,context) {
				       store.match_items_indexed(items,i+1,context,consume);
				   });
    }
};
Store.prototype.match_items = function(items,context,consume) {
    this.match_items_indexed(items,0,context,consume);
}
Store.prototype.snap = function(snap,context) {
    var value = snap.zero;
    context = context || this.createContext();
    this.match_items(snap.items,context,
		     function(t,context) {
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
    // !!! WRONG - fact must be put in store                   !!!
    // !!!         create a Context and put it in as `in_play` !!!
    //             apply rule then:
    //                * delete each delete
    //                * apply_fact each add
    //             rollback via immutable facts
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
