"use strict";

var   prvl = require("../prevalence.js");
var   temp = require('temp');
var   path = require('path');
var     fs = require('fs');
var bl_src = "test/bl/simple.js";

temp.track();			// auto-cleanup at exit

// use this to defeat `require` cacheing
function clonefile(filename) {
    var dir = temp.mkdirSync();
    var  fn = path.join(dir,path.basename(filename));
    fs.writeFileSync(fn,fs.readFileSync(filename));
    return fn;
}

suite("journalise",function() {
    set('iterations',10);	// too slow!
    [0,10,20].forEach(function(n) {
	['none','fsync','o_sync'].forEach(function(f) {
	    bench(n+" trivial transactions "+f,function() {
		var dir = temp.mkdirSync();
		var wbl = prvl.wrap(dir,clonefile(bl_src),{audit:true,sync_journal:f});
		wbl.init();
		wbl.open();
		for (var i=0;i<n;i++) 
		    wbl.update('tick');
		wbl.close();
	    });
	});
    });
});
