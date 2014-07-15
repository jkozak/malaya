"use strict";

var     argv = require('minimist')(process.argv.slice(2));
var   SockJS = require('node-sockjs-client');
var readline = require('readline');

if (argv._.length!=1) {
    console.log("wrong number of args");
    process.exit(100);
}

var sock = new SockJS(argv._[0]);

function write(js) {
    sock.send(JSON.stringify(js));
}

sock.onmessage = function(e) {
    var js = JSON.parse(e.data);
    console.log("received: "+JSON.stringify(js));
};

var rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout
});

sock.onopen = function() {
    write(['I_AM','jk','']);
}

rl.question("> ",function(answer) {
    // +++
});
