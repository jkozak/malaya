var chr    = require("../chr.js");

var assert = require("assert");
var   util = require('../util.js');

var   Store = chr.Store;	// save some typing
var    Snap = chr.Snap;
var    Rule = chr.Rule;
var     Var = chr.Variable;
var VarRest = chr.VariableRest;
var   Match = chr.ItemMatch;
var   Guard = chr.ItemGuard;
var  Delete = chr.ItemDelete;
var     Add = chr.ItemAdd;
var    Bind = chr.ItemBind;
var    Fail = chr.ItemFail;


describe('match()',function() {
    var   store = new Store();
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
    
    var       p = new Var('p');       // make the testing a bit tidier  
    var       q = new Var('q');
    var      ps = new VarRest('ps');
    var      qs = new VarRest('qs');

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
    it("should add and delete facts using internal methods",function() {
	var store = new Store();
	assert.equal(store.length,0);
	var t1 = store._add([1,2,3]);
	assert.equal(store.length,1);
	var t2 = store._add([1,2,3]);
	assert.ok(t2>t1);
	assert.equal(store.length,2);	    // multiset
	var t3 = store._add({a:1,b:2});
	assert.ok(t3>t2);
	assert.equal(store.length,3);
	var t4 = store._add({a:1,b:2});
	assert.ok(t4>t3);
	assert.equal(store.length,4);	    // multiset
	store._delete(t1);
	assert.equal(store.length,3);
	store._delete(t2);
	assert.equal(store.length,2);
	store._delete(t4);
	assert.equal(store.length,1);
	store._delete(t3);
	assert.equal(store.length,0);
    });
    it("should add and test existence of facts using external methods",function() {
	var store = new Store();
	assert.equal(store.length,0);
	store.add(["X",18]);
	assert.equal(store.length,1);
	assert.ok(store.has(["X",18]));
    });
    describe('match_items()',function() {
	it("should bind variables",function() {
	    var   store = new Store();
	    var      ok = false;
	    store._match_items([new Bind('x',function(_){return 23;})],
			       store.createContext(),
			       function(item,context) {
				   assert.equal(context.get('x'),23);
				   ok = true;
			       });
	    assert(ok);
	    ok = false;
	    store._match_items([new Bind('x',function(_){return 23;}), // idempotent
				new Bind('x',function(_){return 23;}) ],
			       store.createContext(),
			       function(item,context) {
				   assert.equal(context.get('x'),23);
				   ok = true;
			       });
	    assert(ok);
	    store._match_items([new Bind('x',function(_){return 23;}),
				new Bind('x',function(_){return 24;}) ],
			       store.createContext(),
			       function() {ssert.ok(false);} );
	});
	it("should match bound variables to store",function() {
	    var   store = new Store();
	    var      ok = false;
	    store._match_items([new Bind('x',function(_){return 23;}),
				new Match(['X',new Var('x')])],
			       store.createContext(),
			       function() {assert.ok(false);} );
	    store._match_items([new Match(['X',new Var('x')]),
				new Bind('x',function(_){return 23;}) ],
			       store.createContext(),
			       function() {assert.ok(false);} );
	    store._add(['X',23]);
	    ok = false;
	    store._match_items([new Bind('x',function(_){return 23;}),
				new Match(['X',new Var('x')])],
			       store.createContext(),
			       function(item,context) {
				   assert.equal(context.get('x'),23);
				   ok = true;
			       });
	    assert.ok(ok);
	    ok = false;
	    store._match_items([new Match(['X',new Var('x')]),
				new Bind('x',function(_){return 23;}) ],
			       store.createContext(),
			       function(item,context) {
				   assert.equal(context.get('x'),23);
				   ok = true;
			       });
	    assert.ok(ok);
	    store._match_items([new Match(['X',new Var('x')]),
				new Bind('x',function(_){return 24;}) ],
			       store.createContext(),
			       function() {assert.ok(false);} );
	    store._match_items([new Bind('x',function(_){return 24;}),
				new Match(['X',new Var('x')]) ],
			       store.createContext(),
			       function() {assert.ok(false);} );
	});
    });
    describe('Context.instantiate()',function() {
	var   store = new Store();
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
	it("should instantiate Function",function() {
	    assert.deepEqual([19],context.instantiate(function(ctx){return [ctx.get('p')+1];}));
	});
    });
    describe('Snap()',function() {
	it("should zero gracefully",function() {
	    var store = new Store();
	    var  snap = new Snap([new Match(["X",new Var('x')])],
				 1337,
				 function(v,ctx){return v+ctx.get('x');} );
	    assert.equal(store.snap(snap),1337);
	    store._add(["Y",100]);
	    assert.equal(store.snap(snap),1337);
	});
	it("should guard firmly",function() {
	    var store = new Store();
	    var  snap = new Snap([new Match(["X",new Var('x')]),
				  new Guard(function(){return false;}) ],
				 0,
				 function(v,ctx){return v+ctx.get('x');} );
	    store._add(["X",100]);
	    assert.equal(store.snap(snap),0);
	});
	it("should match a single head",function() {
	    var store = new Store();
	    var  snap = new Snap([new Match(["X",new Var('x')])],
				 0,
				 function(v,ctx){return v+ctx.get('x');} );
	    assert.equal(store.snap(snap),0);
	    store._add(["X",100]);
	    assert.equal(store.snap(snap),100);
	    store._add(["X",1]);
	    assert.equal(store.snap(snap),101);
	    store._add(["Y",99]);
	    assert.equal(store.snap(snap),101);
	});
	it("should match a single head (tersely)",function() {
	    var store = new Store();
	    var  snap = new Snap([new Match(["X",new Var('x')])],
				 function(v,ctx){return (v||0)+ctx.get('x');} );
	    assert.equal(store.snap(snap),undefined);
	    store._add(["X",100]);
	    assert.equal(store.snap(snap),100);
	    store._add(["X",1]);
	    assert.equal(store.snap(snap),101);
	    store._add(["Y",99]);
	    assert.equal(store.snap(snap),101);
	});
	it("should match a single head (quite tersely)",function() {
	    var store = new Store();
	    var  snap = new Snap([new Match(["X",new Var('x')])],
				 undefined,
				 function(v,ctx){return (v||0)+ctx.get('x');} );
	    assert.equal(store.snap(snap),undefined);
	    store._add(["X",100]);
	    assert.equal(store.snap(snap),100);
	    store._add(["X",1]);
	    assert.equal(store.snap(snap),101);
	    store._add(["Y",99]);
	    assert.equal(store.snap(snap),101);
	});
	it("should match dual heads",function() {
	    var store = new Store();
	    var  snap = new Snap([new Match(["X",new Var('x'),new Var('p')]),
				  new Match(["X",new Var('x'),new Var('q')]),
				  new Guard(function(ctx){return ctx.get('p')>ctx.get('q');}) ],
				 0,
				 function(v,ctx){return v+ctx.get('p')+ctx.get('q');} );
	    store._add(["X",1,10]);
	    store._add(["X",2,20]);
	    store._add(["X",2,30]);
	    assert.equal(store.snap(snap),50);
	});
	it("should match triple heads",function() {
	    var store = new Store();
	    var  snap = new Snap([new Match(["X",new Var('x'),new Var('p')]),
				  new Match(["X",new Var('x'),new Var('q')]),
				  new Match(["X",new Var('x'),new Var('r')]),
				  new Guard(function(ctx){return ctx.get('p')>ctx.get('q') &&
							  ctx.get('q')>ctx.get('r');}) ],
				 0,
				 function(v,ctx){return v+ctx.get('p')+ctx.get('q')+ctx.get('r');} );
	    store._add(["X",1,10]);
	    store._add(["X",2,20]);
	    store._add(["X",2,30]);
	    assert.equal(store.snap(snap),0);
	    store._add(["X",2,40]);
	    assert.equal(store.snap(snap),90);
	});
    });
    describe('ItemAdd',function() {
	it("should add fact when appropriate",function() {
	    var store = new Store();
	    var    ok = false;
	    store._add(["X",17]);
	    store._match_items([new Match(["X",new Var('x')]),
     				new Add(["Y",new Var('x')]) ],
			       store.createContext(),
			       function(t,context) {
				   assert.equal(context.adds.length,   1);
				   assert.equal(context.deletes.length,0);
				   context.install(); // put it in the store
				   ok = true;
			       });
	    assert.ok(ok);
	    assert.equal(store.length,2);
	});
	it("should not add facts inappropriately",function() {
	    var store = new Store();
	    store._add(["Y",17]);
	    store._match_items([new Match(["X",new Var('x')]),
     				new Add(["Y",new Var('x')]) ],
			       store.createContext(),
			       function(t,context) {
				   assert.ok(false);
			       });
	    assert.equal(store.length,1);
	});
	it("should add multiple facts",function() {
	    var store = new Store();
	    var   ctx;
	    store._add(["X",17]);
	    store._add(["X",18]);
	    store._match_items([new Match(["X",new Var('x')]),
     				new Add(["Y",new Var('x')]) ],
			       store.createContext(),
			       function(t,context) {
				   context.install();
			       });
	    assert.equal(store.length,4);
	});
	it("should add facts guardedly",function() {
	    var store = new Store();
	    var   ctx;
	    store._add(["X",17]);
	    store._add(["X",18]);
	    store._match_items([new Match(["X",new Var('x')]),
     				new Add(["Y",new Var('x')]),
				new Guard(function(ctx){return ctx.get('x')>17}) ],
			       store.createContext(),
			       function(t,context) {
				   context.install();
			       });
	    assert.equal(store.length,3);
	    assert.ok(store.has(["X",17]));
	    assert.ok(store.has(["X",18]));
	    assert.ok(store.has(["Y",18]));
	});
    });
    describe('ItemDelete',function() {
	it("should delete fact",function() {
	    var store = new Store();
	    var    ok = false;
	    store._add(["X",17]);
	    assert.equal(store.length,1);
	    store._match_items([new Delete(["X",new Var('x')])],
			       store.createContext(),
			       function(t,context) {
				   assert.equal(context.adds.length,   0);
				   assert.equal(context.deletes.length,1);
				   context.install(); // remove it from store
				   ok = true;
			       });
	    assert.ok(ok);
	    assert.equal(store.length,0);
	});
	it("should delete multiple facts",function() {
	    var store = new Store();
	    var   ctx;
	    store._add(["X",17]);
	    store._add(["X",18]);
	    store._add(["X",19]);
	    store._add(["Y",20]);
	    assert.equal(store.length,4);
	    store._match_items([new Delete(["X",new Var('x')])],
			       store.createContext(),
			       function(t,context) {
				   context.install();
			       });
	    assert.equal(store.length,1);
	    assert.ok(store.has(["Y",20]));
	});
	it("should delete facts guardedly",function() {
	    var store = new Store();
	    var   ctx;
	    store._add(["X",17]);
	    store._add(["X",18]);
	    store._add(["X",19]);
	    store._add(["Y",20]);
	    assert.equal(store.length,4);
	    store._match_items([new Delete(["X",new Var('x')]),
				new Guard(function(ctx){return ctx.get('x')>18}) ],
			       store.createContext(),
			       function(t,context) {
				   context.install();
			       });
	    assert.equal(store.length,3);
	});
	it("should de-dupe tersely",function() {
	    var store = new Store();
	    var   ctx;
	    store._add(["X",17]);
	    store._add(["X",17]);
	    store._add(["X",17]);
	    assert.equal(store.length,3);
	    store._match_items([new Match(new Var('x')),
		                new Delete(new Var('x')) ],
			       store.createContext(),
			       function(t,context) {
				   context.install();
			       });
	    assert.equal(store.length,1);
	});
	it("should not delete excessively (bug test)",function() {
	    var store = new Store();
	    var   ctx;
	    store._add(["X",{a:17}]);
	    assert.equal(store.length,1);
	    store._match_items([new Delete(["X",{a:0}])],
			       store.createContext(),
			       function(t,context) {
				   context.install();
			       });
	    assert.equal(store.length,1);
	    store._match_items([new Delete(["X",{a:17}])],
			       store.createContext(),
			       function(t,context) {
				   context.install();
			       });
	    assert.equal(store.length,0);
	});
    });
    describe('ItemFail',function() {
	it("should leave a trace",function() {
	    var store = new Store();
	    var    ok = false;
	    store._match_items([new Fail("oh dear")],
			       store.createContext(),
			       function(t,context) {
				   assert(context.fail=="oh dear");
				   ok = true;
			       });
	    assert.ok(ok);
	});
	it("should propagate its trace",function() {
	    var store = new Store();
	    var    ok = false;
	    store._match_items([new Fail("oh dear"),
				new Guard(function(_){return false;}) ],
			       store.createContext(),
			       function(t,context) {
				   assert(context.fail=="oh dear");
				   ok = true;
			       });
	    assert.ok(ok);
	});
    });
    describe('Rule()',function() {
    	it("should add new facts via rules",function() {
    	    var store = new Store();
    	    store._add_rule(new Rule([new Match(["X",new Var('x')]),
    				      new Add(["Y",new Var('x')]) ]));
    	    assert.equal(store.length,0);
    	    store.add(["X",7]);
    	    assert.equal(store.length,2);
    	    assert.ok(store.has(["X",7]));  // the one we put in 
    	    assert.ok(store.has(["Y",7]));  // added by the rule above
    	});
    	it("should delete and add new facts via rules",function() {
    	    var store = new Store();
    	    store._add_rule(new Rule([new Delete(["X",new Var('x')]),
				      new Match(["Z",new Var('y')]),
				      new Guard(function(ctx){return true;}),
    				      new Add(["Y",new Var('x')]) ]));
    	    store.add(["Z",0]);
    	    assert.equal(store.length,1);
    	    store.add(["X",37]);
    	    assert.equal(store.length,2);
    	    assert.ok(store.has(["Y",37])); // added by the rule above
    	});
    	it("should add new facts in presence of irrelevant rules",function() {
    	    var store = new Store();
    	    store._add_rule(new Rule([new Match(["X",new Var('x')]),
    				      new Add(["Y",new Var('x')]) ]));
    	    assert.equal(store.length,0);
    	    store.add(["Z",57]);
    	    assert.equal(store.length,1);
    	    assert.ok(store.has(["Z",57])); // the one we put in 
    	});
    	it("should process new facts through rules",function() {
    	    var store = new Store();
    	    store._add_rule(new Rule([new Delete(["Y",new Var('x')]) ]));
    	    store._add_rule(new Rule([new Match(["X",new Var('x')]),
    				      new Add(["Y",new Var('x')]) ]));
    	    assert.equal(store.length,0);
    	    store.add(["X",27]); // creates a Y which should be re-processed and deleted
    	    assert.equal(store.length,1);
    	    assert.ok(store.has(["X",27]));
    	});
    });
    describe('OrderBy',function() {
	it("should sort if asked",function() {
    	    var store = new Store();
    	    store.add(["X",17]);
    	    store.add(["X",18]);
    	    store.add(["X",19]);
	    assert.deepEqual(store.snap(new Snap([new Match(["X",new Var('x')],
							    function(ctx) {return ctx.get('x');} )],
						  [],
						  function(v,ctx){return v.concat([ctx.get('x')]);} )),
			     [17,18,19]); // sort ascending
	    assert.deepEqual(store.snap(new Snap([new Match(["X",new Var('x')],
							    function(ctx) {return -ctx.get('x');} )],
						  [],
						  function(v,ctx){return v.concat([ctx.get('x')]);} )),
			     [19,18,17]); // sort descending
	});
    });
});

describe('business logic interface',function() {
    it("should save and load via JSON",function() {
    	var store = new Store();
    	store.add(["X",17]);
    	store.add(["X",18]);
    	store.add(["X",19]);
	assert.equal(store.length,3);
	assert.ok(store.has(["X",17]));
	assert.ok(store.has(["X",18]));
	assert.ok(store.has(["X",19]));
	var js = JSON.stringify(store.get_root());
	store = new Store();
	store.set_root(JSON.parse(js));
	assert.equal(store.length,3);
	assert.ok(store.has(["X",17]));
	assert.ok(store.has(["X",18]));
	assert.ok(store.has(["X",19]));
    });
});

describe("bespoke `_prepare` compiler",function() {
    it("should produce a function",function() {
	var store = new chr.Store();
	store._genPrepare();
	assert.strictEqual((typeof store._prepare),'function');
    });
    it("should produce a function with useful contents",function() {
    	var store = new Store();
    	store._add_rule(new Rule([new Delete(["X",new Var('x')]),
				  new Match(["Z",new Var('y')]),
				  new Guard(function(ctx){return true;}),
    				  new Add(["Y",new Var('x')]) ]));
	store._genPrepare();
    	store.add(["Z",0]);
    	assert.equal(store.length,1);
    	store.add(["X",37]);
    	assert.equal(store.length,2);
    	assert.ok(store.has(["Y",37])); // added by the rule above
    });
    it("should produce a function which handles the unexpected",function() {
    	var store = new Store();
    	store._add_rule(new Rule([new Delete(["X",new Var('x')]),
				  new Match(["Z",new Var('y')]),
				  new Guard(function(ctx){return true;}),
    				  new Add(["Y",new Var('x')]) ]));
	store._genPrepare();
    	store.add({});
    	assert.equal(store.length,1);
    	assert.ok(store.has({}));
    });
});


