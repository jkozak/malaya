var compiler = require("../compiler.js");

var parser = require("../parser.js");
var  assert = require("assert");
var  recast = require("recast");
var    util = require('../util.js');
var    temp = require('temp');
var    path = require('path');
var      fs = require('fs');
var       _ = require('underscore');

var       b = recast.types.builders;

temp.track();

var parseRule = function(code) {
    parser._private.setupParse(code);
    return parser._private.parseRuleStatement();
};

var parseExpression = function(code) {
    parser._private.setupParse(code);
    return parser._private.parseExpression();
};

function equalU(s1,s2) {	// unordered equal (set-like)
    return _.difference(s1,s2).length===0 && _.difference(s2,s1).length===0;
}

describe("exprContainsVariable",function() {
    var exprContainsVariable = compiler._private.exprContainsVariable;
    it("should count variables",function() {
	assert( exprContainsVariable(parseExpression("a")));
	assert( exprContainsVariable(parseExpression("1+a")));
	assert( exprContainsVariable(parseExpression("a+1")));
	assert(!exprContainsVariable(parseExpression("f()")));
	assert( exprContainsVariable(parseExpression("f(a)")));
	assert(!exprContainsVariable(parseExpression("['a',{b:1,c:'23'}]")));
	assert(!exprContainsVariable(parseExpression("['a',{b:a,c:'23'}]")));
	assert(!exprContainsVariable(parseExpression("true?1:0")));
	assert( exprContainsVariable(parseExpression("true?a:0")));
	assert(!exprContainsVariable(parseExpression("new A()")));
    });
});

describe("exprGetFreeVariables",function() {
    var gfv = compiler._private.exprGetFreeVariables;
    it("should detect variables",function() {
	assert(equalU(['a'],    gfv(parseExpression("a"))));
	assert(equalU(['a'],    gfv(parseExpression("1+a"))));
	assert(equalU(['a'],    gfv(parseExpression("a+1"))));
	assert(equalU(['a','b'],gfv(parseExpression("a+b"))));
	assert(equalU(['a'],    gfv(parseExpression("a+a"))));
	assert(equalU([],       gfv(parseExpression("f()"))));
	assert(equalU(['a'],    gfv(parseExpression("f(a)"))));
	assert(equalU([],       gfv(parseExpression("['a',{b:1,c:'23'}]"))));
	assert(equalU([],       gfv(parseExpression("['a',{b:a,c:'23'}]"))));
	assert(equalU([],       gfv(parseExpression("true?1:0"))));
	assert(equalU(['a'],    gfv(parseExpression("true?a:0"))));
	assert(equalU(['a'],    gfv(parseExpression("true?0:a"))));
	assert(equalU(['a'],    gfv(parseExpression("a?0:0"))));
	assert(equalU([],       gfv(parseExpression("new A()"))));
	assert(equalU(['a'],    gfv(parseExpression("function(p,q,r){return a+p+q+r;}"))));
	assert(equalU(['a'],    gfv(parseExpression("function f(p,q,r){return a+p+q+r;}"))));
	assert(equalU(['a'],    gfv(parseExpression("['a',{c:'23'}]^a"))));
    });
    it("should ignore variable bindings",function() {
	assert(equalU([],       gfv(parseRule("rule (['user',{a}])"))));
	assert(equalU([],       gfv(parseRule("rule (['user',{name:a}])"))));
	assert(equalU([],       gfv(parseRule("rule (['user',{a,...rs}])"))));
	assert(equalU(['a'],    gfv(parseRule("rule (['user',{name:a+0}])"))));
	assert(equalU(['a'],    gfv(parseRule("rule (['user',['fred',a,...rs]])"))));
    });
});

describe("exprGetVariablesWithBindingSites",function() {
    var vwbs = compiler._private.exprGetVariablesWithBindingSites;
    it("should detect variables",function() {
	assert(equalU([],       vwbs(parseRule("rule (['a'])"))));
	assert(equalU(['a'],    vwbs(parseRule("rule (['user',a])"))));
	assert(equalU(['rs'],   vwbs(parseRule("rule (['user',...rs])"))));
	assert(equalU(['rs'],   vwbs(parseRule("rule (['user',...rs,11])"))));
	assert(equalU(['a'],    vwbs(parseRule("rule (['user',{'a':a}])"))));
	assert(equalU(['a'],    vwbs(parseRule("rule (['user',{a:a}])"))));
	assert(equalU(['a'],    vwbs(parseRule("rule (['user',{b:a}])"))));
	assert(equalU(['a','b'],vwbs(parseRule("rule (['user',{a}],['co',{a,b}])"))));
	assert(equalU(['rs'],   vwbs(parseRule("rule ([...rs])"))));
	assert(equalU(['a'],    vwbs(parseRule("rule ([a])"))));
	assert(equalU(['rs'],   vwbs(parseRule("rule (['user',{a:12,...rs}])"))));
	assert(equalU(['rs'],   vwbs(parseRule("rule (['user',{...rs}])"))));
    });
});

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
    if (_.isArray(x))
	return b.arrayExpression(x.map(literalise));
    else if (_.isObject(x))
	return b.objectExpression(_.keys(x).map(function(k) {
	    return b.property('init',
			      b.identifier(k),
			      literalise(x[k]) );
	}));
    else
	return b.literal(x);
}

describe("genAdd",function() {
    var  genAdd = compiler._private.genAdd;
    var evalAdd = function(add,bindings) {
	if (bindings===undefined)
	    bindings = {};
	var   ks = _.keys(bindings);
	var code = recast.print(b.callExpression(b.functionExpression(null,
								      ks.map(function(k){return b.identifier(k);}),
								      b.blockStatement([b.returnStatement(add)]) ),
						 ks.map(function(k){return literalise(bindings[k]);}) )).code;
	return eval(code);
    };
    it("should have sane test infrastructure",function() {
	assert.deepEqual([1,2,3],evalAdd(parseExpression("[1,2,3]")));
	assert.deepEqual([1,2,4],evalAdd(parseExpression("[1,2,a]"),{a:4}));
    });
    it("should generate code for an array pattern",function() {
	var add = genAdd(parseExpression("['a',b,...c]"));
	assert.deepEqual(['a',6,56,57],evalAdd(add,{b:6,c:[56,57]}));
    });
    it("should generate code for a nested array pattern",function() {
	var add = genAdd(parseExpression("[['a',b,...c]]"));
	assert.deepEqual([['a',6,56,57]],evalAdd(add,{b:6,c:[56,57]}));
    });
    it("should generate code for an object pattern",function() {
	var add = genAdd(parseExpression("{a:1,...rs}"));
	assert.deepEqual({a:1,b:2,c:3},evalAdd(add,{rs:{b:2,c:3}}));
    });
    it("should generate code for a nested object pattern",function() {
	var add = genAdd(parseExpression("{k:{a:1,...rs}}"));
	assert.deepEqual({k:{a:1,b:2,c:3}},evalAdd(add,{rs:{b:2,c:3}}));
    });
    it("should generate code for an object-in-array pattern",function() {
	var add = genAdd(parseExpression("[{a:1,...rs}]"));
	assert.deepEqual([{a:1,b:4,c:5}],evalAdd(add,{rs:{b:4,c:5}}));
    });
    it("should generate code for an array-in-object pattern",function() {
	var add = genAdd(parseExpression("{p:[a,b,c]}"));
	assert.deepEqual({p:['a','b','c']},evalAdd(add,{a:'a',b:'b',c:'c'}));
    });
});


describe("genMatch",function() {
    var  genMatch = compiler._private.genMatch;
    var evalMatch = function(match,fact) {
	var code = (recast.print(b.callExpression(b.functionExpression(null,[b.identifier('fact')],match),
						  [fact] )).code);
	return eval(code);
    }
    it("should generate match code for simple array patterns",function() {
	var  vars = {c:{bound:false}};
	var match = genMatch(parseExpression("['a','b',c]"),
			     vars,
			     function(){return [b.returnStatement(b.identifier('c'))]} );
	assert(vars.c.bound);
	assert.equal(17,evalMatch(match,parseExpression("['a','b',17]") ) );
    });
    it("should generate match code for final ... array patterns",function() {
	var  vars = {c:{bound:false}};
	var match = genMatch(parseExpression("['a','b',...c]"),
			     vars,
			     function(){return [b.returnStatement(b.identifier('c'))]} );
	assert(vars.c.bound);
	assert.deepEqual([21,22],evalMatch(match,parseExpression("['a','b',21,22]")));
    });
    it("should generate match code for simple object patterns",function() {
	var  vars = {c:{bound:false}};
	var match = genMatch(parseExpression("{a:1, b:2, c}"),
			     vars,
			     function(){return [b.returnStatement(b.identifier('c'))]} );
	assert(vars.c.bound);
	assert.equal(117,evalMatch(match,parseExpression("{a:1,b:2,c:117}")));
    });
    it("should not over-match",function() {
	var  vars = {c:{bound:false}};
	var match = genMatch(parseExpression("{a:1, b:2, c}"),
			     vars,
			     function(){return [b.returnStatement(b.identifier('c'))]} );
	assert(vars.c.bound);
	assert.equal(undefined,evalMatch(match,parseExpression("{a:2,b:2,c:117}")));
    });
    it("should generate match code for ... object patterns",function() {
	var  vars = {c:{bound:false}};
	var match = genMatch(parseExpression("{a:1, b:2, ...c}"),
			     vars,
			     function(){return [b.returnStatement(b.identifier('c'))]} );
	assert(vars.c.bound);
	assert.deepEqual({c:117,d:118},evalMatch(match,parseExpression("{a:1,b:2,c:117,d:118}")));
    });
    it("should generate match code for medial ... array patterns",function() {
	var  vars = {c:{bound:false},d:{bound:false}};
	var match = genMatch(parseExpression("['a','b',...c,d]"),
			     vars,
			     function(){return [b.returnStatement(b.identifier('c'))]} );
	assert(vars.c.bound);
	assert(vars.d.bound);
	assert.deepEqual([21],evalMatch(match,parseExpression("['a','b',21,22]")));
    });
    it("should generate match code for nested array pattern",function() {
	var  vars = {a:{bound:false}};
	var match = genMatch(parseExpression("[[a]]"),
			     vars,
			     function(){return [b.returnStatement(b.identifier('a'))]} );
	assert(vars.a.bound);
	assert.deepEqual(26,evalMatch(match,parseExpression("[[26]]")));
    });
    it("should generate match code for array pattern in object expression",function() {
	var  vars = {a:{bound:false},q:{bound:false}};
	var match = genMatch(parseExpression("{p:[a],...q}"),
			     vars,
			     function(){return [b.returnStatement(b.identifier('a'))]} );
	assert(vars.q.bound);
	assert(vars.a.bound);
	assert.deepEqual(23,evalMatch(match,parseExpression("{\"p\":[23]}")));
    });
    it("should generate match code for ... array pattern in object expression",function() {
	var  vars = {c:{bound:false},q:{bound:false}};
	var match = genMatch(parseExpression("{p:['a','b',...c],...q}"),
			     vars,
			     function(){return [b.returnStatement(b.identifier('c'))]} );
	assert(vars.q.bound);
	assert(vars.c.bound);
	assert.deepEqual([23],evalMatch(match,parseExpression("{\"p\":['a','b',23]}")));
    });
    it("should generate match code for member pattern in object expression",function() {
	// +++ extend `evalMatch` with the bindings code from `evalAdd` +++
	var  vars = {a:{bound:true}};
	var match = genMatch(parseExpression("{p:a.b}"),
			     vars,
			     function(){return [b.returnStatement(b.identifier('a'))]} );
	var  code = recast.print(b.callExpression(b.functionExpression(null,
								       [b.identifier('a'),
									b.identifier('fact')],
								       match),
						  [b.objectExpression([b.property('init',
										  b.identifier('b'),
										  b.literal(30) )]),
						   parseExpression("{p:30}")])).code;
	assert.deepEqual({b:30},eval(code));
    });
});

describe("mangle",function() {
    var mangle = compiler._private.mangle;
    var   vwbs = compiler._private.exprGetVariablesWithBindingSites;
    it("should translate user variable names to something safe",function() {
	var ast = parser.parse("store fred {['user',{name:'sid'}];rule(['user',{name:a}]);rule(['company',{user:a,name:b}]);}");
	var  av = mangle(ast,['a','b']);
	assert.deepEqual(av[1],_.map(['a','b'],mangle));
	assert(equalU(vwbs(av[0],av[1])));
    });
    it("should translate BindRest exprs",function() {
	var ast = parser.parse("store fred {rule(['user',{...rB}]^rB.t);}");
	var  av = mangle(ast,['rB']);
	assert.equal(av[0].body[0].body[0].items[0].rank.object.name,'rB_');
    });
    it("should handle properties correctly",function() {
	var ast = parser.parse("store fred {rule(['user',{name}]);}");
	var  av = mangle(ast,['name']);
	assert.equal(av[0].body[0].body[0].items[0].expr.elements[1].properties[0].key.name,'name');
	assert.equal(av[0].body[0].body[0].items[0].expr.elements[1].properties[0].value.name,mangle('name'));
    });
    it("should handle computed MemberExpressions [e39caf5ad040aa90]",function() {
	var ast = parser.parse("store fred {rule(['user',{id,...rs}],d={'a':rs.x}['a']);}");
	var  av = mangle(ast,['rs']);
	assert.equal(av[0].body[0].body[0].items[1].expr.right.object.properties[0].value.object.name,'rs_');
    })
});

describe("genAdd",function() {
    var genAdd = compiler._private.genAdd;
    it("should repackage ellipsis bindings",function() {
	var ast = parser.parse("store fred {rule([name],+['user',{...name}]);}");
	var add = ast.body[0].body[0].items[1].expr;
	// +++ sanity check result +++
	//console.log("***    add %j",add);
	//console.log("*** genAdd %j",genAdd(add));
    });
});

describe("compile",function() {
    it("should generate JS for trivial store",function() {
	var js = compiler.compile(parser.parse("var st = store {['user',{name:'sid'}];rule(['user',{name:a}]);rule(['company',{user:a,name:b}]);};"));
	eval(recast.print(js).code);
	assert.deepEqual(st._private.facts,{"1":['user',{name:'sid'}]});
    });
});

describe("EventEmitter",function() {
    it("should emit `fire` event to `once`",function(){
	var js = compiler.compile(parser.parse("var st = store {rule(-['user',{name:a}]);};"));
	//console.log(recast.print(js).code);
	eval(recast.print(js).code);
	var fired = false;
	st.once('fire',function(store,fact,adds,dels){
	    fired = true;
	    assert.deepEqual(fact,['user',{'name':'sid'}]);
	    assert.equal(adds.length,0); // no nett adds...
	    assert.equal(dels.length,0); // ... or deletes
	    assert.equal(store._private.size,0);
	});
	st.add(['user',{'name':'sid'}]);
	assert(fired);
	fired = false;
	st.add(['user',{'name':'james'}]);
	assert(!fired);
    });
    it("should emit `fire` event to `on`",function(){
	var js = compiler.compile(parser.parse("var st = store {rule(-['user',{name:a}]);};"));
	//console.log(recast.print(js).code);
	eval(recast.print(js).code);
	var fired = false;
	st.on('fire',function(store,fact,adds,dels){
	    fired = true;
	    assert.equal(fact[0],'user');
	    assert.equal(adds.length,0); // no nett adds...
	    assert.equal(dels.length,0); // ...or deletesx
	    assert.equal(store._private.size,0);
	});
	st.add(['user',{'name':'sid'}]);
	assert(fired);
	fired = false;
	st.add(['user',{'name':'james'}]);
	assert(fired);
    });
});

describe("query statement",function() {
    it("should compile and run a simple query",function() {
	var js = compiler.compile(parser.parse("var st = store {query q(;['user',{name:n}];a=[]) a.concat(n);};"));
	//console.log(recast.print(js).code);
	eval(recast.print(js).code);
	assert.equal(st.queries.q().result.length,0);
	st.add(['user',{name:'tyson'}]);
	assert.equal(st.queries.q().result.length,1);
    });
    it("should compile and run a parameterized query",function() {
	var js = compiler.compile(parser.parse("var st = store {query q(p;['user',{name:n}],n.length===p;a=[]) a.concat(n);};"));
	eval(recast.print(js).code);
	st.add(['user',{name:'tyson'}]);
	var qr1 = st.queries.q(1)
	var qr5 = st.queries.q(5)
	assert.equal(qr1.result.length,0);
	assert.equal(qr5.result.length,1);
	assert.equal(typeof qr1.t,'number');
	assert.equal(qr1.t,qr5.t); // store has not been updated by queries
    });
    it("should run the 3-head benchmark",function() {
	var js = compiler.compile(parser.parse("var st = store {query q(;['X',x,p],['X',x,q],['X',x,r],p>q && q>r;a=0) a+p+q+r};"));
	eval(recast.print(js).code);
	var n = 100;
	for (var i=0;i<n/3;i++) {
	    st.add(["X",i,10]);
	    st.add(["X",i,20]);
	    st.add(["X",i,30]);
	}
	st.queries.q();
    });
    it("should compile multiple queries",function() {
	var chrjs = "store st {query q1(;['X',x,p];a=0) a+p;query q2(;['X',x,p],['X',x,q],p>q;a=0) a+p+q;query q3(;['X',x,p],['X',x,q],['X',x,r],p>q && q>r;a=0) a+p+q+r;}";
	var js = compiler.compile(parser.parse(chrjs))
	eval(recast.print(js).code);
	assert.equal(Object.keys(st.queries).length,3);
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
	require(fn);
	assert(ok);
    });
});

describe("code stanzas",function() {
    var tdir = temp.mkdirSync();
    it("should build stanzas when asked",function() {
	try {
	    var fn = path.join(tdir,'a.chrjs');
	    var ok = false;
	    compiler.debug = true;
	    compiler.once('compile',function(filename) {
		assert.equal(compiler.getStanzas(filename).length,1);
		ok = true;
	    });
	    fs.writeFileSync(fn,"store {\nrule (['1']);}");
	    require(fn);
	    assert(ok);
	} finally {
	    compiler.debug = false;
	}
    });
    it("should not build stanzas unless asked",function() {
	var fn = path.join(tdir,'b.chrjs');
	fs.writeFileSync(fn,"store {\nrule (['1']);}");
	require(fn);
	assert.throws(function() {
	    compiler.getStanzas(filename)
	});
    });
});
