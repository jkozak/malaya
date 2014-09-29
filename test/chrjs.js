var   chrjs = require("../chrjs.js");

var       _ = require('underscore');
var  assert = require("assert");
var    temp = require('temp');
var    util = require('../util.js');
var    path = require('path');
var      fs = require('fs');
var  pretty = require('prettyjson');

temp.track();

describe('chrjs parser',function() {
    it("should parse map",function() {
 	var x = chrjs._private.parse("store { {a:[],c:22};};");
 	//console.log(util.format("*** macro expands to: %j",x));
    });
    it("should parse list",function() {
 	var x = chrjs._private.parse("store { ['X',19,{a:1}];};");
 	//console.log(util.format("*** macro expands to: %j",x));
    });
    it("should parse rule",function() {
 	var x = chrjs._private.parse("store { rule ( +['A',a,...r1],a==100,{B:a,C,...r2}); };");
 	//console.log(util.format("\n*** macro expands to: %j",x));
    });
    it("should parse named store",function() {
 	var x = chrjs._private.parse("store fred { rule ( +['A',a,...r1],a==100,b=10,{B:a,...r2}); };");
 	//console.log(util.format("\n*** macro expands to: %j",x));
    });
    it("should parse query",function() {
 	var x = chrjs._private.parse("store fred { query q(;['A',x];a) 0:a+x; };");
 	//console.log(util.format("\n*** macro expands to: %j",x));
    });
    it("should parse snap",function() {
 	var x = chrjs._private.parse("store fred { rule (['A',x],+['B',10*snap(['C',x];a) 0:a+x] ); };");
 	//console.log(util.format("\n*** macro expands to: \n"+pretty.render(x,{noColor:true})));
    });
    it("should reject chrjs extensions outside store",function() {
	assert.throws(function() {
 	    chrjs._private.parse("snap(['C',x];a) 0:a+x;");
	});
	assert.throws(function() {
 	    chrjs._private.parse("rule(['C',x]);");
	});
	assert.throws(function() {
 	    chrjs._private.parse("var x = [...rs];");
	});
	assert.throws(function() {
 	    chrjs._private.parse("var x = {...rs};");
	});
	assert.throws(function() {
 	    chrjs._private.parse("var x = {s};");
	});
    });
    it("should parse ^ operator",function() {
 	var x = chrjs._private.parse("store { rule (['X',19,{a:1},b]^b);};");
 	var y = chrjs._private.parse("store { rule (-['X',19,{a:1},b]^b);};");
 	//console.log(util.format("*** macro expands to: %j",x));
    });
    it("should parse # operator",function() {
 	var x = chrjs._private.parse("store { rule (['X',19,{a:1},b]#t);};");
 	var y = chrjs._private.parse("store { rule (-['X',19,{a:1},b]#t);};");
 	//console.log(util.format("*** macro expands to: %j",x));
    });
    it("should parse # and ^ operators",function() {
 	var x = chrjs._private.parse("store { rule (['X',19,{a:1},b]#t^b);};");
 	var y = chrjs._private.parse("store { rule (['X',19,{a:1},b]^b#t);};");
 	//console.log(util.format("*** macro expands to: %j",x));
    });
});

describe('chrjs transformer (interpreter)',function() {
    var compile = function(s,followUp) {
	(function() {
 	    var x = chrjs._private.compile(s);
	    eval(x);
	    if (followUp)
		eval(followUp);
	})()
    }
    it("should compile trivial store",function() {
 	compile("store S1 {};");
    });
    it("should compile store with contents",function() {
 	compile("store S1 {[1];{a:17}};");
    });
    it("should compile store with simple rules",function() {
 	compile("store S1 {rule ([1,a]);};");
 	compile("store S1 {rule ([1,a],-[2,a],{...rs},b=a+23)};");
 	compile("store S1 {rule ([1,a],-[2,a],{...rs},b=a+23,b>a)};");
 	compile("store S1 {rule ([1,a]^a);};");
 	//console.log(util.format("*** macro expands to: %j",t));
    });
    it("should generate code that does something",function() {
	compile("store s1 {['A',17];}","s1.get_root();");
    });
    it("should compile rule preceded by fact",function() {
 	compile("store IDB { ['instrument',{name:'IL21'}]; rule (['match-price']);}");
    });
    it("should compile rule with bindOne",function() {
 	compile("store IDB { rule (['match-price',{a,p:1}]);}");
    });
    it("should compile rule with bindMany",function() {
 	compile("store IDB { rule (['match-price',{a,p:1,...r}]);}");
    });
    it("should compile # and ^ operators",function() {
 	compile("store s { rule (['X',19,{a:1},b]#t^b);};");
 	compile("store s { rule (['X',19,{a:1},b]^b#t);};");
    });
});

// +++ move this into a chrjs test file +++
describe("real-world-ish: match",function() {
    it("should work for simple trades",function() {
	var store = require('./bl/match.chrjs'); // this isn't consistent with prevalence tests
	var  size = store.length;
	var     x;
	x = store.update(['match-price',{user:"John Kozak", instrument:"IL21", volume:10000000, isBuy:true,  t:1}]);
	assert.strictEqual(x.err,null);
	assert.strictEqual(_.size(x.adds),1); // one fact added
	assert.strictEqual(_.size(x.dels),0);
	assert.equal(store.length,size+1);    // one fact added 
	x = store.update(['match-price',{user:"Val Wardlaw",instrument:"IL21", volume: 9000000, isBuy:false, t:2}]);
	assert.strictEqual(_.size(x.adds),2); // two facts added
	assert.strictEqual(_.size(x.dels),1); // delete original JK price
	var nT = 0;			      // +++ do this better in chrjs +++
	_.each(x.adds,function(v) {
	    if (v[0]==='match-trade')
		nT++;
	})
	assert.equal(nT,1);
    });
});
