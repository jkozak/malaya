var hash   = require("../hash.js");

var assert = require("assert");
var temp   = require('temp');  
var util   = require('../util.js');  
var fs     = require('fs');
var path   = require('path');
var os     = require('os');
var qc     = require('quickcheck');


temp.track();			// auto-cleanup at exit

describe("hash('sha1')",function() {
    it("should produce correct well-known values",function() {
	assert.equal(hash('sha1').hash(''),      'da39a3ee5e6b4b0d3255bfef95601890afd80709');
	assert.equal(hash('sha1').hash('wibble'),'02e0182ae38f90d11be647e337665e67f9243817');
    });
    it("should import and export values",function() {
	var   dir = temp.mkdirSync();
	var store = hash('sha1').make_store(dir);
	assert.equal(store.getHashes().length,0);
	assert.equal(store.putSync(''),      'da39a3ee5e6b4b0d3255bfef95601890afd80709');
	assert.equal(store.getHashes().length,1);
	assert.notEqual(store.getHashes().indexOf("da39a3ee5e6b4b0d3255bfef95601890afd80709"),-1);
	assert.equal(store.putSync('wibble'),'02e0182ae38f90d11be647e337665e67f9243817');
	assert.equal(store.getHashes().length,2);
	assert.notEqual(store.getHashes().indexOf("02e0182ae38f90d11be647e337665e67f9243817"),-1);
	assert.equal(store.getSync('da39a3ee5e6b4b0d3255bfef95601890afd80709'),'');
	assert.equal(store.getSync('02e0182ae38f90d11be647e337665e67f9243817'),'wibble');
    });
    it("should import and export arbitrary values",function() {
	var           dir = temp.mkdirSync();
	var         store = hash('sha1').make_store(dir);
	var propRoundtrip = function(s) {
	    var h = store.putSync(s);
	    return s===store.getSync(h);
	};
	assert.ok(qc.forAll(propRoundtrip,qc.arbString));
    });
    it("should import files",function() {
	var  sdir = temp.mkdirSync(); // store
	var  tdir = temp.mkdirSync(); // scratch
	var store = hash('sha1').make_store(sdir);
	fs.writeFileSync(tdir+'/a','')
	assert.equal(store.putFileSync(tdir+'/a'),'da39a3ee5e6b4b0d3255bfef95601890afd80709');
	fs.writeFileSync(tdir+'/b','wibble')
	assert.equal(store.putFileSync(tdir+'/b'),'02e0182ae38f90d11be647e337665e67f9243817');
	assert.equal(store.getSync('da39a3ee5e6b4b0d3255bfef95601890afd80709'),'');
	assert.equal(store.getSync('02e0182ae38f90d11be647e337665e67f9243817'),'wibble');
	assert.equal(store.getHashes().length,2);
	assert.notEqual(store.getHashes().indexOf("da39a3ee5e6b4b0d3255bfef95601890afd80709"),-1);
	assert.notEqual(store.getHashes().indexOf("02e0182ae38f90d11be647e337665e67f9243817"),-1);
    });
    it("should import arbitrary files",function() {
	var  sdir = temp.mkdirSync(); // store
	var  tdir = temp.mkdirSync(); // scratch
	var store = hash('sha1').make_store(sdir);
	var propImported = function(s) {
	    var fn = path.join(tdir,'xxx');
	    fs.writeFileSync(fn,s);
	    var h = store.putFileSync(fn);
	    if (s!==store.getSync(h))
		return false;
	    if (!store.contains(h))
		return false
	    return true;
	};
	assert.ok(qc.forAll(propImported,qc.arbString));
    });
    it("should detect containment",function() {
	var   dir = temp.mkdirSync();
	var store = hash('sha1').make_store(dir);
	assert.ok( store.contains(store.putSync('this is a test line')));
	assert.ok(!store.contains(hash('sha1').hash('')));
	assert.ok( store.contains(store.putSync('')));
    });
    it("should check store for consistency",function() {
	var   dir = temp.mkdirSync();
	var store = hash('sha1').make_store(dir);
	var     h = store.putSync('this is the right line');
	assert.doesNotThrow(function() {
	    store.sanityCheck({});
	});
	fs.writeFileSync(store.makeFilename(h),"this is the wrong line");
	assert.throws(function() {
	    store.sanityCheck({});
	});
    });
    var  permModeMask = 7*8*8+7*8+7;
    var testHashMode = function(env,mode) {
	var  save = {env:util.env};
	var   dir = temp.mkdirSync();
	var store = hash('sha1').make_store(dir);
	util.env = env;
	try {
	    var  h = store.putSync('keep me for a bit');
	    var fn = store.makeFilename(h);
	    assert.equal(fs.statSync(fn).mode&permModeMask,mode); 
	    fs.chmodSync(fn,438); // 0666
	} finally {
	    util.env = save.env;
	}
    };
    it("should set stashed hashes to read-only in production mode",function() {
	testHashMode('prod',4*8*8+4*8+4);
    });
    if (!/^win/.test(os.platform())) { // +++ make work on windows +++
	it("should leave stashed hashes read-write in dev mode",function() {
	    testHashMode('dev', 6*8*8+4*8+4);
	});
	it("should leave stashed hashes read-write in test mode",function() {
	    testHashMode('test',6*8*8+4*8+4);
	});
    }
});
