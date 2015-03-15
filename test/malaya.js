var malaya = require("../malaya.js");

var      _ = require('underscore');
var assert = require('assert');
var   temp = require('temp');
var   path = require('path');
var     fs = require('fs');

temp.track();			// auto-cleanup at exit

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
	if (e.code==='ENOENT')	// OK on windows?
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
