var chr    = require("../chr.js");

var assert = require("assert");

describe('match()',function() {
    var context;
    
    it("should match simple terms",function() {
	context = {};
	assert.ok(chr.match(1,1,context));	assert.deepEqual(context,{});
	assert.ok(!chr.match(1,0,context));	assert.deepEqual(context,{});
	assert.ok(chr.match("a","a",context));	assert.deepEqual(context,{});
	assert.ok(!chr.match("a","b",context));	assert.deepEqual(context,{});
    });
    
    it("should match list terms",function() {
	context = {};
	assert.ok(chr.match(['a',1,'b',2],['a',1,'b',2],context));    assert.deepEqual(context,{});
	assert.ok(!chr.match(['a',1,'b',2],['a',1,'b',2,3],context)); assert.deepEqual(context,{});
	assert.ok(!chr.match(['a',1,'b',2,3],['a',1,'b',2],context)); assert.deepEqual(context,{});
	assert.ok(chr.match([],[],context));	                      assert.deepEqual(context,{});
    });
    
    it("should bind Variable",function() {
	context = {};
	assert.ok(chr.match(new chr.Variable('p'),'a',context));assert.deepEqual(context,{p:'a'});
    });
    
    it("should match binding with previous bindings",function() {
	var p = new chr.Variable('p');
	context = {};
	assert.ok(chr.match([p,p],['a','a'],context));assert.deepEqual(context,{p:'a'});
	context = {};
	assert.ok(!chr.match([p,p],['a','b'],context));
    });
    
    it("should bind Variable in lists",function() {
	context = {};
	assert.ok(chr.match([new chr.Variable('p')],['a'],context));assert.deepEqual(context,{p:'a'});

    	context = {};
	assert.ok(chr.match(new chr.Variable('p'),['a'],context));assert.deepEqual(context,{p:['a']});

        context = {};
	assert.ok(chr.match([new chr.Variable('p'),new chr.Variable('q')],['a',1],context));
	assert.deepEqual(context,{p:'a',q:1});
    });
    
    it("should bind VariableRest in lists",function() {
	context = {};
	assert.ok(chr.match([new chr.VariableRest('p')],['a'],context));
	assert.deepEqual(context,{p:['a']});

    	context = {};
	assert.ok(chr.match([new chr.VariableRest('p')],['a',1,'q'],context));
	assert.deepEqual(context,{p:['a',1,'q']});
    });
    
    it("should bind Variable in maps",function() {
	context = {};
	assert.ok(chr.match({x:new chr.Variable('p')},{x:'a'},context));
	assert.deepEqual(context,{p:'a'});
    });
    
    it("should bind VariableRest in maps",function() {
	context = {};
	assert.ok(chr.match({null:new chr.VariableRest('p')},{r:'a'},context));
	assert.deepEqual(context,{p:{r:'a'}});

	context = {};
	assert.ok(chr.match({null:new chr.VariableRest('p')},{r:'a',s:1},context));
	assert.deepEqual(context,{p:{r:'a',s:1}});
    });
});
