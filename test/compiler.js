/*eslint-disable strict,no-eval,no-var*/
//N.B. "use strict" breaks the test environment and can't use ES6
//     stuff without it, so leave this sadly old and under-checked.

var compiler = require('../compiler.js');
var   parser = require('../parser.js');
var   assert = require('assert').strict;
var   recast = require("recast");
var     util = require('../util.js');
var     temp = require('temp');
var     path = require('path');
var       fs = require('fs');
var        _ = require('underscore'); // eslint-disable-line no-unused-vars

var        b = recast.types.builders;

temp.track();

var parse = function(code) {
    return parser.parse(code,{attrs:true});
};

var mangleId = compiler._private.mangleIdentifier;

function findById(js,name,mangled) {    // find subtree of `js` with id `name`
    var ans = null;
    if (mangled)
        name = mangleId(name);
    parser.visit(js,{
        visitIdentifier:function(p) {
            if (p.node.name===name && p.parent.get('id')===p)
                ans = p.parent.node;
            return false;
        }
    });
    return ans;
}

var parseItem = function(code) {
    var  ast = compiler._private.annotateParse2(compiler._private.annotateParse1(parse("store{rule RULE1("+code+");}")));
    var rule = findById(ast,'RULE1');
    assert.strictEqual(rule.items.length,1);
    return rule.items[0].expr;
};

var compile = function(code) {
    if ((typeof code)==='string')
        code = parse(code);
    return compiler.compile(code);
};

describe("Ref",function() {
    var Ref = compiler._private.Ref;
    it("should capture site in an Array",function() {
        var arr = [1,2,3,4];
        var ref = new Ref(arr,[2]);
        assert.deepEqual(ref.get(),3);
        ref.set('three');
        assert.deepEqual(arr,[1,2,'three',4]);
        ref.insertAfter('7/2');
        assert.deepEqual(arr,[1,2,'three','7/2',4]);
        ref.next();
        ref.insertAfter('15/4');
        assert.deepEqual(arr,[1,2,'three','7/2','15/4',4]);
        assert.deepEqual(Ref.flatAt(arr,function(x){return x==='7/2';}).cut(),'7/2');
        assert.deepEqual(arr,[1,2,'three','15/4',4]);
    });
    it("should capture site in an Object",function() {
        var obj = {a:1,b:2,c:3};
        var ref = new Ref(obj,['c']);
        assert.deepEqual(ref.get(),3);
        ref.set('three');
        assert.deepEqual(obj,{a:1,b:2,c:'three'});
    });
    it("should capture sites in nested structures",function() {
        var   x = ['a',{p:3,q:4,r:5,s:[100]}];
        var ref = new Ref(x,[1,'s',0]);
        assert.deepEqual(ref.get(),100);
        ref.set('sto');
        assert.deepEqual(x,['a',{p:3,q:4,r:5,s:['sto']}]);
        assert.deepEqual(ref.get(),'sto');
    });
});

describe("genAccessor",function() {
    var genAccessor = compiler._private.genAccessor;
    it("should generate code to access array elements",function() {
        assert.strictEqual(recast.print(genAccessor(b.identifier('wibble'),[1,2,3,4])).code,"wibble[1][2][3][4]");
    });
    it("should generate code to access object properties",function() {
        assert.strictEqual(recast.print(genAccessor(b.identifier('wobble'),['a','b','c'])).code,"wobble.a.b.c");
    });
    it("should generate code to access both",function() {
        assert.strictEqual(recast.print(genAccessor(b.identifier('wubble'),['a',7,'c',0])).code,"wubble.a[7].c[0]");
    });
});

function literalise(x) {
    if (Array.isArray(x))
        return b.arrayExpression(x.map(literalise));
    else if ((typeof x)==='object' && x!==null)
        return b.objectExpression(Object.keys(x).map(function(k) {
            return b.property('init',
                              b.identifier(k),
                              literalise(x[k]) );
        }));
    else
        return b.literal(x);
}

describe("equality test the compiler generates",function() {
    var eq = function(p,q) {
        // generate and eval equality testing code.  A call to `deepClone` gives non-identity
        var p1 = parse(util.format('var x=%j;',p)).body[0].declarations[0].init;
        var q1 = parse(util.format('var x=util.deepClone(%j);',q)).body[0].declarations[0].init;
        return eval(recast.print(compiler._private.genEqual(p1,q1)).code);
    };
    it("should not treat strings and numbers as comparable",function() {
        assert.equal(false,eq(0,'0'));
        assert.equal(false,eq(2,'2'));
    });
    it("should compare strings by value",function() {
        assert.equal(true,eq('0','0'));
    });
    it("should compare strings case-sensitively",function() {
        assert.equal(false,eq('a','A'));
    });
    it("should compare arrays",function() {
        assert.equal(true,eq(['0',1,'two'],['0',1,'two']));
    });
    it("should compare objects",function() {
        assert.equal(true,eq({p:1,q:2},{p:1,q:2}));
    });
    it("should compare deeply",function() {
        assert.equal(true,eq({p:1,q:[2]},{p:1,q:[2]}));
    });
    it("should compare deeply -vely",function() {
        assert.equal(false,eq({p:1,q:[2]},{p:1,q:['2']}));
    });
});

describe("genAdd",function() {
    var  genAdd = compiler._private.genAdd;
    var evalAdd = function(add,bindings) {
        if (bindings===undefined)
            bindings = {};
        var   ks = Object.keys(bindings);
        var code = recast.print(b.callExpression(b.functionExpression(null,
                                                                      ks.map(function(k){return b.identifier(k);}),
                                                                      b.blockStatement([b.returnStatement(add)]) ),
                                                 ks.map(function(k){return literalise(bindings[k]);}) )).code;
        return eval(code);
    };
    it("should have sane test infrastructure",function() {
        assert.deepEqual([1,2,3],evalAdd(parseItem("[1,2,3]")));
        assert.deepEqual([1,2,4],evalAdd(parseItem("[1,2,a]"),{a:4}));
    });
    it("should generate code for an array pattern",function() {
        var add = genAdd(parseItem("['a',b,...c]"));
        assert.deepEqual(['a',6,56,57],evalAdd(add,{b:6,c:[56,57]}));
    });
    it("should generate code for a nested array pattern",function() {
        var add = genAdd(parseItem("[['a',b,...c]]"));
        assert.deepEqual([['a',6,56,57]],evalAdd(add,{b:6,c:[56,57]}));
    });
    it("should generate code for an object pattern",function() {
        var add = genAdd(parseItem("{a:1,...rs}"));
        assert.deepEqual({a:1,b:2,c:3},evalAdd(add,{rs:{b:2,c:3}}));
    });
    it("should generate code for a nested object pattern",function() {
        var add = genAdd(parseItem("{k:{a:1,...rs}}"));
        assert.deepEqual({k:{a:1,b:2,c:3}},evalAdd(add,{rs:{b:2,c:3}}));
    });
    it("should generate code for an object-in-array pattern",function() {
        var add = genAdd(parseItem("[{a:1,...rs}]"));
        assert.deepEqual([{a:1,b:4,c:5}],evalAdd(add,{rs:{b:4,c:5}}));
    });
    it("should generate code for an array-in-object pattern",function() {
        var add = genAdd(parseItem("{p:[a,b,c]}"));
        assert.deepEqual({p:['a','b','c']},evalAdd(add,{a:'a',b:'b',c:'c'}));
    });
});

describe("genMatch",function() {
    var  genMatch = compiler._private.genMatch;
    var evalMatch = function(match,fact) {
        var code = (recast.print(b.callExpression(b.functionExpression(null,[b.identifier('fact')],match),
                                                  [fact] )).code);
        return eval(code);
    };
    it("should generate match code for simple array patterns",function() {
        var match = genMatch(parseItem("['a','b',c]"),
                             function(){return [b.returnStatement(b.identifier('c'))];} );
        assert.equal(17,evalMatch(match,parseItem("['a','b',17]") ) );
    });
    it("should generate match code for final ... array patterns",function() {
        var match = genMatch(parseItem("['a','b',...c]"),
                             function(){return [b.returnStatement(b.identifier('c'))];} );
        assert.deepEqual([21,22],evalMatch(match,parseItem("['a','b',21,22]")));
    });
    it("should generate match code for simple object patterns",function() {
        var match = genMatch(parseItem("{a:1, b:2, c}"),
                             function(){return [b.returnStatement(b.identifier('c'))];} );
        assert.equal(117,evalMatch(match,parseItem("{a:1,b:2,c:117}")));
    });
    it("should not over-match",function() {
        var match = genMatch(parseItem("{a:1, b:2, c}"),
                             function(){return [b.returnStatement(b.identifier('c'))];} );
        assert.equal(undefined,evalMatch(match,parseItem("{a:2,b:2,c:117}")));
    });
    it("should generate match code for ... object patterns",function() {
        var match = genMatch(parseItem("{a:1, b:2, ...c}"),
                             function(){return [b.returnStatement(b.identifier('c'))];} );
        assert.deepEqual({c:117,d:118},evalMatch(match,parseItem("{a:1,b:2,c:117,d:118}")));
    });
    it("should generate match code for medial ... array patterns",function() {
        var match = genMatch(parseItem("['a','b',...c,d]"),
                             function(){return [b.returnStatement(b.identifier('c'))];} );
        assert.deepEqual([21],evalMatch(match,parseItem("['a','b',21,22]")));
    });
    it("should generate match code for nested array pattern",function() {
        var match = genMatch(parseItem("[[a]]"),
                             function(){return [b.returnStatement(b.identifier('a'))];} );
        assert.deepEqual(26,evalMatch(match,parseItem("[[26]]")));
    });
    it("should generate match code for array pattern in object expression",function() {
        var match = genMatch(parseItem("{p:[a],...q}"),
                             function(){return [b.returnStatement(b.identifier('a'))];} );
        assert.deepEqual(23,evalMatch(match,parseItem("{\"p\":[23]}")));
    });
    it("should generate match code for ... array pattern in object expression",function() {
        var match = genMatch(parseItem("{p:['a','b',...c],...q}"),
                             function(){return [b.returnStatement(b.identifier('c'))];} );
        assert.deepEqual([23],evalMatch(match,parseItem("{\"p\":['a','b',23]}")));
    });
});

describe("EventEmitter",function() {
    it("should emit `fire` event to `once`",function(){
        var    js = compile("store {rule(-['user',{name:a}]);};");
        var    st = eval(recast.print(js).code);
        var fired = false;
        st.once('fire',function(store,fact,adds,dels){
            fired = true;
            assert.deepEqual(fact,['user',{'name':'sid'}]);
            assert.equal(adds.length,0); // no nett adds...
            assert.equal(dels.length,0); // ... or deletes
            assert.equal(store.size,0);
        });
        st.add(['user',{'name':'sid'}]);
        assert(fired);
        fired = false;
        st.add(['user',{'name':'james'}]);
        assert(!fired);
    });
    it("should emit `fire` event to `on`",function(){
        var    js = compile("store {rule(-['user',{name:a}]);};");
        var    st = eval(recast.print(js).code);
        var fired = false;
        st.on('fire',function(store,fact,adds,dels){
            fired = true;
            assert.equal(fact[0],'user');
            assert.equal(adds.length,0); // no nett adds...
            assert.equal(dels.length,0); // ...or deletesx
            assert.equal(store.size,0);
        });
        st.add(['user',{'name':'sid'}]);
        assert(fired);
        fired = false;
        st.add(['user',{'name':'james'}]);
        assert(fired);
    });
    it("should emit `on` `queue-rule` event for debugging",function(){
        var cDsave = compiler.debug;
        compiler.debug = true;
        try {
            var    js = compile("store {rule R(-['user',{name:a}]);};");
            var    st = eval(recast.print(js).code);
            var fired = false;
            st.on('queue-rule',function(ruleName,facts){
                assert.strictEqual(ruleName,'R');
                fired = true;
            });
            st.add(['user',{'name':'sid'}]);
            assert(fired);
        } finally {
            compiler.debug = cDsave;
        }
    });
});

describe("parse tree editing",function() {
    var insertCode = compiler._private.insertCode;
    it("should `insertCode` in first position",function() {
        var prs = parser.parse("function fn(){INSERT_CRAP;}");
        var rep = insertCode(prs.body[0],{
            CRAP:b.expressionStatement(b.assignmentExpression('=',b.identifier('a'),b.literal(10)))
        });
        assert.equal(rep.type,'FunctionDeclaration');
        assert.equal(rep.body.type,'BlockStatement');
        assert.equal(rep.body.body[0].type,'ExpressionStatement');
        assert.equal(rep.body.body[0].expression.type,'AssignmentExpression');
    });
    it("should `insertCode` in second position",function() {
        var prs = parser.parse("function fn(){something();INSERT_CRAP;something_else();}");
        var rep = insertCode(prs.body[0],{
            CRAP:b.expressionStatement(b.assignmentExpression('=',b.identifier('a'),b.literal(10)))
        });
        assert.equal(rep.type,'FunctionDeclaration');
        assert.equal(rep.body.type,'BlockStatement');
        assert.equal(rep.body.body[0].type,'ExpressionStatement');
        assert.equal(rep.body.body[0].expression.type,'CallExpression');
        assert.equal(rep.body.body[1].type,'ExpressionStatement');
        assert.equal(rep.body.body[1].expression.type,'AssignmentExpression');
        assert.equal(rep.body.body[2].type,'ExpressionStatement');
        assert.equal(rep.body.body[2].expression.type,'CallExpression');
        assert.equal(rep.body.body.length,3);
    });
    it("should fail to `insertCode` noisily",function() {
        var prs = parser.parse("function fn(){INSERT_CRAP;}");
        assert.throws(function(){insertCode(prs.body[0],{},{strict:true});});
    });
    it("should fail to `insertCode` noisily by default",function() {
        var prs = parser.parse("function fn(){INSERT_CRAP;}");
        assert.throws(function(){insertCode(prs.body[0],{});});
    });
    it("should fail to `insertCode` quietly",function() {
        var prs = parser.parse("function fn(){INSERT_CRAP;}");
        var rep = insertCode(prs.body[0],{},{strict:false});
        assert.equal(rep.type,'FunctionDeclaration');
        assert.equal(rep.body.type,'BlockStatement');
        assert.equal(rep.body.body[0].type,'ExpressionStatement');
        assert.equal(rep.body.body[0].expression.type,'Identifier');
        assert.equal(rep.body.body[0].expression.name,'INSERT_CRAP');
    });
    it("should moan about unused `insertCode` fragments",function() {
        var prs = parser.parse("function fn(){}");
        assert.throws(function(){insertCode(prs.body[0],{CRAP:b.blockStatement([])},{strict:true});});
        assert.throws(function(){insertCode(prs.body[0],{CRAP:b.blockStatement([])});});
    });
});

describe("first pass of new compiler",function() {
    /*eslint-disable dot-notation*/ // vars['a'] makes much more sense than vars.a here
    var pass1 = compiler._private.annotateParse1;
    it("should find variables in simple rule",function() {
        var prs0 = parse("store {rule R (['a',b,{p:c,d,...rs}]);}");
        var prs1 = pass1(prs0);
        assert.deepEqual(findById(prs1,'R').attrs.vars,{b:{},c:{},d:{},rs:{}});
    });
    it("should find variables in multi-item rule",function() {
        var prs0 = parse("store {rule R (c=43,['a',b,c],['p',c]);}");
        var prs1 = pass1(prs0);
        assert.deepEqual(findById(prs1,'R').attrs.vars,{b:{},c:{}});
    });
    it("should find variables in complex expression",function() {
        var prs0 = parse("store {rule R (c=43+s+t+u);}");
        var prs1 = pass1(prs0);
        assert.deepEqual(findById(prs1,'R').attrs.vars,{c:{},s:{},t:{},u:{}});
    });
    it("should not be confused by object field names",function() {
        var prs0 = parse("store {rule R (c=s.t.u);}");
        var prs1 = pass1(prs0);
        assert.deepEqual(findById(prs1,'R').attrs.vars,{c:{},s:{}});
    });
    xit("should give stores disjoint namespaces",function() {
        var prs0 = parse("store st1 {query Q() [a where [['a',{a}]]];};store st2 {query Q() [a where [['a',{a}]]];}");
        pass1(prs0);            // don't want complaint about Q being shadowed
    });
    it("should give unnamed stores disjoint namespaces",function() {
        var prs0 = parse("var st1=store {query Q() [a where [['a',{a}]]];};var st2=store {query Q() [a where [['a',{a}]]];}");
        pass1(prs0);            // don't want complaint about Q being shadowed
    });
    it("should catch misplaced () ",function() {
        assert.throws(function() {
            pass1(parse("1+();"));
        });
    });
    it("should do `out`s after generators and tests",function(){
        var prs1 = pass1(parse("store {rule R (out('haha'),['a']);};"));
        assert.strictEqual(findById(prs1,'R').items[0].op,'M'); // items...
        assert.strictEqual(findById(prs1,'R').items[1].op,'O'); // ...reversed
    });
});

describe("second pass of new compiler",function() {
    var p2 = function (s) {
        return compiler._private.annotateParse2(compiler._private.annotateParse1(parser.parse(s,{attrs:true})));
    };
    it("should find binding site in simple rule",function() {
        var p = p2("store {rule R (b=13);}");
        var r = findById(p,'R');
        assert(r.attrs.vars['b'].bound);
        assert.strictEqual(r.items[0].type,'ItemExpression');
        assert.strictEqual(r.items[0].expr.type,'AssignmentExpression');
        assert.strictEqual(r.items[0].expr.left.attrs.boundHere,true);
    });
    it("should distinguish binding/non-binding sites",function() {
        var r = findById(p2("store {rule R (['a',b],b='a');}"),'R');
        assert(r.attrs.vars['b'].bound);
        assert.strictEqual(r.items.length,2);
        assert.strictEqual(r.items[0].op,'M');
        assert.strictEqual(r.items[0].expr.elements[1].name,'b');
        assert.strictEqual(r.items[0].expr.elements[1].attrs.boundHere,true);
        assert.strictEqual(r.items[1].op,'=');
        assert(!r.items[1].expr.right.attrs.boundHere);
    });
    it("should find binding sites in ObjectExpressions",function() {
        var r = findById(p2("store {rule R (['a',{a:a}]);}"),'R');
        assert.strictEqual(r.items[0].expr.elements[1].properties[0].value.name,'a');
        assert(r.items[0].expr.elements[1].properties[0].value.attrs.boundHere);
    });
    it("should find concise binding sites in ObjectExpressions",function() {
        var r = findById(p2("store {rule R (['a',{a}]);}"),'R');
        assert.strictEqual(r.items[0].expr.elements[1].properties[0].value.name,'a');
        assert(r.items[0].expr.elements[1].properties[0].value.attrs.boundHere);
    });
    it("should find ellipsis binding sites in ArrayExpressions",function() {
        var r = findById(p2("store {rule R (['a',{...as}],['b',as]);}"),'R');
        assert.strictEqual(r.items[0].expr.elements[1].properties[0].value.name,'as');
        assert(r.items[0].expr.elements[1].properties[0].value.attrs.boundHere);
        assert(!r.items[1].expr.elements[1].attrs.boundHere);
    });
    it("should detect more complex unbound variable",function() {
        assert.throws(function() {
            p2("store {rule R (['a',b],b=c);}");
        });
    });
    it("should not complain about function names being unbound",function() {
        p2("function fn(){return 1;};store{rule (a=fn());}");
    });
    it("should not complain about function names being unbound for object refs",function() {
        p2("var _=require('lodash');store{rule (a=_.extend());}");
    });
    it("should not complain about function names being unbound for object refs 2",function() {
        p2("var _=require('lodash');store{rule (['p'],+['a',{a:call({X:_.extend({})})}]);}");
    });
    it("should not complain about constructors being unbound",function() {
        p2("function fn(){return 1;};store{rule (a=new fn());}");
    });
    it("should complain about function args being unbound",function() {
        assert.throws(function() {
            p2("function fn(){return 1;};store{rule (a=fn(b));}");
        });
    });
    it("should believe stores to be declared",function() {
        p2("store st{};st.add([]);");
    });
    xit("should not try to bind parameters in body",function() {
        const q = findById(p2("store {query Q(p) [a where ['a',{p}]];}"),'Q');
        assert.strictEqual(q.type,'QueryStatement');
        assert.strictEqual(q.items[0].expr.elements[1].properties[0].value.name,'p');
        assert(!q.items[0].expr.elements[1].properties[0].value.attrs.boundHere);
    });
    it("handles binding given sort",function(){
        const code = `store {
            rule (-['match-price', {volume:vB,  ...rB}]^rB.t,
                  +['match-price', {volume:vB-1,...rB}] );
        };`
        p2(code);
    });
});

describe("mangle",function() {
    var  mangle = compiler.annotate;
    it("should translate user variable names to something safe",function() {
        var  ast = parse("var a;");
        var ast1 = mangle(ast);
        assert.strictEqual(Object.keys(ast1.attrs.vars).length,1);
        assert.strictEqual(ast1.attrs.vars['a'].mangled,mangleId('a'));
        assert.strictEqual(ast1.attrs.vars['a'].declared,true);
        assert.strictEqual(ast1.attrs.vars['a'].mutable,true);
        assert.strictEqual(ast1.body[0].declarations[0].id.name,mangleId('a'));
        assert.strictEqual(ast1.body[0].declarations[0].id.attrs.was,'a');
    });
    it("should not translate member names in ObjectExpressions",function() {
        var  ast = parse("var a = {p:1};");
        var ast1 = mangle(ast);
        assert.strictEqual(ast1.body[0].declarations[0].id.name,mangleId('a'));
        assert.strictEqual(ast1.body[0].declarations[0].init.properties[0].key.name,'p');
    });
    it("should not translate member names in uncomputed MemberExpressions",function() {
        var  ast = parse("var a = {p:1}.p;");
        var ast1 = mangle(ast);
        var init = ast1.body[0].declarations[0].init;
        assert.strictEqual(ast1.body[0].declarations[0].id.name,mangleId('a'));
        assert.strictEqual(init.type,'MemberExpression');
        assert.strictEqual(init.object.properties[0].key.name,'p');
        assert.strictEqual(init.property.name,'p');
    });
    it("should translate member names in computed MemberExpressions",function() {
        var  ast = parse("var a='p';var b={p:1}[a];");
        var ast1 = mangle(ast);
        var init = ast1.body[1].declarations[0].init;
        assert.strictEqual(ast1.body[1].declarations[0].id.name,mangleId('b'));
        assert.strictEqual(init.type,'MemberExpression');
        assert.strictEqual(init.object.properties[0].key.name,'p');
        assert.strictEqual(init.property.name,mangleId('a'));
    });
    it("should translate function names",function() {
        var ast = mangle(parse("function fred(a) {return a;}"));
        assert.strictEqual(ast.body[0].id.name,mangleId('fred'));
    });
    it("should translate function declaration args",function() {
        var ast = mangle(parse("function fn(f){return f[0];}"));
        assert.strictEqual(ast.body[0].id.name,mangleId('fn'));
        assert.strictEqual(ast.body[0].params[0].name,mangleId('f'));
    });
    it("should translate function expression args",function() {
        var ast = mangle(parse("var a = function (f){return f[0];}"));
        assert.strictEqual(ast.body[0].declarations[0].init.params[0].name,mangleId('f'));
    });
    it("should translate nested function expression args",function() {
        //var ast = mangle(parse("[].map(function (f){return f[0];}).sort();"));
        // +++
    });
    it("should not translate known global names",function() {
        var ast = mangle(parse("var lib = require('lib');"));
        assert.strictEqual(ast.body[0].declarations[0].id.name,mangleId('lib'));
        assert.strictEqual(ast.body[0].declarations[0].init.callee.name,'require');
    });
    it("should balk at unknown global function names",function() {
        assert.throws(function() {
            mangle(parse("var tsne = thisShouldNotExist();"));
        });
    });
    it("should balk at unknown global variable names",function() {
        assert.throws(function() {
            mangle(parse("var tsne = thisShouldNotExist;"));
        });
    });
    it("should mangle array expression rest var names",function() {
        var ast = mangle(parse("store {rule R (['a',...xs]);}"));
        assert.strictEqual(findById(ast,'R',true).items[0].expr.elements[1].type,'BindRest');
        assert.strictEqual(findById(ast,'R',true).items[0].expr.elements[1].id.name,mangleId('xs'));
    });
    it("should not molest module declarations",function() {
        var ast = mangle(parse("module.test = 'test';"));
        assert.strictEqual(ast.body[0].expression.left.object.name,'module');
    });
    it("should complain about unbound vars in local functions",function() {
        assert.throws(function() {
            mangle(parse("store {rule (a=(function(){return b;})());}"));
        });
    });
    it("should detect impossible computed binding",function() {
        assert.throws(function() {
            mangle(parse("store {rule (['a',b[1]]);}"));
        });
    });
    it("should detect impossible non-computed binding",function() {
        assert.throws(function() {
            mangle(parse("store {rule (['a',b.p]);}"));
        });
    });
});

describe("compile",function() {
    it("should generate JS for very trivial store",function() {
        var js = compile("store {['user',{name:'sid'}];};");
        var st = eval(recast.print(js).code);
        assert.deepEqual(st._private.rawFacts,{"1":['user',{name:'sid'}]});
    });
    it("should generate JS for trivial store",function() {
        var js = compile("store {['user',{name:'sid'}];rule(['user',{name:a}]);rule(['company',{user:a,name:b}]);};");
        var st = eval(recast.print(js).code);
        assert.deepEqual(st._private.rawFacts,{"1":['user',{name:'sid'}]});
    });
    it("should generate JS for trivial store via const",function() {
        var js = compile("const st = store {['user',{name:'sid'}];rule(['user',{name:a}]);rule(['company',{user:a,name:b}]);};\n"+
                         "require('assert').deepEqual(st._private.rawFacts,{'1':['user',{name:'sid'}]})");
        eval(recast.print(js).code);
    });
    // ??? what about 'let' declarations? ???
    it("should restore initial contents",function() {
        var  ast = parse("store {['b',0];};");
        var   js = compiler.compile(ast);
        var   st = eval(recast.print(js).code);
        assert.deepEqual(st.orderedFacts,[['b',0]]);
        st.reset();
        assert.deepEqual(st.orderedFacts,[['b',0]]);
    });
    it("should restore initial contents after update",function() {
        var  ast = parse("store {['b',0];};");
        var   js = compiler.compile(ast);
        var   st = eval(recast.print(js).code);
        assert.deepEqual(st.orderedFacts,[['b',0]]);
        st.add(['c',1]);
        assert.deepEqual(st.orderedFacts,[['b',0],['c',1]]);
        st.reset();
        assert.deepEqual(st.orderedFacts,[['b',0]]);
    });
    it("should handle guards starting with ! [cd50013ab17474a6]",function() {
        var ast = parse("store {rule(['a',b],!(b===0),+['c']);rule(-['a',...]);};");
        var  js = compiler.compile(ast);
        var  st = eval(recast.print(js).code);
        st.add(['a',0]);
        assert.deepEqual(st.orderedFacts,[]);
        st.add(['a',1]);
        assert.deepEqual(st.orderedFacts,[['c']]);
    });
    it("should handle nuladic arrow functions",function() {
        var js = compiler.compile(parse("()=>23;"));
        var fn = eval(recast.print(js).code);
        assert.strictEqual(fn(),23);
    });
    it("should handle monadic arrow functions",function() {
        var js = compiler.compile(parse("x=>x+1;"));
        var fn = eval(recast.print(js).code);
        assert.strictEqual(fn(1),2);
        assert.strictEqual(fn(2),3);
    });
    it("should handle bracketed monadic arrow functions",function() {
        var js = compiler.compile(parse("(x)=>x+1;"));
        var fn = eval(recast.print(js).code);
        assert.strictEqual(fn(1),2);
        assert.strictEqual(fn(2),3);
    });
    it("should handle dyadic arrow functions",function() {
        var js = compiler.compile(parse("(x,y)=>x+y+1;"));
        var fn = eval(recast.print(js).code);
        assert.strictEqual(fn(1,2),4);
        assert.strictEqual(fn(2,3),6);
    });
    it("should handle dyadic arrow functions in a store",function() {
        var js = compiler.compile(parse("var t=fn=>fn(2,3);store {rule (-['a'],+['b',t((x,y)=>x+y+1)]);};"));
        var st = eval(recast.print(js).code);
        st.add(['a']);
        assert.deepEqual(st.orderedFacts,[['b',6]]);
    });
    it("should handle very simple object expression extensions on 'RHS'",function() {
        const js = compile("store{rule(-['a',{p}],+['b',{p}]);}");
        const st = eval(recast.print(js).code);
        st.add(['a',{p:67}]);
        assert.deepEqual(st.orderedFacts,[['b',{p:67}]]);
    });
    it("should handle object expression extensions on 'RHS'",function() {
        var js = compile("store{rule(-['a',{p,...qs}],+['b',{p,...qs}]);}");
        var st = eval(recast.print(js).code);
        st.add(['a',{p:67,a:'a',b:23}]);
        assert.deepEqual(st.orderedFacts,[['b',{p:67,a:'a',b:23}]]);
    });
    it("should accept decent `out`s",function(){
        compile("store{rule(['p'],out('a','b'));}");
    });
    it("should detect misplaced `out`s",function(){
        assert.throws(()=>{compile("store{rule(['p'],out('a','b')+1);}");});
    });
    it("should detect non top-level `out`s",function(){
        assert.throws(()=>{compile("store{rule(['p'],1+out('a','b'));}");});
    });
    it("should handle try/catch (if only for testing) [9854c3d7a3291b37]",function(){
        compile("try {console.log('blah');} catch (e) {console.log(e);}");
    });
    it("should handle garden path conditions",function(){
        compile("store {rule(-['w',{arg}],['one','two'].includes(arg));};");
    });
    xit("should handle query/where in StoreDeclaration",function(){
        compile("store {query q() [x where ['x',{x}]];};");
    });
});

describe("fail statement",function(){
    it("should compile and emit error event",function(done){
        var js = compile("store {rule(['bollocks',{}],fail \"that's bollocks\");};");
        var st = eval(recast.print(js).code);
        st.out = (port,msg)=>{
            assert.strictEqual(port,"fail:");
            assert.strictEqual(msg,"that's bollocks");
            done();
        };
        st.add(['bollocks',{}]);
    });
});

describe("compile hook",function() {
    var tdir = temp.mkdirSync();
    it("should be run when a chrjs file is compiled",function() {
        var fn = path.join(tdir,'a.chrjs');
        var ok = false;
        compiler.once('compile',function(filename) {
            ok = true;
        });
        fs.writeFileSync(fn,"store {\nrule (['1']);}");
        require(fn);            // eslint-disable-line security/detect-non-literal-require
        assert(ok);
    });
});

describe("rule maps",function() {
    var tdir = temp.mkdirSync();
    it("should build rule maps when asked",function() {
        try {
            var fn = path.join(tdir,'a.chrjs');
            var ok = false;
            compiler.debug = true;
            compiler.once('compile',function(filename) {
                const ruleMap = compiler.getRuleMap(filename);
                assert.equal(Object.keys(ruleMap).length,1); // one rule
                assert.equal(Object.keys(ruleMap)[0],'%rule-1');
                assert.ok(ruleMap['%rule-1']);
                ok = true;
            });
            fs.writeFileSync(fn,"store {\nrule (['1'],+['2',{}]);}");
            require(fn);        // eslint-disable-line security/detect-non-literal-require
            assert(ok);
        } finally {
            compiler.debug = false;
        }
    });
    it("should not build rule maps unless asked",function() {
        var fn = path.join(tdir,'b.chrjs');
        fs.writeFileSync(fn,"store {\nrule (['1']);}");
        require(fn);            // eslint-disable-line security/detect-non-literal-require
        assert.throws(function() {
            compiler.getRuleMap(fn);
        });
    });
});
describe("caching",function(){
    const cwd = process.cwd();
    after(()=>{process.chdir(cwd);});
    describe("mkCachePrefix",function(){
        const compilerDebug = compiler.debug;
        after(()=>{compiler.debug=compilerDebug;});
        it("builds a string",function(){
            assert.strictEqual(typeof compiler.mkCachePrefix({}),'string');
        });
        it("value depends upon arg",function(){
            assert.notStrictEqual(compiler.mkCachePrefix({}),   compiler.mkCachePrefix({a:1}));
            assert.notStrictEqual(compiler.mkCachePrefix({a:1}),compiler.mkCachePrefix({b:1}));
            assert.notStrictEqual(compiler.mkCachePrefix({a:1}),compiler.mkCachePrefix({a:2}));
        });
        it("value depends upon compiler debug",function(){
            compiler.debug = true;
            const pfx1 =  compiler.mkCachePrefix({});
            compiler.debug = false;
            const pfx0 =  compiler.mkCachePrefix({});
            assert.notStrictEqual(pfx0,pfx1);
        });
    });
    describe("implicit compilation",function(){
        this.bail(true);
        const tdir = temp.mkdirSync();
        const  fn1 = path.join(tdir,'a.chrjs');
        const  fn2 = path.join(tdir,'b.chrjs');
        let     js1;
        let     js2;
        fs.mkdirSync(path.join(tdir,'.ccache'));
        fs.writeFileSync(fn1,"store {\nrule (['1'],+['2',{}]);}");
        fs.writeFileSync(fn2,"store {\nrule (['2'],+['2',{}]);}");
        before(()=>{
            process.chdir(tdir);
            assert.strictEqual(fs.readdirSync(path.join(tdir,'.ccache')).length,0);
        });
        it("places entry in cache",function(){
            compiler.load(fn1,{module:{_compile:(code,filename)=>{js1=code;}}});
            assert.strictEqual(fs.readdirSync(path.join(tdir,'.ccache')).length,2); // js and map
            assert.strictEqual(typeof js1,'string');
        });
        it("fetches from cache",function(){
            compiler.load(fn1,{module:{_compile:(code,filename)=>{assert.strictEqual(code,js1);}}});
            assert.strictEqual(fs.readdirSync(path.join(tdir,'.ccache')).length,2); // js and map

        });
        it("fetches from cache by content",function(){
            compiler.load(fn1,{module:{_compile:(code,filename)=>{assert.strictEqual(code,js1);}}});
            assert.strictEqual(fs.readdirSync(path.join(tdir,'.ccache')).length,2); // js and map

        });
        it("places another entry in cache",function(){
            compiler.load(fn2,{module:{_compile:(code,filename)=>{js2=code;}}});
            assert.strictEqual(fs.readdirSync(path.join(tdir,'.ccache')).length,4); // js and map
            assert.strictEqual(typeof js2,'string');
        });
        it("emitted code differs",function(){
            assert.notStrictEqual(js1,js2);
        });
        it("fetches other from cache",function(){
            compiler.load(fn2,{module:{_compile:(code,filename)=>{assert.strictEqual(code,js2);}}});
            assert.strictEqual(fs.readdirSync(path.join(tdir,'.ccache')).length,4); // js and map

        });
        it("fetches other from cache by content",function(){
            compiler.load(fn2,{module:{_compile:(code,filename)=>{assert.strictEqual(code,js2);}}});
            assert.strictEqual(fs.readdirSync(path.join(tdir,'.ccache')).length,4); // js and map

        });
    });
});

describe("load",function(){
    let st;
    describe("non-debug",function(){
        it("loads a malaya source file",function(){
            st = compiler.load('test/bl/count0.malaya',{debug:false});
        });
        it("which has a __file__ property",function(){
            assert.strictEqual(st.__file__,path.resolve('test/bl/count0.malaya'));
        });
        it("which works",function(){
            st.update(['x',{}]);
            _.chain(st.orderedFacts)
                .tap(ff=>assert.strictEqual(ff.length,1))
                .each(f=>assert.strictEqual(f[0],'stats'))
                .each(f=>assert.strictEqual(f[1].xCount,1));
        });
    });
    describe("debug",function(){
        it("loads a malaya source file",function(){
            st = compiler.load('test/bl/count0.malaya',{debug:true});
        });
        it("which has a __file__ property",function(){
            assert.strictEqual(st.__file__,path.resolve('test/bl/count0.malaya'));
        });
        it("which works",function(){
            st.update(['x',{}]);
            _.chain(st.orderedFacts)
                .tap(ff=>assert.strictEqual(ff.length,1))
                .each(f=>assert.strictEqual(f[0],'stats'))
                .each(f=>assert.strictEqual(f[1].xCount,1));
        });
    });
    describe("requiring JSON",function(){
        it("loads a malaya source file",function(){
            st = compiler.load('test/bl/req.malaya');
        });
        it("which accesses the required JSON",function(){
            st.update(['configGet',{}]);
        });
        it("correctly",function(){
            _.chain(st.orderedFacts)
                .tap(ff=>assert.strictEqual(ff.length,1))
                .each(f=>assert.strictEqual(f[0],'config'))
                .each(f=>assert.strictEqual(f[1].external.test, true))
                .each(f=>assert.strictEqual(f[1].external.value,457));
        });
    });
});

describe("MalayaDate",function(){
    let saveNow;
    before(()=>{
        saveNow = MalayaDate.now;
    });
    before(()=>{
        MalayaDate.now = saveNow;
    });
    it("constructs a Date per its `now` method",function(){
        MalayaDate.now = ()=>12345;
        const d = new MalayaDate();
        assert.strictEqual(d.valueOf(),12345);
        assert.strictEqual(d.toISOString(),'1970-01-01T00:00:12.345Z');
    });
    it("constructs a Date per its arg",function(){
        MalayaDate.now = ()=>12345;
        const d = new MalayaDate(0);
        assert.strictEqual(d.valueOf(),0);
        assert.strictEqual(d.toISOString(),'1970-01-01T00:00:00.000Z');
    });
});
