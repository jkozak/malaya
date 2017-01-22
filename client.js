#!/usr/bin/env node

"use strict";
/*eslint-disable no-process-exit*/

const     argv = require('minimist')(process.argv.slice(2));
const   SockJS = require('node-sockjs-client');
const readline = require('readline');
const     path = require('path');

const     util = require('./util.js');
const     lock = require('./lock.js');

exports.repl = function(url) {
    const sock = new SockJS(url);

    const write = function(js) {
        sock.send(JSON.stringify(js)+'\n');
    };

    let messages = [];

    const rl = readline.createInterface({
        input:  process.stdin,
        output: process.stdout
    });

    function repl() {
        rl.question("> ",function(answer) {
            if (answer)
                try {
                    /* eslint no-eval:0 */
                    const js = eval(answer); // !!! nicer to use than JSON.parse, but dodgy !!!
                    if (js)
                        write(js);
                } catch (e) {
                    console.log("! %s",answer,e.message);
                }
            const msgs = messages;
            messages = [];
            msgs.forEach(function(msg) {
                process.stdout.write(util.format("< %j\n",JSON.parse(msg)));
            });
            setImmediate(repl);
        });
    }

    rl.on('SIGINT',function() {
        process.stdout.write(" interrupt\n");
        rl.close();
    });
    rl.on('SIGCONT', function() {
        rl.prompt();
    });
    rl.on('close',function() {
        sock.close();
    });

    sock.onmessage = function(e) {
        messages.push(e.data);
    };

    sock.onopen = function() {
        repl();
    };
    sock.onerror = function(err) {
        console.log("websocket failed: %j",err);
        sock.close();
    };
    sock.onclose = function() {
        rl.close();
    };
};

exports.nonInteractive = function(url) {
    const sock = new SockJS(url);

    sock.onmessage = function(e) {
        process.stdout.write(e.data);
    };
};

exports.findURL = function(p) {
    p = p || 'data';
    const data = lock.lockDataSync(path.join(process.cwd(),'.prevalence','lock'));
    if (data===null)
        return null;
    else
        return util.format("http://localhost:%d/%s",data.ports.http,p);
};

if (require.main===module) {
    let url1;
    if (argv._.length!==1) {
        url1 = exports.findURL();
    } else
        url1 = argv._[0];
    if (url1)
        exports.repl(url1);
    else
        console.log("connection URL you want is something like `http://localhost:3000/data`");
}
