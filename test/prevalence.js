var prevalence = require("../prevalence.js");

var          _ = require("underscore");
var     assert = require("assert");
var       temp = require('temp');  
var         fs = require('fs');
var       util = require('../util.js');
var       path = require('path');

temp.track();                   // auto-cleanup at exit

util.verbosity = 1;             // suppress debug msgs

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
        var prvl = prevalence();
        var   bl = new BL();
        var  dir = temp.mkdirSync();
        var  wbl = prvl._private.wrap(dir,bl,{audit:false});
        wbl.init();
        assert.equal(wbl.query('n'),100);
    });
    it("should save and reload",function() {
        var prvl = prevalence();
        var   bl = new BL();
        var  dir = temp.mkdirSync();
        var  wbl = prvl._private.wrap(dir,bl,{audit:false});
        wbl.init();
        wbl.open();
        wbl.update('tick');
        wbl.update('tick');
        wbl.update('tick');
        wbl.update('tick');
        assert.equal(wbl.query('n'),104);
        wbl.save();
        wbl.close();
        wbl = prvl._private.wrap(dir,bl,{audit:false});
        wbl.open();
        wbl.load();
        assert.equal(wbl.query('n'),104);
        wbl.update('tick');
        assert.equal(wbl.query('n'),105);
        wbl.close();
    });
    it("should restore from journal",function() {
        var prvl = prevalence();
        var   bl = new BL();
        var  dir = temp.mkdirSync();
        var  wbl = prvl._private.wrap(dir,bl,{audit:false});
        wbl.init();
        wbl.open();
        wbl.save();
        wbl.update('tick');
        wbl.update('tick');
        wbl.update('tick');
        wbl.update('tick');
        assert.equal(wbl.query('n'),104);
        wbl.close();
        wbl = prvl._private.wrap(dir,bl,{audit:false});
        wbl.open();
        wbl.load();
        assert.equal(wbl.query('n'),104);
        wbl.update('tick');
        assert.equal(wbl.query('n'),105);
        wbl.close();
    });
});

// use this to defeat `require` cacheing
function clonefile(filename) {
    var dir = temp.mkdirSync();
    var  fn = path.join(dir,path.basename(filename));
    fs.writeFileSync(fn,fs.readFileSync(filename));
    return fn;
}

describe("cacheFile",function() {
    var make_prvl = function(dir) {
        var   bl = 'test/bl/simple.js';
        var pdir = path.join(dir,'prevalence');
        var prvl = prevalence();
        fs.mkdirSync(pdir);
        var  wbl = prvl.wrap(pdir,bl,{audit:true});
        wbl.init();
        wbl.open();
        return prvl;
    }
    var text = "Not many, Uncle!";
    it("saves a copy of a file",function() {
        var  dir = temp.mkdirSync();
        var   fn = path.join(dir,'cacheme.txt');
        var prvl = make_prvl(dir);
        var   hs = prvl._private.getHashStore();
        fs.writeFileSync(fn,text);
        var   cf = prvl.cacheFile(fn);
        assert(hs.contains(cf[0]));                // return value 0 is hash
        assert.equal(fs.readFileSync(cf[1]),text); // return value 1 is filename in cache
    });
    it("notes file in journal",function() {
        var  dir = temp.mkdirSync();
        var   fn = path.join(dir,'cacheme.txt');
        var prvl = make_prvl(dir);
        var   hs = prvl._private.getHashStore();
        fs.writeFileSync(fn,text);
        var   cf = prvl.cacheFile(fn);
        var   ok = false;
        util.readFileLinesSync(path.join(dir,'prevalence','state','journal'),function(line) {
            var js = util.deserialise(line);
            ok = ok || (js[1]==='http' && js[2][0]===fn && js[2][1]===cf[0])
            return true;
        });
        assert(ok);
    });
    it("replays a copy of a file",function() {
        var  dir = temp.mkdirSync();
        var   fn = path.join(dir,'cacheme.txt');
        var prvl = make_prvl(dir);
        var   hs = prvl._private.getHashStore();
        fs.writeFileSync(fn,text);
        var   cf = prvl.cacheFile(fn);
        cf = prvl.cacheFile(fn);                   // do it a second time
        assert(hs.contains(cf[0]));
        assert.equal(fs.readFileSync(cf[1]),text);
    });
    it("updates cache, retaining previous entry",function() {
        var  dir = temp.mkdirSync();
        var   fn = path.join(dir,'cacheme.txt');
        var prvl = make_prvl(dir);
        var   hs = prvl._private.getHashStore();
        fs.writeFileSync(fn,text);
        var   cf = prvl.cacheFile(fn);
        var txt2 = text+"!!";
        fs.writeFileSync(fn,txt2);
        var  cf2 = prvl.cacheFile(fn);             // write different value
        assert(hs.contains(cf2[0]));
        assert.equal(fs.readFileSync(cf2[1]),txt2);
        assert(hs.contains(cf[0]));                // previous entry still there
        assert.equal(fs.readFileSync(cf[1]),text);
    });
});

function simple_prvl_http_get_test(prvl,bl_src,path,fn_setup,fn_check,statusCode,done) {
    bl_src = clonefile(bl_src);
    var express = require('express');
    var     app = express();
    var    http = require('http');
    var httpsrv = http.Server(app)
    var     dir = temp.mkdirSync();
    var     wbl = prvl.wrap(dir,bl_src,{audit:true});
    if (done===undefined) {
        done       = statusCode;
        statusCode = 200;
    }
    wbl.init();
    wbl.open();
    fn_setup(app);
    httpsrv.listen(0,function() { // +++ rewrite to use `supertest` +++
        var port = httpsrv.address().port;
        var opts = (typeof path)==='string' ? {path:path} : path;
        http.get(_.extend({server:'localhost',port:port},opts),function(res) {
            var data = '';
            assert.equal(res.statusCode,statusCode);
            res.on('data',function(chunk) {
                data += chunk;
            });
            res.on('end',function() {
                fn_check(data,
                         function(e) {
                             wbl.close();
                             done(e);
                         },
                         res);
            });
        }).on('error',done);
    });
}

describe('http replication',function() {
    var bl_src = 'test/bl/simple.js';
    var bl_hash;
    it("returns single-element hash list",function(done) {
        var prvl = prevalence();
        simple_prvl_http_get_test(prvl,bl_src,'/replication/hashes',
                                  function(app) {
                                      prvl.installHandlers(app,{prefix:'/replication'});
                                  },
                                  function(js,done) {
                                      var hash_store = prvl._private.getHashStore();
                                      var     hashes = JSON.parse(js);
                                      assert.equal(hashes.length,1); // one hash - bl file
                                      bl_hash = hash_store.putFileSync(bl_src);
                                      assert.equal(hashes[0],bl_hash);
                                      done();
                                  },
                                  done);
    });
    it("returns hash list",function(done) {
        var prvl = prevalence();
        simple_prvl_http_get_test(prvl,bl_src,'/replication/hashes',
                                  function(app) {
                                      var hash_store = prvl._private.getHashStore();
                                      prvl.installHandlers(app,{prefix:'/replication'});
                                      hash_store.putSync("1");
                                      hash_store.putSync("2");
                                      hash_store.putSync("3");
                                      hash_store.putSync("4");
                                      // there are now five elements in `hash_store`
                                  },
                                  function(js,done) {
                                      var hashes = JSON.parse(js);
                                      assert.equal(hashes.length,5);
                                      done();
                                  },
                                  done);
    });
    it("returns a hash from the store",function(done) {
        var prvl = prevalence();
        simple_prvl_http_get_test(prvl,bl_src,'/replication/hash/'+bl_hash,
                                  function(app) {
                                      prvl.installHandlers(app,{prefix:'/replication'});
                                  },
                                  function(data,done) {
                                      assert.equal(data,fs.readFileSync(bl_src));
                                      done();
                                  },
                                  done);
    });
    var deserialiseBody = function(data) {
        var lines = data.split('\n');
        return lines.splice(0,lines.length-1)
            .map(function(s){return util.deserialise(s);});
    };
    it("returns the world file",function(done) {
        var prvl = prevalence();
        simple_prvl_http_get_test(prvl,bl_src,'/replication/state/world',
                                  function(app) {
                                      prvl.installHandlers(app,{prefix:'/replication'});
                                  },
                                  function(data,done) {
                                      var lines = deserialiseBody(data);
                                      assert.deepEqual(lines[0],null); // this is a virgin world
                                      assert.deepEqual(lines[1],{});
                                      done();
                                  },
                                  done);
    });
    it("returns the journal file whole",function(done) {
        var prvl = prevalence();
        simple_prvl_http_get_test(prvl,bl_src,'/replication/state/journal',
                                  function(app) {
                                      prvl.installHandlers(app,{prefix:'/replication'});
                                  },
                                  function(data,done) {
                                      var lines = deserialiseBody(data);
                                      assert.equal(lines[0][1],"init");
                                      done();
                                  },
                                  done);
    });
    it("returns the journal file in part",function(done) {
        var prvl = prevalence();
        simple_prvl_http_get_test(prvl,bl_src,{path:'/replication/state/journal',
                                               headers:{'Range':'bytes=0-0'}},
                                  function(app) {
                                      prvl.installHandlers(app,{prefix:'/replication'});
                                  },
                                  function(data,done) {
                                      assert.equal(data,'['); // 0-0 should return exactly one char (the first)
                                      done();
                                  },
                                  206,
                                  done);
    });
});

describe('prevalence hash_store',function() {
    var  bl_src = 'test/bl/simple.js';
    var express = require('express');
    it("captures a file requested by GET",function(done) {
        var       prvl = prevalence();
        var    web_dir = temp.mkdirSync();
        var index_html = "<html><head></head><body></body></html>";
        fs.writeFileSync(path.join(web_dir,'index.html'),index_html);
        simple_prvl_http_get_test(prvl,bl_src,'/index.html',
                                  function(app) {
                                      app.use(prvl.createExpressMiddleware(web_dir));
                                      app.use(express.static(web_dir));
                                  },
                                  function(data,done,res) {
                                      var hash_store = prvl._private.getHashStore();
                                      var index_hash = prvl._private.hash.hash(index_html);
                                      assert.ok(hash_store.contains(index_hash));
                                      assert.equal(index_hash,res.headers['etag']);
                                      done();
                                  },
                                  done);
    });
});

describe("journal",function() {
    it("has monotonic, unique, ascending timestamps",function() {
        var prvl = prevalence();
        var tdir = temp.mkdirSync();
        prvl._private.init(tdir,{});
        prvl._private.open(tdir);
        prvl._private.set_syncjrnl('none');
        for (var i=0;i<100;i++)
            prvl._private.journalise('test',i);
        prvl._private.close();
        var ts = null;
        util.readFileLinesSync(path.join(tdir,'state','journal'),function(json) {
            var l = JSON.parse(json);
            if (ts!==null)
                assert(ts<l[0]);
            ts = l[0];
            return true;
        });
        assert(ts!==null);      // check we actually did something!
    });
});

// +++ test sanity checking +++
