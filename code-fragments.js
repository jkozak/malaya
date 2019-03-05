"use strict";

// This code is not run in the normal sense - it is parsed and used as
// a library of code fragments for code generation.

// It is parsed by the malaya parser, but doesn't use any malaya
// innovations.

// With that in mind, some of the fragments below, being incomplete,
// fail eslint tests, so we disable those.
/*eslint-disable no-unused-labels,no-undef,no-unused-vars */

({                              // need the initial '(' to make this an ExpressionStatement
    "store":  function() {
        const  plugins = {};
        const   assert = require('assert').strict;
        const       ee = new (require('events').EventEmitter)();
        let          t = 1;              // must be > 0 always?
        let      facts = {};             // 't' -> fact; this is the main fact store
        let      index = {};             // term1 -> [t,...]  where t is number not string
        let      debug = false;
        const     adds = [];             // <t>,...
        const     dels = [];             // <t>,...
        let       refs = {};             // <t>:<fact>,...
        const      err = null;
        const     _add = function(fact) {
            if (fact instanceof Array && fact.length>0 && (typeof fact[0])==='string') {
                var     ti = t++;
                var t_fact = ''+ti;  // `t_fact` is a string , use ti in indices
                facts[t_fact] = fact;
                adds.push(t_fact);
                if (exports.debug)
                ee.emit('add',t_fact,fact);
                if (index[fact[0]]===undefined)
                    index[fact[0]] = [];
                index[fact[0]].push(ti);
                INSERT_INDEXED_MATCHES:;
                if (fact.length===3 && fact[2].dst) {
                    var d = fact[2].dst;
                    if ((typeof d==='string' && plugins[d]) ||
                        Array.isArray(d) && d.length>0 && plugins[d[0]] ) {
                        _del(t_fact);
                        obj.out(fact[2].dst,fact.slice(0,2));
                    }
                }
                return t_fact;
            } else
                ee.emit('error',new Error("unloved fact format: "+JSON.stringify(fact)));
            return null;
        };
        const     _del = function(t) {
            const   ti = parseInt(t);  // use this in indices
            const    i = adds.indexOf(t);
            const fact = facts[t];
            if (exports.debug)
                ee.emit('del',t,fact);
            if (i!==-1)
                adds.splice(i,1);    // here today, gone today
            else {
                refs[t] = facts[t];
                dels.push(t);
            }
            index[fact[0]].splice(index[fact[0]].indexOf(ti),1);
            delete facts[t];
        };
        const _rebuild = function() {
            index = {};
            for (let t in facts) {
                const fact = facts[t];
                const   ti = parseInt(t);
                if (fact instanceof Array && fact.length>0 && (typeof fact[0])==='string') {
                    if (index[fact[0]]===undefined)
                        index[fact[0]] = [];
                    index[fact[0]].push(ti);
                }
            }
            for (let tag in index)
                index[tag].sort(function(p,q){return p-q;});
        };
        const      obj = {
            on:   function(ev,cb) {ee.on(ev,cb);},
            once: function(ev,cb) {ee.once(ev,cb);},
            get:  function(t) {assert.equal(typeof t,'string');return facts[t];},
            add:  function(fact) {
                assert.strictEqual(adds.length,0);
                assert.strictEqual(dels.length,0);
                _add(fact);
                ee.emit('fire',obj,fact,adds,dels,refs);
                var ans = {err:null,adds:adds,dels:dels,refs:refs};
                adds.length = 0;dels.length = 0;refs = {};
                return ans;
            },
            _del: function(t) { // only used for handling magic outputs
                delete facts[t];
            },
            get t()       {return t;},
            get size()    {return Object.keys(facts).length;},
            get queries() {return queries;},
            reset: function(){t=1;index={};facts={};init();},
            out:   function(dest,data) {ee.emit('out',dest,data);},

            get __file__() {return __file__;},

            plugin: function(plugin,name,opts) {
                malayaPlugin.require(plugin);
                const pl = malayaPlugin.instantiate(plugin,name,opts);
                pl.connect(obj);
                if (plugins[pl.name])
                    throw new Error("plugin name duplicated: "+pl.name);
                plugins[pl.name] = pl;
                return obj;     // can be chained
            },

            // business logic protocol
            tag: null,
            init: function() {
                obj.reset();
            },
            getRoot: function() {
                return {tag:  obj.tag,
                        t:    t,
                        facts:facts};
            },
            setRoot: function(r) {
                if (obj.tag!==undefined && r.tag!==obj.tag)
                    ee.emit('error',new Error("wrong tag: "+JSON.stringify(r.tag)+", expected: "+JSON.stringify(obj.tag)));
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
                if (exports.debug)
                    Object.freeze(u);
                var res = obj.add(u);
                res.adds.forEach(function(t) {res.refs[t]=facts[t];});
                return res;
            }
        };
        if (!process.env.NODE_ENV || !process.env.NODE_ENV.startsWith('prod'))
            obj._private = {
                get rawFacts() {return facts;},
                get orderedFacts() {
                    var keys = Object.keys(facts).map(function(t){return parseInt(t);});
                    return keys.sort(function(p,q){return p-q;}).map(function(t){return facts[t];});
                },
                get debug()  {return debug;},
                set debug(b) {debug=b;},
                facts: function(sel){
                    switch (typeof sel) {
                    case 'string':
                        return obj._private.orderedFacts.filter(function(f){return f[0]===sel;});
                    case 'function':
                        return obj._private.orderedFacts.filter(sel);
                    case 'undefined':
                        return obj._private.orderedFacts;
                    default:
                        throw new Error("bad fact selector: "+JSON.stringify(sel));
                    }
                }
            };

        const      out = function(dest,data) {obj.out(dest,data);};

        // `rules` is an array [[variant,...],...]
        INSERT_RULES:;

        // `queries` is an object {name:query,...}
        INSERT_QUERIES:;

        // initial store contents
        INSERT_INIT:;
        init();

        return obj;
    },
    indexedMatches: function() {
        switch (fact[0]) {
            case REPLACE_CASE:
            break;
        }
    },
    rule: function() {          // add, del &c
        const REPLACE_NAME = function (t_fact) {
            let      fact;
            const in_play = [];

            INSERT_MATCH:;  // all the term matches, then the addenda and delenda
        };
    },
    query: function() {     // to be embedded in store above, whence `adds`, `dels` &c
        const REPLACE_NAME = function () {
            let        fact;
            let REPLACE_ANS = REPLACE_INIT; // `REPLACE_ANS` is replaced with `accum`
            const   in_play = {};

            INSERT_MATCH:;
            {
                REPLACE_ANS = REPLACE_FOLD(REPLACE_ANS);
            }

            return {t:t,result:REPLACE_ANS};
        };
    },
    sort: function() {
        const REPLACE_SORTED = [];
        for (var T in facts) {      // +++ use fact index +++
            fact = facts[T];
            INSERT_GENMATCH:;
        }
        REPLACE_SORTED.sort(function(p,q){return p[0]-q[0];});
        for (let S=0;S<REPLACE_SORTED.length;S++) {
            T    = REPLACE_SORTED[S][1];
            fact = facts[T];
            INSERT_REST:;
        }
    },
});
