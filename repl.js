#!/usr/bin/env node

"use strict";

const  repl = require('repl');
const  argv = require('minimist')(process.argv.slice(2));
const  util = require('./util.js');
//const chrjs = require('./chrjs.js');

if (argv._.length===1) {
    const options = {
        prompt: "[]> ",
        eval:   function(cmd,context,filename,callback) {
            console.log(util.format("?? %j",cmd));
            callback(null,undefined);
        },
        terminal: false,
        ignoreUndefined:true
    };
    repl.start(options);
}
