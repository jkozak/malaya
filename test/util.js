var util   = require("../util.js");

var assert = require("assert");

describe('constants',function() {
    it("`env` will always be 'test' when testing",function() {
	assert.equal(util.env,"test");
    });
    it("`source_version` will be a string",function() {
	assert.equal(typeof util.source_version,'string');
    });
});

describe('Set',function() {
    it("has a size",function() {
	var s = new util.Set();
	assert.equal(s.size,0);
    });
    it("can add and delete things",function() {
	var s = new util.Set();
	assert.equal(s.size,0);
	s.add(1);
	assert.equal(s.size,1);
	s.add(2);
	assert.equal(s.size,2);
	s.delete(2);
	assert.equal(s.size,1);
	s.delete(1);
	assert.equal(s.size,0);
    });
    it("has set semantics",function() {
	var s = new util.Set();
	assert.equal(s.size,0);
	s.add(1);
	assert.equal(s.size,1);
	s.add(1);
	s.add(1);
	assert.equal(s.size,1);
    });
    it("can iterate",function() {
	var s = new util.Set();
	var n;
	n=0; s.forEach(function(){n++;}); assert.equal(n,0);
	s.add(1);
	n=0; s.forEach(function(){n++;}); assert.equal(n,1);
	s.add(1);
	n=0; s.forEach(function(){n++;}); assert.equal(n,1);
    });
});

describe('Map',function() {
    it("has a size",function() {
	var m = new util.Map();
	assert.equal(m.size,0);
    });
    it("can add and delete things",function() {
	var m = new util.Map();
	assert.equal(m.size,0);
	m.set(1,"one");
	assert.equal(m.size,1);
	assert.equal(m.get(1),"one");
	m.set(2,"two");
	assert.equal(m.size,2);
	m.delete(2);
	assert.equal(m.size,1);
	m.delete(1);
	assert.equal(m.size,0);
    });
    it("has set semantics in its keys",function() {
	var m = new util.Map();
	assert.equal(m.size,0);
	m.set(1,"one");
	assert.equal(m.size,1);
	m.set(1,"un");
	m.set(1,"odin");
	assert.equal(m.size,1);
	assert.equal(m.get(1),"odin");
    });
    it("can iterate",function() {
	var m = new util.Map();
	var n;
	n=0; m.forEach(function(){n++;}); assert.equal(n,0);
	m.set(1,'one');
	m.set(2,'two');
	n=0; m.forEach(function(){n++;}); assert.equal(n,2);
	m.set(2,'dva');
	n=0; m.forEach(function(){n++;}); assert.equal(n,2);
    });
});

