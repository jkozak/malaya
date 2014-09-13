"use strict";

var   prvl = require("../prevalence.js");
var   temp = require('temp');
var   path = require('path');
var   util = require('../util.js');
var     fs = require('fs');
var bl_src = "test/bl/simple.js";

var consts = prvl._private.consts;

temp.track();			// auto-cleanup at exit

// use this to defeat `require` cacheing
function clonefile(filename) {
    var dir = temp.mkdirSync();
    var  fn = path.join(dir,path.basename(filename));
    fs.writeFileSync(fn,fs.readFileSync(filename));
    return fn;
}

if (false) {
    // these benchmarks are to see where the time goes in journalising
    var buf250 = "";
    for (var i=0;i<25;i++)
	buf250 += "0123456789";

    suite("bits",function() {
	var x;
	bench("new Date()",function() {
	    x = new Date();
	});

	bench("util.serialise+\\n",function() {
	    x = util.serialise(["x",new Date()])+"\n";
	});
    });

    suite("overwrite",function() {
	var fd1,fd2,fd3;
	before(function() {
	    var dir = temp.mkdirSync();
	    fd1 = fs.openSync(path.join(dir,"xxx1"),consts.O_CREAT|consts.O_WRONLY);
	    fd2 = fs.openSync(path.join(dir,"xxx2"),consts.O_CREAT|consts.O_WRONLY|consts.O_SYNC);
	    fd3 = fs.openSync(path.join(dir,"xxx3"),consts.O_CREAT|consts.O_WRONLY|consts.O_DSYNC);
	});
	bench("no sync",function() {
	    fs.writeSync(fd1,buf250,buf250.length,0);
	});
	bench("O_SYNC",function() {
	    fs.writeSync(fd2,buf250,buf250.length,0);
	});
	bench("O_DSYNC",function() {
	    fs.writeSync(fd3,buf250,buf250.length,0);
	});
	after(function() {
	    fs.closeSync(fd1);
	    fs.closeSync(fd2);
	    fs.closeSync(fd3);
	});
    });

    suite("append",function() {
	var fd1,fd2,fd3;
	before(function() {
	    var dir = temp.mkdirSync();
	    fd1 = fs.openSync(path.join(dir,"xxx1"),consts.O_APPEND|consts.O_CREAT|consts.O_WRONLY);
	    fd2 = fs.openSync(path.join(dir,"xxx2"),consts.O_APPEND|consts.O_CREAT|consts.O_WRONLY|consts.O_SYNC);
	    fd3 = fs.openSync(path.join(dir,"xxx3"),consts.O_APPEND|consts.O_CREAT|consts.O_WRONLY|consts.O_DSYNC);
	});
	bench("no sync",function() {
	    fs.writeSync(fd1,buf250,buf250.length,null);
	});
	bench("O_SYNC",function() {
	    fs.writeSync(fd2,buf250,buf250.length,null);
	});
	bench("O_DSYNC",function() {
	    fs.writeSync(fd3,buf250,buf250.length,null);
	});
	after(function() {
	    fs.closeSync(fd1);
	    fs.closeSync(fd2);
	    fs.closeSync(fd3);
	});
    });
}

// ['fsync','o_sync','o_dsync','none','kludge'] are the full set of options here
['none','kludge'].forEach(function(f) {
    suite("journalise, sync style: "+f,function() {
	var wbl;
	before(function() {
	    var dir = temp.mkdirSync();
	    wbl = prvl.wrap(dir,clonefile(bl_src),{audit:true,sync_journal:f});
	    wbl.init();
	    wbl.open();
	});
	bench("trivial update",function() {
	    wbl.update('tick');
	});
	after(function() {
	    wbl.close();
	});
    });
});
