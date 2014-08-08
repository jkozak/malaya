"use strict";

var     argv = require('minimist')(process.argv.slice(2));
var     util = require('./util.js');
var   SockJS = require('node-sockjs-client');
var readline = require('readline');

if (argv._.length!=1) {
    util.error("wrong number of args");
    process.exit(100);
}

var sock = new SockJS(argv._[0]);

var write = function(js) {
    sock.send(JSON.stringify(js));
}

sock.onmessage = function(e) {
    var js = JSON.parse(e.data);
    util.error("received: "+JSON.stringify(js));
};

sock.onopen = function() {
    write(['I_AM','jk','']);
}

var rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout
});

rl.question("> ",function(answer) {
    // +++
});
