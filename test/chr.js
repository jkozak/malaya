var chr    = require("../chr.js");

var assert = require("assert");
var   util = require('../util.js');

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

describe('Store',function() {
    it("should add and remove facts",function() {
	var store = new chr.Store();
	assert.equal(store.size(),0);
	var t1 = store.add([1,2,3]);
	assert.equal(store.size(),1);
	var t2 = store.add([1,2,3]);
	assert.ok(t2>t1);
	assert.equal(store.size(),2);	    // multiset
	var t3 = store.add({a:1,b:2});
	assert.ok(t3>t2);
	assert.equal(store.size(),3);
	var t4 = store.add({a:1,b:2});
	assert.ok(t4>t3);
	assert.equal(store.size(),4);	    // multiset
	store.remove(t1);
	assert.equal(store.size(),3);
	store.remove(t2);
	assert.equal(store.size(),2);
	store.remove(t4);
	assert.equal(store.size(),1);
	store.remove(t3);
	assert.equal(store.size(),0);
    });
    describe('Aggregate',function() {
	it("should zero gracefully",function() {
	    var store = new chr.Store();
	    var  aggr = new chr.Aggregate([["X",new chr.Variable('x')]],
					  function(_){return true;},
					  1337,
					  function(v,_,ctx){return v+ctx['x'];} );
	    assert.equal(store.aggregate(aggr),1337);
	    store.add(["Y",100]);
	    assert.equal(store.aggregate(aggr),1337);
	});
	it("should guard firmly",function() {
	    var store = new chr.Store();
	    var  aggr = new chr.Aggregate([["X",new chr.Variable('x')]],
					  function(_){return false;},
					  0,
					  function(v,_,ctx){return v+ctx['x'];} );
	    store.add(["X",100]);
	    assert.equal(store.aggregate(aggr),0);
	});
	it("should match a single head",function() {
	    var store = new chr.Store();
	    var  aggr = new chr.Aggregate([["X",new chr.Variable('x')]],
					  function(_){return true;},
					  0,
					  function(v,_,ctx){return v+ctx['x'];} );
	    assert.equal(store.aggregate(aggr),0);
	    store.add(["X",100]);
	    assert.equal(store.aggregate(aggr),100);
	    store.add(["X",1]);
	    assert.equal(store.aggregate(aggr),101);
	    store.add(["Y",99]);
	    assert.equal(store.aggregate(aggr),101);
	});
	it("should match dual heads",function() {
	    var store = new chr.Store();
	    var  aggr = new chr.Aggregate([["X",new chr.Variable('x'),new chr.Variable('p')],
					   ["X",new chr.Variable('x'),new chr.Variable('q')] ],
					  function(ctx){return ctx['p']>ctx['q'];},
					  0,
					  function(v,_,ctx){return v+ctx['p']+ctx['q'];} );
	    store.add(["X",1,10]);
	    store.add(["X",2,20]);
	    store.add(["X",2,30]);
	    assert.equal(store.aggregate(aggr),50);
	});
	it("should match triple heads",function() {
	    var store = new chr.Store();
	    var  aggr = new chr.Aggregate([["X",new chr.Variable('x'),new chr.Variable('p')],
					   ["X",new chr.Variable('x'),new chr.Variable('q')],
					   ["X",new chr.Variable('x'),new chr.Variable('r')]],
					  function(ctx){return ctx['p']>ctx['q'] && ctx['q']>ctx['r'];},
					  0,
					  function(v,_,ctx){return v+ctx['p']+ctx['q']+ctx['r'];} );
	    store.add(["X",1,10]);
	    store.add(["X",2,20]);
	    store.add(["X",2,30]);
	    assert.equal(store.aggregate(aggr),0);
	    store.add(["X",2,40]);
	    assert.equal(store.aggregate(aggr),90);
	});
    });
});
