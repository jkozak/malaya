var chr    = require("../chr.js");

var assert = require("assert");

describe('match()',function() {
    var context;

    var   match = chr._private.match;
    
    var       p = new chr.Variable('p');       // make the testing a bit tidier  
    var       q = new chr.Variable('q');
    var      ps = new chr.VariableRest('ps');
    var      qs = new chr.VariableRest('qs');

    it("should match simple terms",function() {
	context = {};
	assert.ok(match(1,1,context));	   assert.deepEqual(context,{});
	assert.ok(!match(1,0,context));	   assert.deepEqual(context,{});
	assert.ok(match("a","a",context)); assert.deepEqual(context,{});
	assert.ok(!match("a","b",context));assert.deepEqual(context,{});
    });
    
    it("should match list terms",function() {
	context = {};
	assert.ok(match(['a',1,'b',2],['a',1,'b',2],context));   assert.deepEqual(context,{});
	assert.ok(!match(['a',1,'b',2],['a',1,'b',2,3],context));assert.deepEqual(context,{});
	assert.ok(!match(['a',1,'b',2,3],['a',1,'b',2],context));assert.deepEqual(context,{});
	assert.ok(match([],[],context));                         assert.deepEqual(context,{});
    });
    
    it("should bind Variable",function() {
	context = {};
	assert.ok(match(p,'a',context));assert.deepEqual(context,{p:'a'});
    });
    
    it("should match binding with previous bindings",function() {
	context = {};
	assert.ok(match([p,p],['a','a'],context));assert.deepEqual(context,{p:'a'});
	context = {};
	assert.ok(!match([p,p],['a','b'],context));
    });
    
    it("should bind Variable in lists",function() {
	context = {};
	assert.ok(match([p],['a'],context));assert.deepEqual(context,{p:'a'});

    	context = {};
	assert.ok(match(p,['a'],context));assert.deepEqual(context,{p:['a']});

        context = {};
	assert.ok(match([p,q],['a',1],context));
	assert.deepEqual(context,{p:'a',q:1});
    });

    it("should forbid multiple VariableRests",function() {
	assert.throws(function() {
	    match([ps,qs],['a'],{});
	});
	// nothing to test for maps as they can only ever have one VR (unique key)
    });
    
    it("should bind VariableRest in lists",function() {
	context = {};
	assert.ok(match([ps],['a'],context));
	assert.deepEqual(context,{ps:['a']});

    	context = {};
	assert.ok(match([ps],['a',1,'q'],context));
	assert.deepEqual(context,{ps:['a',1,'q']});

        context = {};
	assert.ok(match([p,ps],['a',1,'q'],context));
	assert.deepEqual(context,{p:'a',ps:[1,'q']});

        context = {};
	assert.ok(match([p,ps,q],['a',1,'q'],context));
	assert.deepEqual(context,{p:'a',ps:[1],q:'q'});

        context = {};
	assert.ok(match([p,ps,q],['a','q'],context));
	assert.deepEqual(context,{p:'a',ps:[],q:'q'});
    });
    
    it("should bind Variable in maps",function() {
	context = {};
	assert.ok(match({x:p},{x:'a'},context));
	assert.deepEqual(context,{p:'a'});
    });
    
    it("should bind VariableRest in maps",function() {
	context = {};
	assert.ok(match({'':ps},{r:'a'},context));
	assert.deepEqual(context,{ps:{r:'a'}});

	context = {};
	assert.ok(match({'':ps},{r:'a',s:1},context));
	assert.deepEqual(context,{ps:{r:'a',s:1}});
    });
});
