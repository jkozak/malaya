// JSON prevalence

// state directory contains:
//  <dir>/world
//  <dir>/journal

// strategy for world-saving:
//  * close journal
//  * make new dir <dirname>-NEW
//  * write <dirname>-NEW/world
//  * sync,flush,whatever
//  * rm -rf <dirname>-OLD
//  * mv <dirname> <dirname>-OLD
//  * mv <dirname>-NEW <dirname>
//  * maybe open journal
// then when loading, try:
//  * <dirname> load
//  * if not found:  mv <dirname>-NEW <dirname> && <dirname> load
//  * if that fails: mv <dirname>-OLD <dirname> && <dirname> load

// use child_process.fork for mitosis save

// to use, journalise items _before_ evaluating (this is to make Dates work)

"use strict";

var fs    = require("fs");
var rm_rf = require("rimraf");
var hash  = require("./hash.js")('sha1');
var path  = require("path");
var util  = require("./util.js");

var consts = process.binding('constants');

var dir     = null;
var fd_jrnl = null;		// file descriptor
var date    = null;		// effective Date object
var t_jrnl  = null;		// #lines in active journal

var audit      = false;
var hash_store;
var bl_src;
var bl_files;
var bl_running;

var sync_journal = 'fsync';

var sanity_check = true;	// default to true if running production

var source_version = util.source_version;

function init(dirname,options) {
    // prepare a directory to be a store
    fs.mkdirSync(dirname+"/state");
    fs.writeFileSync(dirname+"/state/world",util.serialise(null)+"\n");
    fs.appendFileSync(dirname+"/state/world",util.serialise({})+"\n");
    open(dirname);
    journalise('init',options);
    close();
};

function open(dirname) {
    // open an existing store
    if (dir!==null)
	throw new Error("already open");
    try {
	fs.statSync(dirname+'/state');
    } catch (err) {
	try {
	    fs.renameSync(dirname+"/state-NEW",dirname+'/state');
	} catch (e) {
	    try {
		fs.renameSync(dirname+"/state-OLD",dirname+'/state');
	    } catch (e) {
		throw new Error("can't find a state dir to open");
	    }
	}
    }
    var flg =  (sync_journal==='o_sync') ? consts.O_APPEND|consts.O_CREAT|consts.O_WRONLY|consts.O_SYNC: 'a'
    fd_jrnl = fs.openSync(dirname+"/state/journal",flg);
    dir     = dirname;
    date    = null;
    t_jrnl  = null;
};

function close() {
    // close a store (quickly)
    if (fd_jrnl)
	fs.closeSync(fd_jrnl);
    fd_jrnl = null;
    dir     = null;
    date    = null;
    t_jrnl  = null;
};

function journalise(type,datum) {
    // write a journal entry
    if (fd_jrnl===null)
	throw new Error("journal is closed");
    date = new Date();
    t_jrnl++;
    var s = util.serialise([date,type,datum])+'\n';
    fs.writeSync(fd_jrnl,s,s.length,null);
    if (sync_journal==='fsync')
	fs.fsyncSync(fd_jrnl);
};

exports.date = function() {
    // get date
    if (date===null)
	throw new Error("date unset");
    return date;
};

function save(root) {
    // close a store by writing a new image (slow)
    if (dir===null)
	throw new Error("must be open to save");
    var dir_sav = dir;
    var dir_cur = dir+"/state"
    var dir_new = dir+"/state-NEW";
    var dir_old = dir+"/state-OLD";
    var syshash = null;
    close();
    if (audit) 
	syshash = hash_store.putFileSync(dir_cur+"/journal");
    rm_rf.sync(dir_new);
    fs.mkdirSync(dir_new);
    fs.writeFileSync( dir_new+"/world",util.serialise(syshash));
    fs.appendFileSync(dir_new+"/world","\n");
    fs.appendFileSync(dir_new+"/world",util.serialise(root));
    fs.appendFileSync(dir_new+"/world","\n");
    rm_rf.sync(dir_old);
    fs.renameSync(dir_cur,dir_old);
    fs.renameSync(dir_new,dir_cur);
    open(dir_sav);
    journalise('previous',syshash);
    return syshash;
};

function load(fn_root,fn_datum) {
    var world_file   = dir+"/state/world";
    var journal_file = dir+"/state/journal";
    var lineno       = 1;
    var syshash      = null;
    // load a store
    if (dir===null)
	throw new Error("must be open to load");
    util.readFileLinesSync(world_file,function(line) {
	switch (lineno++) {
	case 1:
	    syshash = util.deserialise(line); // only used by humans so far
	    return true;
	case 2:
	    fn_root(util.deserialise(line));
	    return false;
	}
    });
    try {
	t_jrnl = 0;
	util.readFileLinesSync(journal_file,function(line) {
	    var di = util.deserialise(line);
	    date = di[0];
	    if (di[1]=='update')
		fn_datum(di[2]);
	    date = null;
	    t_jrnl++;
	    return true;
	});
	if (t_jrnl===0)
	    journalise('previous',syshash);
    } catch (e) {
	if (e.code==='ENOENT')
	    journalise('previous',syshash);
	else
	    throw e;
    }
    // +++ don't create journal-file in `save` +++
    // +++ add `previous` line to journal here +++
    if (audit && sanity_check) {
	var deep_check = true;
	util.debug("sanity checking...");
	hash_store.sanityCheck();
	for (var hash=syshash;hash;) {          // ensure there is a full history for this hash
	    var i = 0;
	    util.readFileLinesSync(hash_store.makeFilename(hash),function(line) {
		var js = util.deserialise(line);
		if (i++===0) {
		    switch (js[1]) {
		    case 'init':
			hash = null;
			break;
		    case 'previous':
			hash = js[2];
			break;
		    default:
			throw new Error(util.format("bad log file hash: %s",hash));
		    }
		} else if (deep_check) {
		    switch (js[1]) {
		    case 'code':
			for (var k in js[2][2]) {
			    if (!hash_store.contains(js[2][2][k]))
				throw new Error("can't find source code for %s",k);
			}
			break;
		    case 'http':
			if (!hash_store.contains(js[2][1]))
			    throw new Error(util.format("can't find http item for %s",k));
			break;
		    }
		}
		return deep_check; // only read whole file if checking `code` items
	    })
	}
    }
    return syshash;
};

function wrap(dir,bl,options) {
    var ans = {
	init:function() {
	    init(dir,options);
	    bl.init();
	},
	open:function() {
	    open(dir);
	    if (audit) {
		journalise('code',[source_version,bl_src,bl_files]);
	    }
	},
	save:function() {
	    return save(bl.get_root());
	},
	close:function() {
	    close();
	},
	load:function() {
	    return load(bl.set_root,bl.update);
	},
	query:function(q) {
	    try {
		bl_running = true;
		return bl.query(q);
	    } finally {
		bl_running = false;
	    }
	},
	update:function(u) {
	    try {
		journalise('update',u);
		bl_running = true;
		return bl.update(u);
	    } finally {
		bl_running = false;
	    }
	}
    };
    if (bl.transform!==undefined) {
	if (bl.query!==undefined || bl.update!==undefined)
	    throw new Error("business logic should only define one of query+update or transform");
	ans.transform = function() {
	    try {
		bl_running = true;
		journalise('transform',null);
		return bl.transform();
	    } finally {
		bl_running = false;
	    }
	};
    }
    return ans;
};

exports.wrap = function(dir,bl,options) {
    bl_running = true;
    if (options==undefined)
	options = {audit:        true,
		   sync_journal: fsync};	        // default options
    sync_journal = options.sync_journal;
    if (sync_journal===undefined)
	sync_journal = 'o_sync';
    if (['fsync','o_sync','none'].indexOf(sync_journal)==-1)
	throw new Error("bad sync_journal option: "+sync_journal);
    audit = !!options.audit;
    if (audit) {
	bl_files   = {};
	hash_store = hash.make_store(dir+'/hashes');
	for (var k in require.extensions) {
	    require.extensions[k] = (function(ext) {
		return function(module,filename) {
		    if (bl_running) 
			bl_files[filename] = hash_store.putFileSync(filename);
		    return ext(module,filename);
		} })(require.extensions[k]);
	}
    }
    bl_src = bl===undefined ? 'bl' : bl;
    if (typeof(bl_src)==='string') {
	if (path.resolve(bl_src)!==path.normalize(bl_src)) // relative path?
	    bl_src = './'+bl_src;			   // be explicit if so
	bl = require(bl_src);
    } else {				// prebuilt business logic object
	if (audit)
	    throw new Error("auditing required and source code not found");
    }
    bl_running = false;
    return wrap(dir,bl,options);
};

exports.createExpressMiddleware = function(path) {
    var express = require('express');
    var    seen = {};
    var encache = function(url,filename,entry) {
	entry.hash = hash_store.putFileSync(filename);
	journalise('http',[url,entry.hash]);
	seen[url] = entry;
    };
    return function(req,res,next) {
	if (req.method==='GET' || req.method==='HEAD') {
	    try {
		var sn = seen[req.url];
		var fn = path+req.url;
		var st = fs.statSync(fn);
		var en = {mtime:st.mtime,size:st.size};
		if (sn) {
		    if (st.size!==sn.size || st.mtime.getTime()!==sn.mtime.getTime()) // has base file changed?
			encache(req.url,fn,en);
		} else
		    encache(req.url,fn,en);
		sn = seen[req.url];
		res.setHeader("Content-Type",express.static.mime.lookup(req.url));
		res.setHeader("ETag",        sn.hash);
		res.status(200).sendfile(hash_store.makeFilename(sn.hash));
		return;
	    } catch (e) {
		if (e.code!=='ENOENT')
		    throw e;
	    }
	}
	next();
    };
};

exports.installHandlers = function(app,options) {
    var express = require('express');
    options        = options || {};
    options.prefix = options.prefix || '/replication';
    if (audit) {
	app.get(options.prefix+'/hashes',function(req,res) {
	    fs.readdir(dir+'/hashes',function(err,files) {
		if (err) {
		    res.writeHead(500,"can't list hashes directory");
		} else {
		    res.writeHead(200,{'Content-Type':'application/json'});
		    res.write(JSON.stringify(files));
		}
		res.end();
	    });
	});
	app.use(options.prefix+'/hash',express.static(dir+'/hashes'));
    }
    app.get(options.prefix+'/journal',function(req,res) {
	var   live = req.param('live')==='1';
	var resume = req.param('resume');
	if (resume) {
	    // +++ format is <size-in-bytes>,<hash> +++
	    throw new Error("WriteMe");
	}
	// +++ if `live` lock journal from writing until sent +++
	// +++ better to use `util.readFileSync` to get locking for free? +++
	// +++ or use `createReadStream` on `journal` fd +++
	// +++ or take journal lines one-by-one and use `t_jrnl` to sync +++
	// +++ with streaming journal (use `byline` for enlining) +++
	var input = fs.createReadStream(dir+'/state/journal');
	var wpipe = input.pipe(res);
	if (live) {
	    // +++ append live stream to `wpipe` +++
	    throw new Error("WriteMe");
	}
    });
};

if (util.env==='test')
    exports._private = {wrap:         wrap,
			getHashStore: function() {return hash_store;},
			hash:         hash};

