"use strict";

var prevalence = require("../prevalence.js");
var       temp = require('temp');
var       path = require('path');
var       util = require('../util.js');
var         fs = require('fs');
var     bl_src = "test/bl/simple.js";

temp.track();			// auto-cleanup at exit

// use this to defeat `require` cacheing
function clonefile(filename) {
    var dir = temp.mkdirSync();
    var  fn = path.join(dir,path.basename(filename));
    fs.writeFileSync(fn,fs.readFileSync(filename));
    return fn;
}

// ['fsync','fdatasync','o_sync','o_dsync','none','kludge'] is the full set of options here
['none','kludge'].forEach(function(f) {
    suite("journalise, sync style: "+f,function() {
	var prvl = prevalence()
	var  wbl;
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

suite("load/save/load 10k small JSON items",function() {
    var wbl;
    before(function() {
	var prvl = prevalence()
	var  dir = temp.mkdirSync();
	wbl = prvl.wrap(dir,clonefile(bl_src),{audit:false,sync_journal:'none'});
	wbl.init();
	wbl.open();
	for (var i=0;i<1000;i++)
	    wbl.update(['item',[[[i],{a:1,b:2,c:3,d:4,e:5}],{weeble:99}]]);
    });
    bench("load from journal",function() {
	wbl.load();
    });
    bench("save image",function() {
	wbl.save();
    });
    bench("load from image",function() {
	wbl.load();
    });
    after(function() {
	wbl.close();
    });
});
