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

var dir     = null;
var journal = null;		// file descriptor
var date    = null;		// effective Date object
var t       = null;		// consistent timey thing

// object stashing format:
//  JSON with extra encoding:
//     string "abc" is encoded as ":abc"
//     date   DDD   is encoded as "date:"+DDD
//     ...
function serialise(v) {
    return JSON.stringify(v,function(k,v) {
	if (v instanceof Date)
	    return "date:"+JSON.stringify(v);
	else if (typeof v==="string")
	    return ":"+JSON.stringify(v);
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
	else if (v.startsWith("date:")==':')
	    return new Date(v.substring(5));
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

exports.init = function(dirname) {
    // prepare a directory to be a store
    fs.mkdirSync(dirname+"/state");
    fs.writeFileSync( dirname+"/state/world",serialise(0)+"\n");
    fs.appendFileSync(dirname+"/state/world",serialise([])+"\n");
    fs.writeFileSync( dirname+"/state/journal","");
    t = 0;
};

exports.open = function(dirname) {
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

exports.close = function(dirname) {
    // close a store (quickly)
    if (journal)
	fs.closeSync(journal);
    journal = null;
    dir     = null;
    date    = null;
    t       = null;
};

exports.journalise = function(datum) {
    // write a journal entry
    if (journal===null)
	throw new Error("journal is closed");
    date = new Date();
    var s = serialise([date,datum]);
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

exports.save = function(root) {
    // close a store by writing a new image (slow)
    if (dir===null)
	throw new Error("must be open to save");
    var dir_cur = dir+"/state"
    var dir_new = dir+"/state-NEW";
    var dir_old = dir+"/state-OLD";
    fs.closeSync(journal);
    journal = null;
    rm_rf.sync(dir_new);
    fs.mkdirSync(dir_new);
    fs.writeFileSync( dir_new+"/world",serialise(t));
    fs.appendFileSync(dir_new+"/world","\n");
    fs.appendFileSync(dir_new+"/world",serialise(root));
    fs.appendFileSync(dir_new+"/world","\n");
    fs.writeFileSync( dir_new+"/journal","");
    rm_rf.sync(dir_old);
    fs.renameSync(dir_cur,dir_old);
    fs.renameSync(dir_new,dir_cur);
    journal = fs.openSync(dir_cur+"/journal","a");
    date    = null;
};

exports.load = function(fn_root,fn_datum) {
    // load a store
    if (dir===null)
	throw new Error("must be open to load");
    var lineno = 1;
    readFileLinesSync(dir+"/state/world",function(line) {
	switch (lineno++) {
	case 1:
	    t = deserialise(line);
	    return true;
	case 2:
	    fn_root(deserialise(line));
	    return false;
	}
    });
    readFileLinesSync(dir+"/state/journal",function(line) {
	var di = deserialise(line);
	date = di[0];
	fn_datum(di[1]);
	date = null;
	return true;
    });
}
