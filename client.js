#!/usr/bin/env node

"use strict";
/*eslint-disable no-process-exit*/

var     argv = require('minimist')(process.argv.slice(2));
var   SockJS = require('node-sockjs-client');
var readline = require('readline');
var     path = require('path');

var     util = require('./util.js');
var     lock = require('./lock.js');

var      url;

if (argv._.length!==1) {
    var data = lock.lockDataSync(path.join(process.cwd(),'.prevalence','lock'));
    if (data===null) {
        util.error("can't find server and none specified");
        process.exit(100);
    } else
        url = util.format("http://localhost:%d/data",data.ports.http);
    // connection URL you want is probably `http://localhost:3000/data`
} else
    url = argv._[0];

var sock = new SockJS(url);

var write = function(js) {
    sock.send(JSON.stringify(js)+'\n');
};

var messages = [];

var rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout
});

function repl() {
    rl.question("> ",function(answer) {
        if (answer)
            try {
                /* eslint no-eval:0 */
                var js = eval(answer); // !!! nicer to use than JSON.parse, but dodgy !!!
                if (js)
                    write(js);
            } catch (e) {
                console.log("!!! %j >> %s",answer,e.message);
            }
        var msgs = messages;
        messages = [];
        msgs.forEach(function(msg) {
            process.stdout.write(util.format("< %j\n",JSON.parse(msg)));
        });
        setImmediate(repl);
    });
}

sock.onmessage = function(e) {
    messages.push(e.data);
};

sock.onopen = function() {
    repl();
};

