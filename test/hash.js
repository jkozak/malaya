"use strict";

const hash    = require("../hash.js");

const assert  = require('assert').strict;
const temp    = require('temp').track();
const util    = require('../util.js');
const fs      = require('fs');
const path    = require('path');
const jsc     = require('jsverify');
const resumer = require('resumer');

describe("hash('sha1')",function() {
    it("should produce correct well-known values",function() {
        assert.equal(hash('sha1').hash(''),      'da39a3ee5e6b4b0d3255bfef95601890afd80709');
        assert.equal(hash('sha1').hash('wibble'),'02e0182ae38f90d11be647e337665e67f9243817');
    });
    it("should produce correct well-known values for files",function() {
        const  tdir = temp.mkdirSync();
        const efile = path.join(tdir,'empty');
        const wfile = path.join(tdir,'wibble');
        fs.writeFileSync(efile, '');
        fs.writeFileSync(wfile,'wibble');
        assert.equal(hash('sha1').hashFileSync(efile),'da39a3ee5e6b4b0d3255bfef95601890afd80709');
        assert.equal(hash('sha1').hashFileSync(wfile),'02e0182ae38f90d11be647e337665e67f9243817');
    });
    it("should import and export values",function() {
        const   dir = temp.mkdirSync();
        const store = hash('sha1').makeStore(dir);
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
        const   dir = temp.mkdirSync();
        const store = hash('sha1').makeStore(dir);
        jsc.assert(jsc.forall("string",function(s) {
            const h = store.putSync(s);
            return s===store.getSync(h);
        }));
    });
    it("should import files",function() {
        const  sdir = temp.mkdirSync(); // store
        const  tdir = temp.mkdirSync(); // scratch
        const store = hash('sha1').makeStore(sdir);
        fs.writeFileSync(tdir+'/a','');
        assert.equal(store.putFileSync(tdir+'/a'),'da39a3ee5e6b4b0d3255bfef95601890afd80709');
        fs.writeFileSync(tdir+'/b','wibble');
        assert.equal(store.putFileSync(tdir+'/b'),'02e0182ae38f90d11be647e337665e67f9243817');
        assert.equal(store.getSync('da39a3ee5e6b4b0d3255bfef95601890afd80709'),'');
        assert.equal(store.getSync('02e0182ae38f90d11be647e337665e67f9243817'),'wibble');
        assert.equal(store.getHashes().length,2);
        assert.notEqual(store.getHashes().indexOf("da39a3ee5e6b4b0d3255bfef95601890afd80709"),-1);
        assert.notEqual(store.getHashes().indexOf("02e0182ae38f90d11be647e337665e67f9243817"),-1);
    });
    it("should import arbitrary files",function() {
        this.timeout(10000);
        const  sdir = temp.mkdirSync(); // store
        const  tdir = temp.mkdirSync(); // scratch
        const store = hash('sha1').makeStore(sdir);
        jsc.assert(jsc.forall("string",function(s) {
            const fn = path.join(tdir,'xxx');
            fs.writeFileSync(fn,s);
            const h = store.putFileSync(fn);
            if (s!==store.getSync(h))
                return false;
            if (!store.contains(h))
                return false;
            return true;
        }));
    });
    describe("supports multiple encodings",function(){
        let   dir;
        let store;
        let  text;
        let     h;
        before(()=>{
            dir   = temp.mkdirSync();
            store = hash('sha1').makeStore(dir);
            text  = "testie mctestface";
            h     = store.putSync(text);
        });
        it("default (utf8)",function(){
            assert.strictEqual(typeof store.getSync(h),'string');
            assert.strictEqual(store.getSync(h),text);
        });
        it("ascii",function(){
            assert.strictEqual(typeof store.getSync(h,{encoding:'ascii'}),'string');
            assert.strictEqual(store.getSync(h,{encoding:'ascii'}),text);
        });
        it("uninterpreted binary",function(){
            assert(Buffer.isBuffer(store.getSync(h,{encoding:null})));
            assert.strictEqual(store.getSync(h,{encoding:null}).toString(),text);
        });
    });
    it("should detect containment",function() {
        const   dir = temp.mkdirSync();
        const store = hash('sha1').makeStore(dir);
        assert.ok( store.contains(store.putSync('this is a test line')));
        assert.ok(!store.contains(hash('sha1').hash('')));
        assert.ok( store.contains(store.putSync('')));
    });
    it("should check store for consistency",function() {
        const   dir = temp.mkdirSync();
        const store = hash('sha1').makeStore(dir);
        const     h = store.putSync('this is the right line');
        assert.doesNotThrow(function() {
            store.sanityCheck({});
        });
        fs.writeFileSync(store.makeFilename(h),"this is the wrong line");
        assert.throws(function() {
            store.sanityCheck({});
        });
    });
    const testHashMode = function(env,u,g,o) {
        const  save = {env:util.env};
        const   dir = temp.mkdirSync();
        const store = hash('sha1').makeStore(dir);
        util.env = env;
        try {
            const  h = store.putSync('keep me for a bit');
            const fn = store.makeFilename(h);
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
    if (!util.onWindows) { // +++ make work on windows +++
        it("should leave stashed hashes read-write in dev mode",function() {
            testHashMode('dev', 6,null,4);
        });
        it("should leave stashed hashes read-write in test mode",function() {
            testHashMode('test',6,null,4);
        });
    }
    it("uses working files nicely",function(){
        const dir = temp.mkdirSync();
        let store = hash('sha1').makeStore(dir);
        const   h = store.putSync("test line!  meet the test line");
        store.putSync("it's the modern test line");
        fs.renameSync(store.makeFilename(h),store.makeFilename(h)+'.tmp'); // fake a working file
        assert.strictEqual(store.getHashes().length,1);   // temp file hidden
        assert.strictEqual(fs.readdirSync(dir).length,2); // but exists
        store = hash('sha1').makeStore(dir);
        assert.strictEqual(store.getHashes().length,1);
        assert.strictEqual(fs.readdirSync(dir).length,1); // temp file deleted
    });
    describe("#createWriteStream",function() {
        const roundTrip = function(contents,hash0,done) {
            const   dir = temp.mkdirSync();
            const store = hash('sha1').makeStore(dir);
            const    ws = store.createWriteStream();
            ws.on('stored',function(hash1) {
                assert.equal(hash1,hash0);
                assert.equal(fs.readFileSync(store.makeFilename(hash1),'utf8'),contents);
                done();
            });
            resumer().queue(contents).end().pipe(ws);
        };
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
    describe("first line of file hashing",function(){
        const  tdir = temp.mkdirSync();
        const jfile = path.join(tdir,'journal');
        it("should produce correct well-known value for lone line",function() {
            fs.writeFileSync(jfile,'wibble\n');
            assert.equal(hash('sha1').hashFirstLineOfFileSync(jfile),'02e0182ae38f90d11be647e337665e67f9243817');
        });
        it("should produce correct well-known value for multiple lines",function() {
            fs.writeFileSync(jfile,'wibble\nwobble\n');
            assert.equal(hash('sha1').hashFirstLineOfFileSync(jfile),'02e0182ae38f90d11be647e337665e67f9243817');
        });
        it("should produce correct well-known value for multiple lines, improperly terminated",function() {
            fs.writeFileSync(jfile,'wibble\nwobble');
            assert.equal(hash('sha1').hashFirstLineOfFileSync(jfile),'02e0182ae38f90d11be647e337665e67f9243817');
        });

    });
});
