var prvl   = require("../prevalence.js");

var assert = require("assert");
var temp   = require('temp');  
var fs     = require('fs');

temp.track();			// auto-cleanup at exit

function BL() {
    var root;
    this.init = function() {
	root = {n:100};
    };
    this.get_root = function() {
	return root;
    };
    this.set_root = function(r) {
	root = r;
    };
    this.query = function(q) {
	if (q=='n')
	    return root.n;
    };
    this.update = function(u) {
	if (u=='tick')
	    root.n++;
    };
}

describe('wrap()',function() {
    it("should init",function() {
	var  bl = new BL();
	var dir = temp.mkdirSync();
	var wbl = prvl.wrap(dir,bl);
	wbl.init();
	assert.equal(wbl.query('n'),100);
    });
    it("should save and reload",function() {
	var  bl = new BL();
	var dir = temp.mkdirSync();
	var wbl = prvl.wrap(dir,bl);
	wbl.init();
	wbl.open();
	wbl.update('tick');
	wbl.update('tick');
	wbl.update('tick');
	wbl.update('tick');
	assert.equal(wbl.query('n'),104);
	wbl.save();
	wbl.close();
	wbl = prvl.wrap(dir,bl);
	wbl.open();
	wbl.load();
	assert.equal(wbl.query('n'),104);
	wbl.update('tick');
	assert.equal(wbl.query('n'),105);
    });
    it("should restore from journal",function() {
	var  bl = new BL();
	var dir = temp.mkdirSync();
	var wbl = prvl.wrap(dir,bl);
	wbl.init();
	wbl.open();
	wbl.save();
	wbl.update('tick');
	wbl.update('tick');
	wbl.update('tick');
	wbl.update('tick');
	assert.equal(wbl.query('n'),104);
	wbl.close();
	wbl = prvl.wrap(dir,bl);
	wbl.open();
	wbl.load();
	assert.equal(wbl.query('n'),104);
	wbl.update('tick');
	assert.equal(wbl.query('n'),105);
    });
});

describe('time()',function() {
    it("should provide a stable tick",function() {
	var  bl = new BL();
	var dir = temp.mkdirSync();
	var wbl = prvl.wrap(dir,bl);
	var   t;
	wbl.init();
	assert.equal(prvl.time(),0);
	wbl.open();
	t = prvl.time(); wbl.update('tick'); assert.ok(prvl.time()>t);
	t = prvl.time(); wbl.update('tick'); assert.ok(prvl.time()>t);
	t = prvl.time(); wbl.update('tick'); assert.ok(prvl.time()>t);
	t = prvl.time(); wbl.update('tick'); assert.ok(prvl.time()>t);
	t = prvl.time();
	wbl.save();
	wbl.close();
	wbl = prvl.wrap(dir,bl);
	wbl.open();
	wbl.load();
	assert.equal(prvl.time(),t);
    });
    it("should provide a stable date",function() {
	// +++
    });
});
