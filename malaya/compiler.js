// compiler-based CHR for JS
// optimisations presume 'tab' format: [<table>,{<column>:<value>,...},...] is used.
//
//N.B. this file parses itself: top-level functions whose names start with
//     the value of `template_marker` are extracted and stashed away for
//     later editing and re-emission.  They are not directly run.

"use strict";
/*eslint-disable*/

const  recast = require('recast');
const      fs = require('fs');
const  parser = require('./parser.js');
const  assert = require('assert');
const  events = require('events');
const    util = require('./util.js');
const    path = require('path');
const       _ = require('underscore');

const templates       = {};
const template_marker = 'TEMPLATE_';

const b = (function() {
    const b = recast.types.builders;
    // +++ add `attrs` to more things if needed +++
    return Object.assign({},b,{
        identifier: function(id) {return Object.assign({attrs:{}},b.identifier(id));}
    });
})();

function TEMPLATE_store() {
    (function() {
        var  store = this;
        var assert = require('assert');
        var     ee = new (require('events').EventEmitter)();
        var      t = 1;              // must be > 0 always?
        var  facts = {};             // 't' -> fact; this is the main fact store
        var  index = {};             // term1 -> [t,...]  where t is number not string
        var   adds = [];             // <t>,...
        var   dels = [];             // <t>,...
        var   refs = {};             // <t>:<fact>,...
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
                return t_fact;
            } else
                ee.emit('error',new Error("unloved fact format: "+JSON.stringify(fact)));
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
            _del: function(t) { // only used for handling magic outputs
                delete facts[t];
            },
            get t()       {return t;},
            get size()    {return Object.keys(facts).length;},
            get queries() {return queries;},
            reset: function(){t=1;index={};facts={};init();},
            out:   function(dest,data) {ee.emit('out',dest,data);},

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
                var res = obj.add(u);
                res.adds.forEach(function(t) {res.refs[t]=facts[t];});
                return res;
            }
        };
        if (process.env.NODE_ENV==='test')
            obj._private = {
                get facts()   {return facts;},
                get orderedFacts() {
                    var keys = Object.keys(facts).map(function(t){return parseInt(t);});
                    return keys.sort(function(p,q){return p-q;}).map(function(t){return facts[t];});
                }
            };

        var out = function(dest,data) {obj.out(dest,data);};

        // `rules` is an array [[variant,...],...]
        INSERT_RULES;

        // `queries` is an object {name:query,...}
        // +++ queries should not be able to call `out` +++
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

function TEMPLATE_query() {     // to be embedded in store above, whence `adds`, `dels` &c
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
    for (var T in facts) {      // +++ use fact index +++
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

var warnOnce = (function(){
    var sent = {};
    return function(w) {
        if (!sent[w]) {
            console.warn("warning: "+w);
            sent[w] = true;
        }
    };
})();

// +++ Here's a hint for a better way to do the above:
//  console.log("parsed TEMPLATE_indexed_matches: %j",recast.parse(TEMPLATE_indexed_matches.toString()));

var deepClone = util.deepClone;

var chrGlobalVars = {           // only javascript globals allowed in CHRjs
    Infinity:   {ext:true,mutable:false},
    NaN:        {ext:true,mutable:false},
    undefined:  {ext:true,mutable:false},
    //N.B. `null` is a keyword
    isFinite:   {ext:true,mutable:false,type:'function'},
    isNaN:      {ext:true,mutable:false,type:'function'},
    parseFloat: {ext:true,mutable:false,type:'function'},
    parseInt:   {ext:true,mutable:false,type:'function'},
    Number:     {ext:true,mutable:false,type:'function'},
    Object:     {ext:true,mutable:false,type:'function'},
    JSON:       {ext:true,mutable:false,type:'function'},
    Math:       {ext:true,mutable:false,type:'function',mangle:'MalayaMath'},
    Date:       {ext:true,mutable:false,type:'function',mangle:'MalayaDate'},
    require:    {ext:true,mutable:false,type:'function'},
    module:     {ext:true,mutable:false,type:'function'},
    console:    {ext:true,mutable:false,type:'function'},
    __dirname:  {ext:true,mutable:false,type:'string'}
};
if (util.env==='test')
    chrGlobalVars = Object.assign(chrGlobalVars,
                                  {
                                      // general testing stuff
                                      console: {ext:true,mutable:false,type:'function'},
                                      process: {ext:true,mutable:false,type:'function'},
                                      Error:   {ext:true,mutable:false,type:'function'},
                                      // the `mocha` globals
                                      before:  {ext:true,mutable:false,type:'function'},
                                      after:   {ext:true,mutable:false,type:'function'},
                                      describe:{ext:true,mutable:false,type:'function'},
                                      it:      {ext:true,mutable:false,type:'function'}
                                  });
if (util.env==='benchmark')
    chrGlobalVars = Object.assign(chrGlobalVars,
                                  {
                                      // the `matcha` globals
                                      suite:   {ext:true,mutable:false,type:'function'},
                                      bench:   {ext:true,mutable:false,type:'function'}
                                  });

var chrLocalVars = {
    out: {ext:true,mutable:false,type:'function'}
};

global.MalayaDate = global.Date;
global.MalayaMath = {};
Object.getOwnPropertyNames(Math).forEach(function(n){
    MalayaMath[n] = Math[n];
});
MalayaMath.random = function(){throw new Error("malaya does not play dice");};

function findVar(v,path) {
    if (chrLocalVars[v])
        return chrLocalVars[v];
    else if (path===null)
        return chrGlobalVars[v];
    else if (path.node.attrs && path.node.attrs.vars && path.node.attrs.vars[v])
        return path.node.attrs.vars[v];
    else
        return findVar(v,path.parent);
}

function annotateParse1(js) {   // poor man's attribute grammar - pass one
    var vars = null;
    var item = null;    // `op` of active item or `null`
    var stmt = null;
    js = deepClone(js);
    js = parser.visit(js,{
        markItemsWithIdAndSort:   function(node) {
            for (var i=0;i<node.items.length;i++)
                node.items[i].attrs.itemId = i;
            // do `out`s after all generators and tests
            //N.B. + and - ops are only effected at end of rule processing
            node.items.sort(function(p,q){
                var p0 = p.op==='O';
                var q0 = q.op==='O';
                var  r = p0-q0;
                if (r!==0)
                    return r;
                else
                    return p.attrs.itemId-q.attrs.itemId;
            });
        },
        noteDeclaredName:         function(name,type,bound) {
            if (vars[name])
                throw new util.Fail(util.format("function shadowed or overloaded: %s",name));
            vars[name] = {declared:true,type:type,bound:bound};
        },
        doFunction:               function(path) {
            var save = {vars:vars,stmt:stmt};
            path.node.attrs.vars = vars = {};
            stmt = 'function';
            for (var i in path.node.params) {
                var param = path.node.params[i];
                assert.strictEqual(param.type,'Identifier');
                vars[param.name] = {bound:true,declared:true};
            }
            this.traverse(path);
            stmt = save.stmt;
            vars = save.vars;
        },
        visitProgram:             function(path) {
            path.node.attrs.vars = vars = {};
            stmt = 'program';
            this.traverse(path);
            stmt = null;
            vars = null;
        },
        visitFunctionDeclaration: function(path) {
            this.noteDeclaredName(path.node.id.name,'function');
            return this.doFunction(path);
        },
        visitFunctionExpression:  function(path) {return this.doFunction(path);},
        visitVariableDeclarator:  function(path) {
            var name = path.node.id.name;
            this.traverse(path);
            vars[name].bound    = true;
            vars[name].declared = true;
            vars[name].mutable  = path.parent.kind!=='const';
            vars[name].type     = (path.node.init&&path.node.init.type==='FunctionExpression') ? 'function' : null;
            if (!_.contains(['program','function'],stmt)) // !!! null is for TESTING !!!
                throw new util.Fail(util.format("variable %s declared in inappropriate context %s",name,stmt));
        },
        visitCatchClause:         function(path) {
            var save = {vars:vars,stmt:stmt};
            path.node.attrs.vars = vars = {};
            stmt = 'catch';
            assert.strictEqual(path.node.param.type,'Identifier');
            vars[path.node.param.name] = {bound:true,declared:true};
            this.traverse(path);
            stmt = save.stmt;
            vars = save.vars;
        },
        doStore:                  function(path) {
            var save = {vars:vars,stmt:stmt};
            path.node.attrs.vars = vars = {};
            stmt = 'store';
            if (path.node.id!==null)
                this.noteDeclaredName(path.node.id.name,'store');
            this.traverse(path);
            stmt = save.stmt;
            vars = save.vars;
        },
        visitStoreDeclaration:    function(path) {
            if (path.node.id!==null)
                this.noteDeclaredName(path.node.id.name,'store');
            return this.doStore(path);
        },
        visitStoreExpression:     function(path) {return this.doStore(path);},
        visitRuleStatement:       function(path) {
            if (path.node.id!==null)
                this.noteDeclaredName(path.node.id.name,'store');
            this.markItemsWithIdAndSort(path.node);
            var save = {vars:vars,stmt:stmt};
            path.node.attrs.vars = vars = {};
            stmt = 'rule';
            this.traverse(path.get('items'));
            vars = save.vars;
            stmt = save.stmt;
        },
        visitQueryStatement:      function(path) {
            this.noteDeclaredName(path.node.id.name,'function');
            this.markItemsWithIdAndSort(path.node);
            var save = {vars:vars,stmt:stmt};
            path.node.attrs.vars = vars = {};
            stmt = 'query';
            this.visit(path.get('items'));
            this.visit(path.get('args'));
            this.visit(path.get('init'));
            this.visit(path.get('accum'));
            vars = save.vars;
            stmt = save.stmt;
            return false;
        },
        visitSnapExpression:      function(path) {
            if (stmt==='rule') {
                if ("+=O".indexOf(item)===-1)
                    throw new util.Fail(util.format("for expression must occur in create, assign or out item"));
            } else if (stmt=='function') {
                // +++ get rid of this +++
            }  else if (stmt=='query') {
                // only applies to where
            } else
                throw new util.Fail(util.format("for expression not in rule [%s]",stmt));
            if (path.node.id!==null)
                this.noteDeclaredName(path.node.id.name,'snap',true);
            this.markItemsWithIdAndSort(path.node);
            var save = {vars:vars,stmt:stmt,item:item};
            path.node.attrs.vars = vars = {};
            Object.keys(save.vars).forEach(function(k){ // copy over bound vars from container
                if (save.vars[k].bound)
                    vars[k] = Object.assign({inherited:true},save.vars[k]);
            });
            stmt = 'snap';
            item = null;
            this.visit(path.get('items'));
            this.visit(path.get('init'));
            this.visit(path.get('accum'));
            vars = save.vars;
            stmt = save.stmt;
            item = save.item;
            return false;
        },
        visitWhereExpression:     function(path) { // !!! hack !!!
            var bArg = b.identifier('arg1');
            var body = b.callExpression(b.memberExpression(bArg,b.identifier('concat'),false),
                                        [b.arrayExpression([path.node.element])] );
            var  blk = b.blockStatement([b.returnStatement(body)]);
            var  acc = b.functionExpression(null,[bArg],blk);
            var snap = b.snapExpression(path.node.id,
                                        b.arrayExpression([]),
                                        path.node.items,
                                        acc);
            snap.attrs = {};
            acc.attrs  = {};
            path.replace(snap);
            return this.visitSnapExpression(path);
        },
        visitQueryWhereStatement:      function(path) {
            var bBody = b.blockStatement([b.returnStatement(path.node.body)]);
            var bCode = b.functionDeclaration(path.node.id,path.node.args,bBody);
            bCode.attrs = {};
            path.replace(bCode);
            return this.visitFunctionDeclaration(path);
        },
        visitItemExpression:      function(path) {
            if (stmt!=='rule' && _.contains(['+','-'],path.node.op))
                throw new util.Fail(util.format("updating store outside of rule: %j/%s",path.node,stmt));
            item = path.node.op;
            this.traverse(path);
            item = null;
        },
        visitIdentifier:          function(path) {
            if (vars[path.node.name]===undefined) {
                if (!findVar(path.node.name,path))
                    vars[path.node.name] = {};
            }
            return false;
        },
        visitMemberExpression:    function(path) {
            if (path.node.computed)
                this.traverse(path);
            else {
                this.visit(path.get('object'));
                return false;
            }
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
            if (path.node.callee.type==='Identifier' && path.node.callee.name==='out' && item!=='O')
                throw new util.Fail("`out` not at top level in chrjs clause");
            this.traverse(path);
        },
        visitCallExpression:      function(path){return this.doCall(path);},
        visitNewExpression:       function(path){return this.doCall(path);},
        visitSequenceExpression:  function(path) { // allow these for arrow functions only, s/be translated
            if (path.node.expressions.length===0)
                throw new util.Fail("escaped ()");
            this.traverse(path);
        }
    });
    return js;
}

function annotateParse2(chrjs) {        // poor man's attribute grammar - pass two
    var checkBound = function(vars) {
        Object.keys(vars).map(function(k) {
            if (!vars[k].bound)
                throw new util.Fail(util.format("variable never bound: %s",k));
        });
    };
    var setBoundHereAttr = function(js,vars) {
        js = parser.visit(js,{
            visitIdentifier:          function(path) {
                if (path.node.name[0]!=='%' && vars[path.node.name]!==undefined) {
                    if (!vars[path.node.name].bound) {
                        assert(!vars[path.node.name].inherited);
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
            visitProperty:            function(path) {
                this.visit(path.get('value')); // mark `value` as bound, not `key`
                return false;
            },
            visitSnapExpression:      function(path){
                if (path.node===js)
                    this.traverse(path); // process iff initial value
                else
                    return false;        // will be handled in own pass from below
            },
            // don't visit sites that can't bind vars
            visitUnaryExpression:     function(path){return false;},
            visitBinaryExpression:    function(path){return false;},
            visitMemberExpression:    function(path){return false;}  // only a bare var can bind
        });
        checkBound(vars);
    };
    chrjs = deepClone(chrjs);
    chrjs = parser.visit(chrjs,{
        visitRuleStatement:       function(path) {
            this.traverse(path); // may contain SnapExpressions
            setBoundHereAttr(path.node,path.node.attrs.vars);
        },
        visitQueryStatement:      function(path) {
            setBoundHereAttr(path.node,path.node.attrs.vars);
            return false;
        },
        visitQueryWhereStatement:      function(path) {
            setBoundHereAttr(path.node,path.node.attrs.vars);
            this.traverse(path.get('body'));
        },
        visitSnapExpression:      function(path) {
            setBoundHereAttr(path.node,path.node.attrs.vars);
            this.traverse(path.get('accum')); // snap expressions can nest here
        },
        doVars:                   function(path) {
            this.traverse(path);
            Object.keys(path.node.attrs.vars).map(function(k) {
                if (!findVar(k,path).declared)
                    throw new util.Fail(util.format("variable never declared: %s",k));
            });
        },
        visitProgram:             function(path) {this.doVars(path);},
        visitFunctionExpression:  function(path) {this.doVars(path);},
        visitFunctionDeclaration: function(path) {this.doVars(path);}
    });
    return chrjs;
}

function mangleIdentifier(name) {
    assert.strictEqual(typeof name,'string');
    return name+'_';
}
function unmangleIdentifier(id) {
    return id.attrs ? id.attrs.was : id.name; // allow for genned ids without attrs
}
function mangle(js) {           // `js` must have been previously annotated
    js = deepClone(js);
    js = parser.visit(js,{
        doVars:                   function(path) {
            for (var v in path.node.attrs.vars)
                path.node.attrs.vars[v].mangled = mangleIdentifier(v);
            this.traverse(path);
        },
        visitIdentifier:          function(path) {
            if (path.node.name[0]!=='%') { // ignore generated identifiers
                var vattrs = findVar(path.node.name,path);
                if (!vattrs)
                    throw new util.Fail(util.format("var %s not found",path.node.name));
                if (!vattrs.bound && !vattrs.declared && !vattrs.ext)
                    throw new util.Fail(util.format("var %s gets no value",path.node.name));
                if (vattrs.ext) {
                    if (vattrs.mangle) {
                        path.node.attrs.was = path.node.name;
                        path.node.name      = vattrs.mangle;
                    }
                } else {
                    path.node.attrs.was = path.node.name;
                    path.node.name      = mangleIdentifier(path.node.name);
                    assert.strictEqual(path.node.name,vattrs.mangled);
                }
            }
            return false;
        },
        visitProgram:             function(path) {return this.doVars(path);},
        visitCatchClause:         function(path) {return this.doVars(path);},
        visitRuleStatement:       function(path) {return this.doVars(path);},
        visitQueryStatement:      function(path) {return this.doVars(path);},
        visitQueryWhereStatement: function(path) {return this.doVars(path);},
        visitSnapExpression:      function(path) {return this.doVars(path);},
        visitWhereExpression:     function(path) {return this.doVars(path);}, // not used yet
        visitFunctionExpression:  function(path) {return this.doVars(path);},
        visitFunctionDeclaration: function(path) {return this.doVars(path);},
        visitStoreExpression:     function(path) {return this.doVars(path);},
        visitStoreDeclaration:    function(path) {return this.doVars(path);},
        visitProperty:            function(path) {
            this.visit(path.get('value'));
            return false;
        },
        visitMemberExpression:    function(path) {
            if (path.node.computed)
                this.traverse(path);
            else {
                this.visit(path.get('object'));
                return false
            }
        }
    });
    return js;
}

function insertCode(chrjs,replaces,opts) {
    var js = deepClone(chrjs);
    var rs = {};
    opts = opts || {};
    opts.strict = opts.strict===undefined ? true : !!opts.strict;
    js = parser.visit(js,{
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
        var ds = _.difference(Object.keys(replaces),Object.keys(rs));
        if (ds.length>0)
            throw new Error(util.format("not replaced: %j",ds));
    }
    return js;
}

function Ref(obj,path) {        // a location in a JSON structure +++ replace with `NodePath` +++
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

function genNotEqual(p,q) {
    if (p.type=='Literal' || q.type=='Literal')
        return b.binaryExpression('!==',p,q);
    else
        return b.unaryExpression('!',b.callExpression(bIsEqual,[p,q]));
}

function bWrapFunction(bid,bargs,fn) {
    return b.functionExpression(null,bargs,b.blockStatement([fn(b.callExpression(bid,bargs))]));
}

function genAccessor(x,path) {  //N.B. `path` is not a `NodePath`
    if (path.length===0)
        return x;
    else if ((typeof path[0])==='string')
        return genAccessor(b.memberExpression(x,b.identifier(path[0]),false),path.slice(1));
    else if ((typeof path[0])==='number')
        return genAccessor(b.memberExpression(x,b.literal(path[0]),true),path.slice(1));
    else
        throw new Error(util.format("SNO: %j",path));
}

function genMatch(term,genRest,bIdFact) { // genRest() >> [stmt,...]; returns BlockStatement
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
                rest._leave_names = non_rests.map(function(p){return p.key.name;});
            else {
                var ks = b.callExpression(b.memberExpression(b.identifier('Object'),
                                                             b.identifier('keys'),
                                                             false),
                                          [genAccessor(bIdFact,path)] );
                bools.push(genEqual(b.memberExpression(ks,
                                                       b.identifier('length'),
                                                       false),
                                    b.literal(non_rests.length) ));
            }
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
            } else if (term.id.attrs.boundHere) {
                binds[term.id.name] = sliced;
            } else
                bools.push(genEqual(term,sliced));
            break;
        case 'Identifier':
            if (term.attrs.boundHere)
                binds[term.name] = genAccessor(bIdFact,path);
            else
                bools.push(genEqual(term,genAccessor(bIdFact,path)));
            break;
        case 'MemberExpression': {
            if (term.computed)
                throw new Error("NYI: computed member: %j",term);
            var root;
            for (root=term;root.type==='MemberExpression';root=root.object)
                ;
            assert.strictEqual(root.type,'Identifier');
            if (root.attrs.boundHere) {
                assert.strictEqual(root,term);
                binds[root.object.name] = genAccessor(bIdFact,path);
            } else
                bools.push(genEqual(term,genAccessor(bIdFact,path)));
            break;
        }
        case 'Property': {
            switch (term.kind) {
            case 'bindOne':
                if (term.value.attrs.boundHere)
                    binds[term.value.name] = genAccessor(bIdFact,path);
                else
                    bools.push(genEqual(b.identifier(term.value.name),genAccessor(bIdFact,path)));
                break;
            case 'init':
                visit(term.value,path);
                break;
            case 'bindRest':
                if (path.length===0)
                    throw new Error("ellipsis operator not valid here");
                var bRest = b.callExpression(bProp(b.identifier('_'),'omit'),
                                             [genAccessor(bIdFact,path.slice(0,path.length-1))].concat(
                                                 term._leave_names.map(function(n){return b.literal(n);}) ) );
                if (term.value.attrs.boundHere)
                    binds[term.value.name] = bRest;
                else
                    bools.push(genEqual(b.identifier(term.value.name),bRest));
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
    what = what || 'Program';

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

    var genForFactsIndexVariable = function(item,bv) {
        return (item.rank) ? b.identifier(bv.name+'S') : b.identifier(bv.name+'x');
    };
    var itemExprIsIndexed = function(item) {
        return (item.expr.type==='ArrayExpression'            &&
                item.expr.elements.length>0                   &&
                item.expr.elements[0].type==='Literal'        &&
                (typeof item.expr.elements[0].value)==='string');
    };
    var genForFacts = function(item,bv,body) { // >> [Statement]
        var bvx = genForFactsIndexVariable(item,bv);
        if (item.rank) {
            var        bSort = deepClone(templates['sort'].body);
            var bvCandidates = b.identifier(bv.name+'Candidates');
            bSort = parser.visit(bSort,{
                visitIdentifier: function(path) {
                    switch (path.node.name) {
                    case 'SORTED':
                        path.replace(bvCandidates);
                        break;
                    case 'T':
                        path.replace(bv);
                        break;
                    case 'S':
                        path.replace(bvx);
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
                            path.replace(genMatch(item.expr,function(){
                                return [b.expressionStatement(
                                    b.callExpression(b.memberExpression(bvCandidates,
                                                                        b.identifier('push'),
                                                                        false),
                                                     [b.arrayExpression([item.rank,bv])] ) )];
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
        } else if (itemExprIsIndexed(item)) {
            var   bx = b.binaryExpression('+',
                                          b.literal(''),
                                          b.memberExpression(b.memberExpression(b.identifier('index'),
                                                                                item.expr.elements[0],
                                                                                true),
                                                             bvx,
                                                             true) );
            var bidv = b.memberExpression(b.identifier('index'),item.expr.elements[0],true);
            return [b.forStatement(b.variableDeclaration('var',[b.variableDeclarator(bvx,b.literal(0))]),
                                   b.logicalExpression(
                                       '&&',
                                       bidv,
                                       b.binaryExpression('<',
                                                          bvx,
                                                          b.memberExpression(bidv,
                                                                             b.identifier('length'),
                                                                             false) ) ),
                                   b.updateExpression('++',bvx,true),
                                   b.blockStatement([
                                       b.variableDeclaration('var',[b.variableDeclarator(bv,bx)]),
                                       body]) )];
        } else {
            return [b.forInStatement(b.variableDeclaration('var',[b.variableDeclarator(bv,null)]),
                                     b.identifier('facts'),
                                     body,
                                     false)];
        }
    };
    var genBack1 = function(item,bv) { // gen code to go back one step in `genForFacts` iteration
        assert.equal(bv.type,'Identifier');
        return b.expressionStatement(b.updateExpression('--',genForFactsIndexVariable(item,bv),true));
    };
    var genFFwd = function(item,bv) { // gen code to go to end of `genForFacts` iteration
        assert("M-".indexOf(item.op)!==-1);
        assert.equal(bv.type,'Identifier');
        var bvx = genForFactsIndexVariable(item,bv);
        var end = itemExprIsIndexed(item) ?
            b.memberExpression(b.memberExpression(b.identifier('index'),
                                                  item.expr.elements[0],
                                                  true),
                               b.identifier('length'),
                               false) :
            b.memberExpression(b.identifier('facts'),
                               b.identifier('length'),
                               false);
        return b.expressionStatement(b.assignmentExpression('=',bvx,end));
    };

    var visitSnapExpressionAndCompile = function(path) {
        var qjs = genSnap(path.node,[]);
        path.replace(b.callExpression(qjs,[]));
        return false;
    };

    var genAdd = function(x) {
        return parser.visit(deepClone(x),{
            visitSnapExpression: visitSnapExpressionAndCompile
        });
    };

    var genRuleVariant = function(chr,i,genPayload) {
        var bIdFact = b.identifier('fact');
        var addenda = [];
        var delenda = [];
        var      bv = function(item_id) {return b.identifier('t'+item_id);};
        var genItem = function(item_id,fixed_item,next) { // >> [Statement,...]
            var    js;
            var next1 = (item_id<chr.items.length-1) ?
                    function(){return genItem(item_id+1,fixed_item,next);} : next;
            var   js1;
            switch (chr.items[item_id].op) {
            case '-':
                delenda.push(item_id);
                // FALLTHROUGH
            case 'M':
                js1 = genMatch(chr.items[item_id].expr,next1,bIdFact).body;
                break;
            case '?':
                js1 = [b.ifStatement(chr.items[item_id].expr,b.blockStatement(next1()),null)];
                break;
            case 'O':
                var expr = chr.items[item_id].expr;
                expr = parser.visit(expr,{visitSnapExpression:visitSnapExpressionAndCompile});
                js1  = [b.expressionStatement(expr)].concat(next1());
                break;
            case '=': {
                var expr = chr.items[item_id].expr;
                if (expr.left.type!=="Identifier")
                    throw new Error(util.format("can't bind to non-variable: %j",expr.left));
                expr = parser.visit(expr,{visitSnapExpression:visitSnapExpressionAndCompile});
                js1  = [b.expressionStatement(expr)].concat(next1());
                break;
            }
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
                js1.unshift(b.expressionStatement(b.assignmentExpression(
                    '=',
                    bIdFact,
                    b.memberExpression(b.identifier('facts'),
                                       bv(item_id),
                                       true) )));
                js = genForFacts(chr.items[item_id],bv(item_id),genCheckInPlay(js1,bv(item_id)));
            } else
                js = js1;
            return js;
        };

        genPayload = genPayload || function() { // >> [Statement]
            var payload = [];
            var bailOut = false;
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
                                     [b.literal('queue-rule'),
                                      b.literal(unmangleIdentifier(chr.id)),
                                      b.arrayExpression(vars) ] ) ));
            }
            delenda.forEach(function(j) {
                var bvj = i===j ? b.identifier('t_fact') : bv(j);
                payload.push(b.expressionStatement(
                    b.callExpression(b.identifier('_del'),[bvj]) ));
                if (i===j)
                    bailOut = true;
                else {
                    var back1 = genBack1(chr.items[j],bvj);
                    if (back1)
                        payload.push(back1);
                }
            });
            addenda.forEach(function(j) {
                payload.push(b.expressionStatement(
                    b.callExpression(b.identifier('_add'),[genAdd(chr.items[j].expr)]) ) );
            });
            if (exports.debug) // mark the effective end of this rule's processing
                payload.push(b.expressionStatement(
                    b.callExpression(b.memberExpression(b.identifier('ee'),
                                                        b.identifier('emit'),
                                                        false),
                                     [b.literal('finish-rule'),
                                      b.literal(unmangleIdentifier(chr.id)) ] ) ));
            // if we have deleted t_fact, return immediately as we can't match it again
            if (bailOut)
                payload.push(b.returnStatement(null));
            else if (delenda.length>0) {
                // gen code to fast-forward all iterations nested below this +++
                for (var j=_.min(delenda)+1;j<chr.items.length;j++)
                    if (i!==j && "M-".indexOf(chr.items[j].op)!==-1)
                        payload.push(genFFwd(chr.items[j],bv(j)));
            }
            return payload;
        };

        assert.strictEqual(templates['rule'].body.length,1);
        var    js = deepClone(templates['rule'].body[0].declarations[0].init);
        var binds = Object.keys(chr.attrs.vars)
            .filter(function(k){return !chr.attrs.vars[k].inherited && k[0]!=='%'})
            .map(function(k){return chr.attrs.vars[k].mangled;});
        var js1 = genItem(0,i,genPayload);
        js1.unshift(b.variableDeclaration('var',
                                          binds.map(function(v) {
                                              return b.variableDeclarator(b.identifier(v),null);
                                          }) ));
        js = parser.visit(js,{
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

        var rv = genRuleVariant(chr,null,function() {
            return [b.expressionStatement(b.assignmentExpression('=',chr.init.left,chr.accum))];
        });

        rv.params = args;
        if (exports.debug) {
            rv.body.body.push(b.expressionStatement(
                b.callExpression(b.memberExpression(b.identifier('ee'),
                                                    b.identifier('emit'),
                                                    false),
                                 [b.literal('query-done'),b.literal(unmangleIdentifier(chr.id))] ) ));
        }
        rv.body.body.push(b.returnStatement(chr.init.left));
        rv = parser.visit(rv,{       // remove query args and accum variable from binding site decls
            visitVariableDeclarator: function(path) {
                var decl = path.node;
                if (decl.id.name===chr.init.left.name ||
                    _.any(args,function(bId){return bId.name===decl.id.name}) )
                    // +++ maybe also remove outer function params? +++
                    path.replace();
                return false;
            }
        });
        // +++
        rv.body.body.unshift(b.variableDeclaration('var',[b.variableDeclarator(chr.init.left,chr.init.right)]));

        return rv;
    };

    var genSnap = function(chr,args) {
        // a snap is a hacked-up rule.  CBB?
        var bVarAccum = b.identifier('accum');
        for (var item in chr.items)
            if (item.op=='+' || item.op=='-')
                throw new util.Fail("for expression must not modify the store");

        var rv = genRuleVariant(chr,null,function() {
            chr.accum = parser.visit(chr.accum,{ // handle nested for-expressions
                visitSnapExpression: function(path) {
                    var qjs = genSnap(path.node,[]);
                    path.replace(b.callExpression(qjs,[]));
                    this.traverse(path);
                } });
            return [b.expressionStatement(b.assignmentExpression('=',
                                                                 bVarAccum,
                                                                 b.callExpression(chr.accum,[bVarAccum]) ))];
        });

        rv.params = args;
        if (exports.debug) {
            rv.body.body.push(b.expressionStatement(
                b.callExpression(b.memberExpression(b.identifier('ee'),
                                                    b.identifier('emit'),
                                                    false),
                                 [b.literal('for-done'),b.literal(unmangleIdentifier(chr.id))] ) ));
        }
        rv.body.body.push(b.returnStatement(bVarAccum));
        rv = parser.visit(rv,{       // remove query args from binding site decls
            visitVariableDeclarator: function(path) {
                var decl = path.node;
                if (_.any(args,function(bId){return bId.name===decl.id.name}))
                    // +++ maybe also remove outer function params? +++
                    path.replace();
                return false;
            }
        });
        // +++
        rv.body.body.unshift(b.variableDeclaration('var',[b.variableDeclarator(bVarAccum,chr.init)]));

        return rv;
    };

    var genStore = function(path) {
        var storeCHR = path.node;
        // generate a JS `function` to implement a CHRJS `store`
        var  findTag = function(t) {
            return Ref.flatAt(storeJS.callee.body.body,
                              function(x){return x.type==='ExpressionStatement' && x.expression.name===t;} );
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
            } else {
                Object.keys(dispatchBranches).forEach(function(tag) {
                    dispatchBranches[tag].push([r,i]);
                });
                dispatchGeneric.push([r,i]);
            }
        };

        for (var i=0,r=0;i<storeCHR.body.length;i++) {
            switch (storeCHR.body[i].type) {
            case 'RuleStatement': {
                var variants = [];
                var      chr = storeCHR.body[i];
                for (var j=0;j<chr.items.length;j++) {
                    if (chr.items[j].op=='-' || chr.items[j].op=='M') {
                        noteDispatch(chr.items[j].expr,r,variants.length);  // variants.length will be...
                        variants.push(genRuleVariant(deepClone(chr),j));    // ...allocated now
                    }
                }
                code.rules.push(b.arrayExpression(variants));
                r++;
                break;
            }
            case 'QueryStatement': {
                code.queries[storeCHR.body[i].id.attrs.was] = genQuery(storeCHR.body[i],storeCHR.body[i].args);
                break;
            }
            case 'FunctionDeclaration': { // never a FunctionExpression (must be top level in `store`, no `var`)
                var funjs = deepClone(storeCHR.body[i]);
                var  name = funjs.id.attrs.was;
                funjs = parser.visit(funjs,{
                    visitSnapExpression: function(path) {
                        path.replace(b.callExpression(genSnap(path.node,[]),[]));
                        return false;
                    }
                });
                path.replace();
                funjs.type         = 'FunctionExpression';
                funjs.id           = null;
                code.queries[name] = funjs;
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

        var bQueryReturn = function(bq) {
            return b.returnStatement(b.objectExpression([b.property('init',
                                                                    b.identifier('t'),
                                                                    b.identifier('t') ),
                                                         b.property('init',
                                                                    b.identifier('result'),
                                                                    bq) ]));
        };
        findTag('INSERT_RULES').insertAfter(b.variableDeclaration('var',[
            b.variableDeclarator(b.identifier('rules'),
                                 b.arrayExpression(code.rules))
        ] ));
        findTag('INSERT_QUERIES').insertAfter(b.variableDeclaration('var',[
            b.variableDeclarator(b.identifier('queries'),
                                 b.callExpression(b.functionExpression(
                                     null,
                                     [],
                                     b.blockStatement([
                                         b.variableDeclaration('var',
                                                               Object.keys(code.queries).map(function(k) {
                                                                   return b.variableDeclarator(
                                                                       b.identifier(k),
                                                                       code.queries[k]); }) ),
                                         b.returnStatement(b.objectExpression(
                                             Object.keys(code.queries).map(function(k) {
                                                 return b.property(
                                                     'init',
                                                     b.identifier(k),
                                                     bWrapFunction(b.identifier(k),
                                                                   code.queries[k].params,
                                                                   bQueryReturn) ); }) )) ]) ),
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
        if (Object.keys(dispatchBranches).length>128)
            console.log("Warning: more than 128 cases in switch statement");
        var _addSwitch = _addDef.declarations[0].init.body.body[0].consequent.body[7];
        assert.equal(_addSwitch.type,'SwitchStatement');
        assert.equal(_addSwitch.cases.length,1);
        assert.equal(_addSwitch.cases[0].test.name,'INSERT_CASE');
        _addSwitch.cases.shift(); // we have now found and extracted the case INSERT_CASE from the template
        for (var k in dispatchBranches) {
            var brs = dispatchBranches[k].map(function(br){return genInvokeRuleItem(br);});
            _addSwitch.cases.push(b.switchCase(b.literal(k),brs.concat(b.breakStatement())));
        }
        {
            var brs = dispatchGeneric.map(function(br){return genInvokeRuleItem(br);});
            _addSwitch.cases.push(b.switchCase(null,brs.concat(b.breakStatement())));
        }

        storeJS = parser.visit(storeJS,{  // remove any `var;` that we have generated
            visitVariableDeclaration: function(path) {
                this.traverse(path);
                if (path.node.declarations.length===0)
                    path.replace();
            },
            visitSnapExpression:      function(path) {
                throw new util.Fail(util.format("unexpected for-expression"));
            }
        });

        return storeJS;
    };

    switch (what) {
    case 'Program': {
        js = annotateParse2(annotateParse1(js));
        js = mangle(js);
        parser.namedTypes.Program.assert(js);
        js = parser.visit(js,{
            visitProgram: function(path) {
                path.node.body.unshift(b.variableDeclaration('var',[
                    b.variableDeclarator(b.identifier('_'),
                                         b.callExpression(b.identifier('require'),
                                                          [b.literal('underscore')] ) ) ]));
                path.node.body.unshift(b.expressionStatement(b.literal("use strict")));
                this.traverse(path);
            },
            visitStoreDeclaration: function(path) {
                var st = genStore(path);
                if (path.node.id===null)
                    path.replace(b.expressionStatement(st));
                else
                    path.replace(b.variableDeclaration('var',[
                        b.variableDeclarator(path.node.id,st) ]));
                return false;
            },
            visitStoreExpression: function(path) {
                path.replace(genStore(path));
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

    var bindRest = null;
    js = parser.visit(js,{ // post-processing
        visitBinaryExpression: function(path){
            if (path.node.operator=='==') {
                warnOnce("== and != test for deep equality, not the javascript horror");
                path.replace(genEqual(path.node.left,path.node.right));
            } else if (path.node.operator=='!=') {
                warnOnce("== and != test for deep equality, not the javascript horror");
                path.replace(genNotEqual(path.node.left,path.node.right));
            }
            this.traverse(path);
        },
        visitObjectExpression: function(path) {
            var bRsave = bindRest;
            bindRest = false;
            this.traverse(path);
            if (bindRest){
                var chunks = [];
                var  chunk = [];
                for (var i=0;i<path.node.properties.length;i++) {
                    var pr = path.node.properties[i];
                    if (pr.kind==='bindRest') {
                        if (chunk.length>0) {
                            chunks.push(b.objectExpression(chunk));
                            chunk = [];
                        }
                        chunks.push(pr.value);
                    } else
                        chunk.push(pr);
                }
                if (chunk.length>0)
                    chunks.push(b.objectExpression(chunk));
                path.replace(b.callExpression(b.memberExpression(b.identifier('Object'),
                                                                 b.identifier('assign'),
                                                                 false),
                                              [b.objectExpression([])].concat(chunks) ) );
            }
            bindRest = bRsave;
        },
        visitProperty: function(path) {
            var prop = path.node;
            if (prop.kind==='bindRest') {
                if (prop.value===null)
                    throw new Error("anonymous ellipsis in value expression");
                bindRest = true;
            }
            this.traverse(path);
        },
        visitArrayExpression: function(path) {
            var bRsave = bindRest;
            bindRest = null;
            this.traverse(path);
            if (bindRest!==null) {
                var chunks = [];
                var  chunk = [];
                for (var i=0;i<path.node.elements.length;i++) {
                    var el = path.node.elements[i];
                    if (el.type==='BindRest') {
                        if (chunk.length>0) {
                            chunks.push(b.arrayExpression(chunk));
                            chunk = [];
                        }
                        chunks.push(el.id);
                    } else
                        chunk.push(el);
                }
                if (chunk.length>0)
                    chunks.push(b.arrayExpression(chunk));
                var rep = b.callExpression(b.memberExpression(b.arrayExpression([]),
                                                              b.identifier('concat'),
                                                              false),
                                           chunks );
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
    });

    return js;
}

exports.compile = generateJS;

exports.debug   = false;

var ruleMaps = {};              // <path> -> <rule-id> -> <loc> ...

exports.getRuleMap = function(p) {
    if (!exports.debug)
        throw new Error("ruleMap building off");
    return ruleMaps[path.resolve(p)];
};

function buildRuleMap(parsed) {
    var ruleMap = {};
    parsed = parser.visit(parsed,{
        visitRuleStatement: function(p) {
            ruleMap[p.node.id.name] = p.node.loc;
            this.traverse(p);
        }
    });
    return ruleMap;
}

var stanzas = {};               // <path> -> <stanzas>,...

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

function buildStanzas(code,parsed) {
    assert(code.search('\t')===-1,"code should be tab-free");
    var  lines = [""].concat(code.split('\n')); // make zero-based
    var lines1 = lines.map(function(s) {
        return Array(s.length).join(' ');       // initially a blank copy
    });
    var    stanzas = [];
    var    sources = {};                        // {<line>:{<column>:<source>,...},...}
    var noteSource = function(node,node1) {
        if (node1===undefined)
            node1 = node;
        for (var l=node.loc.start.line;l<=node.loc.end.line;l++) {
            if (sources[l]===undefined)
                sources[l] = {};
            sources[l][node.loc.start.column] = node1;
            break;              // !!! playing around here
        }
    };

    if (parsed===undefined)
        parsed = parser.parse(code,{loc:true,attrs:true});
    var currentRule;
    var ruleColours = {};       // <ruleName> -> <identifier> -> <tag>
    var   idColours = '0123456';
    var     idAlloc = 0;
    var       isVar = true;
    parsed = parser.visit(parsed,{
        visitRuleStatement: function(path) {
            var node = path.node;
            for (var i=0;i<'rule'.length;i++)
                lines1[node.loc.start.line] = setCharAt(lines1[node.loc.start.line],node.loc.start.column+i,'R');
            noteSource(node);
            currentRule = node;
            ruleColours[currentRule.id.name] = {};
            this.traverse(path);
            currentRule = null;
        },
        visitQueryStatement: function(path) {
            var node = path.node;
            for (var i=0;i<'query'.length;i++)
                lines1[node.loc.start.line] = setCharAt(lines1[node.loc.start.line],node.loc.start.column+i,'Q');
            noteSource(node);
            currentRule = node;
            this.traverse(path);
            currentRule = null;
        },
        visitQueryWhereStatement: function(path) {
            return visitQueryStatement(path);
        },
        visitItemExpression: function(path) {
            var node = path.node;
            for (var l=node.loc.start.line;l<=node.loc.end.line;l++)
                for (var c=node.loc.start.column;c<node.loc.end.column;c++) {
                    lines1[l] = setCharAt(lines1[l],c,node.op);
                }
            noteSource(node,currentRule);
            this.traverse(path);
        },
        visitProperty:   function(path) {
            var save = {isVar:isVar};
            isVar = false;
            this.visit(path.get('key'));
            isVar = save.isVar;
            this.visit(path.get('value'));
            return false;
        },
        visitMemberExpression: function(path) {
            var save = {isVar:isVar};
            this.visit(path.get('object'));
            isVar = path.node.computed;
            this.visit(path.get('property'));
            isVar = save.isVar;
            return false;
        },
        visitIdentifier: function(path) {
            var node = path.node;
            var name = node.name;
            if (currentRule && node.loc) {
                var colours = ruleColours[currentRule.id.name];
                var  colour = colours[name];
                if (!isVar)
                    colour = 'F';
                else if (colour===undefined) {
                    if (Object.keys(colours).length<idColours.length) {
                        colour   = ruleColours[currentRule.id.name][name] = idColours[idAlloc++];
                        idAlloc %= idColours.length;
                    } else {
                        console.log("no colour left in %s for: %s",currentRule.id.name,name);
                        colour = 'I'
                    }
                }
                for (var l=node.loc.start.line;l<=node.loc.end.line;l++)
                    for (var c=node.loc.start.column;c<node.loc.end.column;c++) {
                        lines1[l] = setCharAt(lines1[l],c,colour);
                    }
                noteSource(node,currentRule);
            }
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
                if (sources[stanza.line+l]) {
                    if (sources[stanza.line+l][c]!==undefined)
                        stanza.draws.push({node:sources[stanza.line+l][c],
                                           ch:ch,
                                           x:c,
                                           y:l1,
                                           n:n+1});
                    else
                        console.warn("can't find node for stanza %s %d line %d:%d",stanza.tag,stanza.line,l,c);

                }
                else
                    console.warn("can't find draw for stanza %s %d line %d",stanza.tag,stanza.line,l);
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
    var content = fs.readFileSync(filename,'utf8').replace(/\t/g,'        '); // remove tabs
    var   chrjs = parser.parse(content,{loc:exports.debug,attrs:true});
    if (exports.debug) {
        //stanzas[filename] = buildStanzas(content,chrjs); // +++ clone the parse! +++
        ruleMaps[filename] = buildRuleMap(chrjs);
    }
    module._compile(recast.print(generateJS(chrjs)).code,filename);
    ee.emit('compile',filename);
};

if (util.env==='test') {
    exports._private = {
        Ref:               Ref,
        mangleIdentifier:  mangleIdentifier,
        mangle:            mangle,
        genAccessor:       genAccessor,
        genAdd:            function(chrjs) {return generateJS(chrjs,'add');},
        genEqual:          genEqual,
        genMatch:          genMatch,
        buildStanzas:      buildStanzas,
        insertCode:        insertCode,
        annotateParse1:    annotateParse1,
        annotateParse2:    annotateParse2
    };
}
