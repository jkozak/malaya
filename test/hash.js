var hash    = require("../hash.js");

var assert  = require("assert");
var temp    = require('temp').track();  
var util    = require('../util.js');  
var fs      = require('fs');
var path    = require('path');
var os      = require('os');
var jsc     = require('jsverify');
var resumer = require('resumer');

describe("hash('sha1')",function() {
    it("should produce correct well-known values",function() {
        assert.equal(hash('sha1').hash(''),      'da39a3ee5e6b4b0d3255bfef95601890afd80709');
        assert.equal(hash('sha1').hash('wibble'),'02e0182ae38f90d11be647e337665e67f9243817');
    });
    it("should import and export values",function() {
        var   dir = temp.mkdirSync();
        var store = hash('sha1').makeStore(dir);
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
        var   dir = temp.mkdirSync();
        var store = hash('sha1').makeStore(dir);
        jsc.assert(jsc.forall("string",function(s) {
            var h = store.putSync(s);
            return s===store.getSync(h);
        }));
    });
    it("should import files",function() {
        var  sdir = temp.mkdirSync(); // store
        var  tdir = temp.mkdirSync(); // scratch
        var store = hash('sha1').makeStore(sdir);
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
        var store = hash('sha1').makeStore(sdir);
        jsc.assert(jsc.forall("string",function(s) {
            var fn = path.join(tdir,'xxx');
            fs.writeFileSync(fn,s);
            var h = store.putFileSync(fn);
            if (s!==store.getSync(h))
                return false;
            if (!store.contains(h))
                return false
            return true;
        }));
    });
    it("should detect containment",function() {
        var   dir = temp.mkdirSync();
        var store = hash('sha1').makeStore(dir);
        assert.ok( store.contains(store.putSync('this is a test line')));
        assert.ok(!store.contains(hash('sha1').hash('')));
        assert.ok( store.contains(store.putSync('')));
    });
    it("should check store for consistency",function() {
        var   dir = temp.mkdirSync();
        var store = hash('sha1').makeStore(dir);
        var     h = store.putSync('this is the right line');
        assert.doesNotThrow(function() {
            store.sanityCheck({});
        });
        fs.writeFileSync(store.makeFilename(h),"this is the wrong line");
        assert.throws(function() {
            store.sanityCheck({});
        });
    });
    var testHashMode = function(env,u,g,o) {
        var  save = {env:util.env};
        var   dir = temp.mkdirSync();
        var store = hash('sha1').makeStore(dir);
        util.env = env;
        try {
            var  h = store.putSync('keep me for a bit');
            var fn = store.makeFilename(h);
            if (u!==null)
                assert.equal((fs.statSync(fn).mode>>6)&7,u); 
            if (g!==null)
                assert.equal((fs.statSync(fn).mode>>3)&7,g); 
            if (o!==null)
                assert.equal((fs.statSync(fn).mode>>0)&7,o); 
            fs.chmodSync(fn,438); // 0666
        } finally {
            util.env = save.env;
        }
    };
    it("should set stashed hashes to read-only in production mode",function() {
        testHashMode('prod',4,null,4);
    });
    if (!/^win/.test(os.platform())) { // +++ make work on windows +++
        it("should leave stashed hashes read-write in dev mode",function() {
            testHashMode('dev', 6,null,4);
        });
        it("should leave stashed hashes read-write in test mode",function() {
            testHashMode('test',6,null,4);
        });
    }
    describe("#createWriteStream",function() {
        var roundTrip = function(contents,hash0,done) {
            var   dir = temp.mkdirSync();
            var store = hash('sha1').makeStore(dir);
            var    ws = store.createWriteStream();
            ws.on('stored',function(hash) {
                assert.equal(hash,hash0);
                assert.equal(fs.readFileSync(store.makeFilename(hash)),contents);
                done();
            });
            resumer().queue(contents).end().pipe(ws);
        }
        it("should create an empty file",function(done) {
            roundTrip('','da39a3ee5e6b4b0d3255bfef95601890afd80709',done);
        });
        it("should create a trivial file",function(done) {
            roundTrip('wibble','02e0182ae38f90d11be647e337665e67f9243817',done);
        });
        it("should create a trivial binary file",function(done) {
            roundTrip('\x00','5ba93c9db0cff93f52b521d7420e43f6eda2784f',done);
        });
    });
});
