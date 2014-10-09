var     chr = require("../chr1.js");

var eschrjs = require("../eschrjs.js");
var  assert = require("assert");
var  recast = require("recast");
var    util = require('../util.js');
var      fs = require('fs');
var       _ = require('underscore');

var       b = recast.types.builders;

var parseRule = function(code) {
    eschrjs._private.setupParse(code);
    return eschrjs._private.parseRuleStatement();
};

var parseExpression = function(code) {
    eschrjs._private.setupParse(code);
    return eschrjs._private.parseExpression();
};

function equalU(s1,s2) {	// unordered equal (set-like)
    return _.difference(s1,s2).length===0 && _.difference(s2,s1).length===0;
}

describe("exprContainsVariable",function() {
    var exprContainsVariable = chr._private.exprContainsVariable;
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
    var gfv = chr._private.exprGetFreeVariables;
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
    });
});

describe("exprGetVariablesWithBindingSites",function() {
    var vwbs = chr._private.exprGetVariablesWithBindingSites;
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
    var Ref = chr._private.Ref;
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
    var genAccessor = chr._private.genAccessor;
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

describe("genMatch",function() {
    var genMatch  = chr._private.genMatch;
    var evalMatch = function(match,fact) {
	var code = (recast.print(b.callExpression(b.functionExpression(null,[b.identifier('fact')],match),
						  [fact])).code);
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
});

describe("mangle",function() {
    var mangle = chr._private.mangle;
    var   vwbs = chr._private.exprGetVariablesWithBindingSites;
    it("should translate user variable names to something safe",function() {
	var ast = eschrjs.parse("store fred {['user',{name:'sid'}];rule(['user',{name:a}]);rule(['company',{user:a,name:b}]);}");
	var  av = mangle(ast,['a','b']);
	assert.deepEqual(av[1],_.map(['a','b'],mangle));
	assert(equalU(vwbs(av[0],av[1])));
    });
    it("should translate BindRest exprs",function() {
	var ast = eschrjs.parse("store fred {rule(['user',{...rB}]^rB.t);}");
	var  av = chr._private.mangle(ast,['a','rB']);
	assert.equal(av[0].body[0].body[0].items[0].rank.object.name,'rB_');
    });
    it("should handle properties correctly",function() {
	var ast = eschrjs.parse("store fred {rule(['user',{name}]);}");
	var  av = chr._private.mangle(ast,['a','name']);
	assert.equal(av[0].body[0].body[0].items[0].expr.elements[1].properties[0].key.name,'name');
	assert.equal(av[0].body[0].body[0].items[0].expr.elements[1].properties[0].value.name,mangle('name'));
    });
});

describe("genAdd",function() {
    var genAdd = chr._private.genAdd;
    it("should repackage ellipsis bindings",function() {
	var ast = eschrjs.parse("store fred {rule([name],+['user',{...name}]);}");
	var add = ast.body[0].body[0].items[1].expr;
	// +++ sanity check result +++
	//console.log("***    add %j",add);
	//console.log("*** genAdd %j",genAdd(add));
    });
});

describe("generateJS",function() {
    it("should generate JS for trivial store",function() {
	var js = chr.generateJS(eschrjs.parse("store fred {['user',{name:'sid'}];rule(['user',{name:a}]);rule(['company',{user:a,name:b}]);}"));
	eval(recast.print(js).code);
    });
    it("should generate JS for less trivial store",function() {
	var matchCHRJS = fs.readFileSync("test/bl/match.chrjs");
	var      chrjs = eschrjs.parse(matchCHRJS);
	var         js = chr.generateJS(chrjs);
	console.log("*** js: \n"+recast.print(js).code);
	// +++
	eval(recast.print(js).code);
	console.log("*** match: %j",match._private.facts);
	assert.strictEqual(Object.keys(match._private.facts).length,3); // 3 facts from the match.chrjs source 
    });
});
