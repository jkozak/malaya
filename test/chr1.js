var     chr = require("../chr1.js");

var eschrjs = require("../eschrjs.js");
var  assert = require("assert");
var    util = require('../util.js');
var       _ = require('underscore');

var parseRule = function(code) {
    eschrjs._private.setupParse(code);
    return eschrjs._private.parseRuleStatement();
};

var parseExpression = function(code) {
    eschrjs._private.setupParse(code);
    return eschrjs._private.parseExpression();
};

function equalUnordered(s1,s2) {
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
	assert(equalUnordered(['a'],    gfv(parseExpression("a"))));
	assert(equalUnordered(['a'],    gfv(parseExpression("1+a"))));
	assert(equalUnordered(['a'],    gfv(parseExpression("a+1"))));
	assert(equalUnordered(['a','b'],gfv(parseExpression("a+b"))));
	assert(equalUnordered(['a'],    gfv(parseExpression("a+a"))));
	assert(equalUnordered([],       gfv(parseExpression("f()"))));
	assert(equalUnordered(['a'],    gfv(parseExpression("f(a)"))));
	assert(equalUnordered([],       gfv(parseExpression("['a',{b:1,c:'23'}]"))));
	assert(equalUnordered([],       gfv(parseExpression("['a',{b:a,c:'23'}]"))));
	assert(equalUnordered([],       gfv(parseExpression("true?1:0"))));
	assert(equalUnordered(['a'],    gfv(parseExpression("true?a:0"))));
	assert(equalUnordered(['a'],    gfv(parseExpression("true?0:a"))));
	assert(equalUnordered(['a'],    gfv(parseExpression("a?0:a"))));
	assert(equalUnordered([],       gfv(parseExpression("new A()"))));
	assert(equalUnordered(['a'],    gfv(parseExpression("function(p,q,r){return a+p+q+r;}"))));
	assert(equalUnordered(['a'],    gfv(parseExpression("function f(p,q,r){return a+p+q+r;}"))));
    });
    it("should ignore variable bindings",function() {
	assert(equalUnordered([],       gfv(parseRule("rule (['user',{a}])"))));
	assert(equalUnordered([],       gfv(parseRule("rule (['user',{name:a}])"))));
	assert(equalUnordered(['a'],    gfv(parseRule("rule (['user',{name:a+''}])"))));
    });
});


describe("dataflow analysis",function() {
    it("should find variables",function() {
	//console.log("*** %j",parseRule("rule (['a',{b,c}]);"));
    });
});
