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

var dir     = null;
var journal = null;		// file descriptor
var date    = null;		// effective Date object
var t       = null;		// consistent timey thing

var audit      = false;
var hash_store;
var bl_files;

// object stashing format:
//  JSON with extra encoding:
//     string "abc" is encoded as ":abc"
//     date   DDD   is encoded as "date:"+DDD
//     ...
function serialise(v) {
    return JSON.stringify(v,function(k,v) {
	if (v instanceof Date)
	    return "date:"+v;
	else if (typeof v==="string")
	    return ":"+v;
	else
	    return v;
    });
}
function deserialise(s) {
    return JSON.parse(s,function(k,v) {
	if (typeof v!=="string")
	    return v;
	else if (v.charAt(0)==':')
	    return v.substring(1);
	else if (v.startsWith("date:"))
	    return new Date(v.substring(5)); // "date:".length===5
	else
	    return v;
    });
}

function readFileLinesSync(path,fn) {
    var fd         = fs.openSync(path,"r");
    var bufferSize = 1024;
    var buffer     = new Buffer(bufferSize);
    var leftOver   = '';
    var read,line,idxStart,idx;
    while ((read=fs.readSync(fd,buffer,0,bufferSize,null))!==0) {
	leftOver += buffer.toString('utf8',0,read);
	idxStart  = 0
	while ((idx=leftOver.indexOf("\n",idxStart))!==-1) {
	    line = leftOver.substring(idxStart,idx);
	    fn(line);
	    idxStart = idx+1;
	}
	leftOver = leftOver.substring(idxStart);
    }
    fs.closeSync(fd);
}

function init(dirname,options) {
    // prepare a directory to be a store
    fs.mkdirSync(dirname+"/state");
    fs.writeFileSync( dirname+"/state/world",serialise(0)+"\n");
    fs.appendFileSync(dirname+"/state/world",serialise(null)+"\n");
    fs.appendFileSync(dirname+"/state/world",serialise([])+"\n");
    fs.writeFileSync( dirname+"/state/journal",serialise(journal_entry('init',options))+"\n");
    dir = null;
    t   = 0;
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
    journal = fs.openSync(dirname+"/state/journal","a");
    dir     = dirname;
    date    = null;
};

function close(dirname) {
    // close a store (quickly)
    if (journal)
	fs.closeSync(journal);
    journal = null;
    dir     = null;
    date    = null;
    t       = null;
};

function journal_entry(type,datum) {
    date = new Date();
    return [date,type,datum];
}

function journalise(type,datum) {
    // write a journal entry
    if (journal===null)
	throw new Error("journal is closed");
    date = new Date();
    var s = serialise(journal_entry(type,datum));
    fs.writeSync(journal,s,   s.length,null);
    fs.writeSync(journal,'\n',1,       null);
    fs.fsyncSync(journal);
    t++;
};

exports.time = function() {
    // get timer tick
    if (t===null)
	throw new Error("t unset");
    return t;
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
    var dir_cur = dir+"/state"
    var dir_new = dir+"/state-NEW";
    var dir_old = dir+"/state-OLD";
    var syshash = null;
    fs.closeSync(journal);
    journal = null;
    if (audit) 
	syshash = hash_store.putFileSync(dir_cur+"/journal");
    rm_rf.sync(dir_new);
    fs.mkdirSync(dir_new);
    fs.writeFileSync( dir_new+"/world",serialise(t));    // tick
    fs.appendFileSync(dir_new+"/world","\n");
    fs.appendFileSync(dir_new+"/world",serialise(syshash));
    fs.appendFileSync(dir_new+"/world","\n");
    fs.appendFileSync(dir_new+"/world",serialise(root)); // root
    fs.appendFileSync(dir_new+"/world","\n");
    fs.writeFileSync( dir_new+"/journal",serialise(journal_entry('previous',syshash)));
    fs.appendFileSync(dir_new+"/journal","\n");
    rm_rf.sync(dir_old);
    fs.renameSync(dir_cur,dir_old);
    fs.renameSync(dir_new,dir_cur);
    journal = fs.openSync(dir_cur+"/journal","a");
    date    = null;
};

function load(fn_root,fn_datum) {
    var world_file   = dir+"/state/world";
    var journal_file = dir+"/state/journal";
    var lineno       = 1;
    // load a store
    if (dir===null)
	throw new Error("must be open to load");
    readFileLinesSync(world_file,function(line) {
	switch (lineno++) {
	case 1:
	    t = deserialise(line);
	    return true;
	case 2:
	    // human use only
	    return true;
	case 3:
	    fn_root(deserialise(line));
	    return false;
	}
    });
    // +++ handle case where journal file not found +++
    readFileLinesSync(journal_file,function(line) {
	var di = deserialise(line);
	date = di[0];
	if (di[1]=='update')
	    fn_datum(di[2]);
	date = null;
	return true;
    });
};

function wrap(dir,bl,options) {
    return {
	init:function() {
	    init(dir,options);
	    bl.init();
	},
	open:function() {
	    open(dir);
	    if (audit) {
		journalise('logic',bl_files);
	    }
	},
	save:function() {
	    save(bl.get_root());
	},
	close:function() {
	    close();
	},
	load:function() {
	    load(bl.set_root,bl.update);
	},
	query:function(q) {
	    return bl.query(q);
	},
	update:function(u) {
	    journalise('update',u);
	    return bl.update(u);
	}
    };
};

exports.wrap = function(dir,bl,options) {
    var loading_bl = true;
    if (options==undefined)
	options = {audit:true};	        // default options
    audit = options.audit;
    if (audit) {
	bl_files   = {};
	hash_store = hash.make_store(dir+'/hashes');
	for (var k in require.extensions) {
	    require.extensions[k] = (function(ext) {
		return function(module,filename) {
		    if (loading_bl) {
			bl_files[filename] = hash_store.putFileSync(filename);
			return ext(module,filename);
		    }
		    else {
			return ext(module,filename);
		    }
		} })(require.extensions[k]);
	}
    }
    if (typeof(bl)==='string') {
	bl = require(bl);	        // bl is a filename
    } else if (bl===undefined) {
	bl = require('./bl.js');	// default to a toy version
    } else {				// prebuilt business logic object
	if (audit)
	    throw new Error("auditing required and source code not found");
    }
    loading_bl = false;
    return wrap(dir,bl,options);
};

if (process.env.NODE_ENV==='test')
    exports._private = {wrap: wrap};

