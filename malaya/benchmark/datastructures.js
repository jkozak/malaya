"use strict";

if (false) {			// no need to run this each time
    
    var Immutable = require('immutable');
    var      util = require('../util.js');

    suite("Immutable data structures",function() {
	var map0   = Immutable.Map();
	var map10k = Immutable.Map();
	var set0   = Immutable.Set();
	var set10k = Immutable.Set();
	before(function(){
	    for (var i=0;i<10000;i++) {
		map10k = map10k.set(i,"10k");
		set10k = set10k.add(i);
	    }
	});
	bench("add item to empty Map",function() {
	    map0.set(99999,"the new item");
	});
	bench("add item to Map with 10k entries",function() {
	    map10k.set(99999,"the new item");
	});
	bench("delete item from Map with 10k entries",function() {
	    map10k.delete(1000);
	});
	bench("add item to empty Set",function() {
	    set0.add(99999);
	});
	bench("add item to Set with 10k entries",function() {
	    set10k.add(99999);
	});
	bench("delete item from Set with 10k entries",function() {
	    set10k.delete(1000);
	});
	bench("lookup item in 10k Map",function() {
	    return map10k.get(2000);
	});
    });

    suite("Standard data structures",function() {
	var obj0   = {};
	var obj10k = {};
	before(function(){
	    for (var i=0;i<10000;i++) {
		obj10k[i] = "10k";
	    }
	});
	bench("no-op",function() {
	});
	bench("add/delete item to/from empty Object",function() {
	    obj0[99999] = "the new item";
	    delete obj0[99999];
	});
	bench("add/delete item to/from Object with 10k entries",function() {
	    obj10k[99999] = "the new item";
	    delete obj10k[99999];
	});
	bench("lookup item in Object with 10k entries",function() {
	    return obj10k[2000];
	});
    });

    suite("Mutable data structures",function() {
	var map0   = Immutable.Map();
	var map10k = Immutable.Map();
	before(function(){
	    for (var i=0;i<10000;i++) {
		map10k = map10k.set(i,"10k");
	    }
	});
	bench("add item to empty Map",function() {
	    map0.set(99999,"the new item");
	});
	bench("add item to Map with 10k entries",function() {
	    map10k.set(99999,"the new item");
	});
	bench("delete item from Map with 10k entries",function() {
	    map10k.delete(1000);
	});
	bench("lookup item in 10k Map",function() {
	    return map10k.get(2000);
	});
    });
}
