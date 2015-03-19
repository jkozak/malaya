var  malaya = require("../malaya.js");

var       _ = require('underscore');
var  assert = require('assert');
var    temp = require('temp');
var    path = require('path');
var request = require('supertest');
var      fs = require('fs');
var    util = require('../util.js');

temp.track();                   // auto-cleanup at exit

var mkServer = function(opts) {
    var srvr =  malaya.createServer(_.extend({
        prevalenceDir: path.join(temp.mkdirSync(),'prevalence'),
        audit:         true,
        logging:       false,
        init:          true,
        tag:           'malaya-test',
        sync_journal:  'none'
    },opts));
    srvr.start();
    return srvr;
};

function fsExists(fn) {
    try {
        fs.statSync(fn);
        return true;
    } catch (e) {
        if (e.code==='ENOENT')  // OK on windows?
            return false;
        throw e;
    }
}

describe("server wrapper",function() {
    it("allows multiple servers to co-exist",function() {
        var srvr1 = mkServer({init:true,prevalenceDir:path.join(temp.mkdirSync(),'prevalence')});
        var srvr2 = mkServer({init:true,prevalenceDir:path.join(temp.mkdirSync(),'prevalence')});
        srvr2.close();
        srvr1.close();
    });
    it("does not allow multiple servers to share a prevalence dir",function() {
        var prevDir = path.join(temp.mkdirSync(),'prevalence');
        mkServer({init:true,prevalenceDir:prevDir});
        assert.throws(function() {
            mkServer({init:false,prevalenceDir:prevDir});
        });
    });
    describe("uninit",function() {
        it("cleans up a failed init",function() {
            var prevalenceDir = path.join(temp.mkdirSync(),'prevalence');
            assert(!fsExists(prevalenceDir));
            var          srvr = mkServer({init:true,prevalenceDir:prevalenceDir});
            assert(fsExists(prevalenceDir));
            srvr.uninit();
            assert(!fsExists(prevalenceDir));
        });
        it("does not touch an existing prevalence dir",function() {
            var prevalenceDir = path.join(temp.mkdirSync(),'prevalence');
            var          srvr = mkServer({init:true,prevalenceDir:prevalenceDir});
            assert(fsExists(prevalenceDir));
            srvr.close();
            srvr = mkServer({init:false,prevalenceDir:prevalenceDir});
            assert.throws(function() {
                srvr.uninit();
            });
            assert(fsExists(prevalenceDir));
        });
    });
});

describe("XXX express app",function() {
    var tdir = temp.mkdirSync();
    var wdir = path.join(tdir,'www');
    var srvr = mkServer({init:true,
                         sanityCheck:false,
                         webDir:wdir,
                         prevalenceDir:path.join(tdir,'prevalence') });
    var  app = srvr.makeExpressApp();
    var html = "<html></html>";
    fs.mkdirSync(wdir);
    fs.writeFileSync(path.join(wdir,'index.html'),html);

    it("serves webdir file as static content",function(done) {
        request(app).get('/index.html').expect('Content-Type','text/html').expect(200).expect(html).end(done);
    });
    it("handles unfound file gracefully",function(done) {
        request(app).get('/NoSUchFileYouBounder').expect(404).end(done);
    });
    it("redirects / ",function(done) {
        request(app).get('/').expect('Location','/index.html').expect(302).end(done);
    });
    it("serves tempdir file as static content",function(done) {
        var test = "one two three four";
        fs.writeFileSync(path.join(srvr._private.tempDir,'test1234'),test);
        request(app).get('/temp/test1234').expect(200).expect(test).end(done);
    });
    it("handles unfound chrjs file gracefully",function(done) {
        request(app).get('/NoSUchFileYouBounder.chrjs').expect(404).end(done);
    });
    it("compiles chrjs file into javascript",function(done) {
        fs.writeFileSync(path.join(wdir,'test.chrjs'),"module.exports = store {};");
        request(app).get('/test.chrjs')
            .expect(200)
            .expect('Content-Type',/^application\/javascript/)
            .expect(function(res) {
                var st = eval(res.text);
                assert.equal(st.size,0);
                st.add(['a']);
                assert.equal(st.size,1);
            })
            .end(done);
    });
    it("compiles chrjs file into javascript (cached)",function(done) {
        fs.writeFileSync(path.join(wdir,'test.chrjs'),"module.exports = store {};");
        request(app).get('/test.chrjs')
            .expect(200)
            .expect('Content-Type',/^application\/javascript/)
            .expect(function(res) {
                var st = eval(res.text);
                assert.equal(st.size,0);
                st.add(['a']);
                assert.equal(st.size,1);
            })
            .end(done);
    });
});

describe("XXX webserver",function() {
    var tdir = temp.mkdirSync();
    var wdir = path.join(tdir,'www');
    var srvr = mkServer({init:true,
                         sanityCheck:false,
                         webDir:wdir,
                         prevalenceDir:path.join(tdir,'prevalence') });
    var html = "<html></html>";
    var  app;
    fs.mkdirSync(wdir);
    fs.writeFileSync(path.join(wdir,'index.html'),html);

    before(function(done) {
        srvr.listen(0,function() {
            assert(srvr.port>30000);
            assert(srvr.port<65536);
            app = util.format("http://localhost:%d",srvr.port);
            done();
        });
    });
    
    it("serves webdir file as static content",function(done) {
        request(app).get('/index.html').expect('Content-Type','text/html').expect(200).expect(html).end(done);
    });
    it("handles unfound file gracefully",function(done) {
        request(app).get('/NoSUchFileYouBounder').expect(404).end(done);
    });
    it("redirects / ",function(done) {
        request(app).get('/').expect('Location','/index.html').expect(302).end(done);
    });
});
