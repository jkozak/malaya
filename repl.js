#!/usr/bin/env node

"use strict";

var  repl = require('repl');
var  argv = require('minimist')(process.argv.slice(2));
var  util = require('./util.js');
var chrjs = require('./chrjs.js');

if (argv._.length==1) {
    var store = require(argv._[0]);
    var     n = 0;
    var options = {
	prompt: "[]> ",
	eval:   function(cmd,context,filename,callback) {
	    console.log(util.format("?? %j",cmd));
	    callback(null,undefined);
	},
	terminal: false,
	ignoreUndefined:true
    };
    var repl1 = repl.start(options);
}
