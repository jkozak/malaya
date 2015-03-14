var prevalence = require("../prevalence.js");

var     assert = require("assert");
var       temp = require('temp');  
var         fs = require('fs');
var       util = require('../util.js');
var       path = require('path');

temp.track();			// auto-cleanup at exit

util.verbosity = 1;		// suppress debug msgs

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

function simple_prvl_http_get_test(prvl,bl_src,path,fn_setup,fn_check,done) {
    bl_src = clonefile(bl_src);
    var express = require('express');
    var     app = express();
    var    http = require('http');
    var httpsrv = http.Server(app)
    var     dir = temp.mkdirSync();
    var     wbl = prvl.wrap(dir,bl_src,{audit:true});
    wbl.init();
    wbl.open();
    fn_setup(app);
    httpsrv.listen(0,function() {
	var port = httpsrv.address().port;
	http.get({server:'localhost',port:port,path:path},function(res) {
	    var data = '';
	    assert.equal(res.statusCode,200);
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
    it("returns the current journal snapshot",function(done) {
	var prvl = prevalence();
	simple_prvl_http_get_test(prvl,bl_src,'/replication/journal',
				  function(app) {
				      prvl.installHandlers(app,{prefix:'/replication'});
				  },
				  function(data,done) {
				      var jrnls = data.split('\n');
				      assert.equal(util.deserialise(jrnls[0])[1],'init');
				      done();
				  },
				  done);
    });
    it("returns the current journal (explicitly requested) snapshot",function(done) {
	var prvl = prevalence();
	simple_prvl_http_get_test(prvl,bl_src,'/replication/journal?live=0',
				  function(app) {
				      prvl.installHandlers(app,{prefix:'/replication'});
				  },
				  function(data,done) {
				      var jrnls = data.split('\n');
				      assert.equal(util.deserialise(jrnls[0])[1],'init');
				      done();
				  },
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
