var chr    = require("../chr.js");

var assert = require("assert");
var   util = require('../util.js');

describe('match()',function() {
    var   store = chr.Store();
    var context;

    var   match = function(term,datum,bindings) {
	// make compatible with old interface to save re-writing these tests
	assert.deepEqual(bindings,{});          // +++ might need to fix this later +++
	var ctx = store.createContext();
	var ans = chr._private.match(term,datum,ctx);
	ctx.bindings.forEach(function(v,k) {
	    context[k] = v;
	});
	return ans;
    }
    
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
    var Match  = chr._private.ItemMatch;
    var Guard  = chr._private.ItemGuard;
    var Delete = chr._private.ItemDelete;
    var Add    = chr._private.ItemAdd;
    var Bind   = chr._private.ItemBind;
    var Fail   = chr._private.ItemFail;
    
    it("should add and delete facts",function() {
	var store = new chr.Store();
	assert.equal(store.size,0);
	var t1 = store.add([1,2,3]);
	assert.equal(store.size,1);
	var t2 = store.add([1,2,3]);
	assert.ok(t2>t1);
	assert.equal(store.size,2);	    // multiset
	var t3 = store.add({a:1,b:2});
	assert.ok(t3>t2);
	assert.equal(store.size,3);
	var t4 = store.add({a:1,b:2});
	assert.ok(t4>t3);
	assert.equal(store.size,4);	    // multiset
	store.delete(t1);
	assert.equal(store.size,3);
	store.delete(t2);
	assert.equal(store.size,2);
	store.delete(t4);
	assert.equal(store.size,1);
	store.delete(t3);
	assert.equal(store.size,0);
    });
    describe('match_items()',function() {
	it("should bind variables",function() {
	    var   store = new chr.Store();
	    var      ok = false;
	    store.match_items([new Bind('x',function(_){return 23;})],
			      store.createContext(),
			      function(item,context) {
				  assert.equal(context.get('x'),23);
				  ok = true;
			      });
	    assert(ok);
	    ok = false;
	    store.match_items([new Bind('x',function(_){return 23;}), // idempotent
			       new Bind('x',function(_){return 23;}) ],
			      store.createContext(),
			      function(item,context) {
				  assert.equal(context.get('x'),23);
				  ok = true;
			      });
	    assert(ok);
	    store.match_items([new Bind('x',function(_){return 23;}),
			       new Bind('x',function(_){return 24;}) ],
			      store.createContext(),
			      function() {ssert.ok(false);} );
	});
	it("should match bound variables to store",function() {
	    var   store = new chr.Store();
	    var      ok = false;
	    store.match_items([new Bind('x',function(_){return 23;}),
			       new Match(['X',new chr.Variable('x')])],
			      store.createContext(),
			      function() {assert.ok(false);} );
	    store.match_items([new Match(['X',new chr.Variable('x')]),
			       new Bind('x',function(_){return 23;}) ],
			      store.createContext(),
			      function() {assert.ok(false);} );
	    store.add(['X',23]);
	    ok = false;
	    store.match_items([new Bind('x',function(_){return 23;}),
			       new Match(['X',new chr.Variable('x')])],
			      store.createContext(),
			      function(item,context) {
				  assert.equal(context.get('x'),23);
				  ok = true;
			      });
	    assert.ok(ok);
	    ok = false;
	    store.match_items([new Match(['X',new chr.Variable('x')]),
			       new Bind('x',function(_){return 23;}) ],
			      store.createContext(),
			      function(item,context) {
				  assert.equal(context.get('x'),23);
				  ok = true;
			      });
	    assert.ok(ok);
	    store.match_items([new Match(['X',new chr.Variable('x')]),
			       new Bind('x',function(_){return 24;}) ],
			      store.createContext(),
			      function() {assert.ok(false);} );
	    store.match_items([new Bind('x',function(_){return 24;}),
			       new Match(['X',new chr.Variable('x')]) ],
			      store.createContext(),
			      function() {assert.ok(false);} );
	});
    });
    describe('Context.instantiate()',function() {
	var     Var = chr.Variable;
	var VarRest = chr.VariableRest;
	var   store = new chr.Store();
	var context = store.createContext();
	context.set('p',18);
	context.set('q',23);
	context.set('r',[111,112]);
	context.set('s',{a:777,b:888});
	it("should instantiate a constant term",function() {
	    assert.equal(18,context.instantiate(18));
	});
	it("should instantiate a single term",function() {
	    assert.equal(18,context.instantiate(new Var('p')));
	});
	it("should instantiate a list",function() {
	    assert.deepEqual([18],      context.instantiate([new Var('p')]));
	    assert.deepEqual([18,19,23],context.instantiate([new Var('p'),19,new Var('q')]));
	});
	it("should instantiate a map",function() {
	    assert.deepEqual({p:18},     context.instantiate({p:new Var('p')}));
	    assert.deepEqual({p:18,q:23},context.instantiate({q:new Var('q'),p:new Var('p')}));
	});
	it("should instantiate a list with terminal VariableRest",function() {
	    assert.deepEqual([111,112],context.instantiate([new VarRest('r')]));
	    assert.deepEqual([18,111,112],context.instantiate([new Var('p'),new VarRest('r')]));
	});
	it("should instantiate a list with medial VariableRest",function() {
	    assert.deepEqual([18,111,112,23],context.instantiate([new Var('p'),new VarRest('r'),new Var('q')]));
	});
	it("should instantiate a map with VariableRest",function() {
	    assert.deepEqual({a:777,b:888},context.instantiate({'':new VarRest('s')}));
	    assert.deepEqual({a:777,b:888,c:999},context.instantiate({c:999,'':new VarRest('s')}));
	});
	it("should instantiate nested structures",function() {
	    assert.deepEqual([1,[{a:777,b:888}],2],context.instantiate([1,[{'':new VarRest('s')}],2]));
	});
    });
    describe('Snap()',function() {
	it("should zero gracefully",function() {
	    var store = new chr.Store();
	    var  snap = new chr.Snap([new Match(["X",new chr.Variable('x')])],
				     1337,
				     function(v,ctx){return v+ctx.get('x');} );
	    assert.equal(store.snap(snap),1337);
	    store.add(["Y",100]);
	    assert.equal(store.snap(snap),1337);
	});
	it("should guard firmly",function() {
	    var store = new chr.Store();
	    var  snap = new chr.Snap([new Match(["X",new chr.Variable('x')]),
				      new Guard(function(){return false;}) ],
				     0,
				     function(v,ctx){return v+ctx.get('x');} );
	    store.add(["X",100]);
	    assert.equal(store.snap(snap),0);
	});
	it("should match a single head",function() {
	    var store = new chr.Store();
	    var  snap = new chr.Snap([new Match(["X",new chr.Variable('x')])],
				     0,
				     function(v,ctx){return v+ctx.get('x');} );
	    assert.equal(store.snap(snap),0);
	    store.add(["X",100]);
	    assert.equal(store.snap(snap),100);
	    store.add(["X",1]);
	    assert.equal(store.snap(snap),101);
	    store.add(["Y",99]);
	    assert.equal(store.snap(snap),101);
	});
	it("should match a single head (tersely)",function() {
	    var store = new chr.Store();
	    var  snap = new chr.Snap([new Match(["X",new chr.Variable('x')])],
				     function(v,ctx){return (v||0)+ctx.get('x');} );
	    assert.equal(store.snap(snap),undefined);
	    store.add(["X",100]);
	    assert.equal(store.snap(snap),100);
	    store.add(["X",1]);
	    assert.equal(store.snap(snap),101);
	    store.add(["Y",99]);
	    assert.equal(store.snap(snap),101);
	});
	it("should match a single head (quite tersely)",function() {
	    var store = new chr.Store();
	    var  snap = new chr.Snap([new Match(["X",new chr.Variable('x')])],
				     undefined,
				     function(v,ctx){return (v||0)+ctx.get('x');} );
	    assert.equal(store.snap(snap),undefined);
	    store.add(["X",100]);
	    assert.equal(store.snap(snap),100);
	    store.add(["X",1]);
	    assert.equal(store.snap(snap),101);
	    store.add(["Y",99]);
	    assert.equal(store.snap(snap),101);
	});
	it("should match dual heads",function() {
	    var store = new chr.Store();
	    var  snap = new chr.Snap([new Match(["X",new chr.Variable('x'),new chr.Variable('p')]),
				      new Match(["X",new chr.Variable('x'),new chr.Variable('q')]),
				      new Guard(function(ctx){return ctx.get('p')>ctx.get('q');}) ],
				     0,
				     function(v,ctx){return v+ctx.get('p')+ctx.get('q');} );
	    store.add(["X",1,10]);
	    store.add(["X",2,20]);
	    store.add(["X",2,30]);
	    assert.equal(store.snap(snap),50);
	});
	it("should match triple heads",function() {
	    var store = new chr.Store();
	    var  snap = new chr.Snap([new Match(["X",new chr.Variable('x'),new chr.Variable('p')]),
				      new Match(["X",new chr.Variable('x'),new chr.Variable('q')]),
				      new Match(["X",new chr.Variable('x'),new chr.Variable('r')]),
				      new Guard(function(ctx){return ctx.get('p')>ctx.get('q') &&
							      ctx.get('q')>ctx.get('r');}) ],
				     0,
				     function(v,ctx){return v+ctx.get('p')+ctx.get('q')+ctx.get('r');} );
	    store.add(["X",1,10]);
	    store.add(["X",2,20]);
	    store.add(["X",2,30]);
	    assert.equal(store.snap(snap),0);
	    store.add(["X",2,40]);
	    assert.equal(store.snap(snap),90);
	});
    });
});
