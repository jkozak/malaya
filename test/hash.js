var hash   = require("../hash.js");

var assert = require("assert");
var temp   = require('temp');  
var fs     = require('fs');

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
    it("",function() {
    });
});
