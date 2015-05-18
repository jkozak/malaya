#!/usr/bin/env node

"use strict";
/*eslint-disable no-process-exit*/

var     argv = require('minimist')(process.argv.slice(2));
var   SockJS = require('node-sockjs-client');
var readline = require('readline');
var     path = require('path');

var     util = require('./util.js');
var     lock = require('./lock.js');

exports.repl = function(url) {
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
};

exports.nonInteractive = function(url) {
    var sock = new SockJS(url);

    sock.onmessage = function(e) {
        process.stdout.write(e.data);
    };
};

exports.findURL = function(p) {
    p = p || 'data';
    var data = lock.lockDataSync(path.join(process.cwd(),'.prevalence','lock'));
    if (data===null)
        return null;
    else
        return util.format("http://localhost:%d/%s",data.ports.http,p);
};

if (require.main===module) {
    var url1;
    if (argv._.length!==1) {
        url1 = exports.findURL();
        // connection URL you want is probably `http://localhost:3000/data`
    } else
        url1 = argv._[0];
    if (url1)
        exports.repl(url1);
    else 
        console.log("connection URL you want is something like `http://localhost:3000/data`");
}
