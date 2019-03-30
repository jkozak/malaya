#!/usr/bin/env node

"use strict";
/*eslint-disable no-process-exit*/

const       fs = require('fs');
const       ws = require('ws');
const     argv = require('minimist')(process.argv.slice(2));
const readline = require('readline');
const     path = require('path');

const     util = require('./util.js');

exports.repl = function(url) {
    const sock = new ws(url);

    const write = function(js) {
        sock.send(JSON.stringify(js)+'\n');
    };

    let messages = [];

    const rl = readline.createInterface({
        input:  process.stdin,
        output: process.stdout
    });

    console.log("*** repl: %j",url)


    function repl() {
        rl.question("> ",function(answer) {
            if (answer)
                try {
                    /* eslint no-eval:0 security/detect-eval-with-expression:0 */
                    const js = eval(answer); // !!! nicer to use than JSON.parse, but dodgy !!!
                    if (js)
                        write(js);
                } catch (e) {
                    console.log("! %s",answer,e.message);
                }
            const msgs = messages;
            messages = [];
            msgs.forEach(function(msg) {
                process.stdout.write(util.format(" < %j\n",JSON.parse(msg)));
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
    sock.onerror = function() {
        sock.close();
    };
    sock.onclose = function() {
        rl.close();
    };
};

exports.nonInteractive = function(url) {
    const sock = new ws(url);

    sock.onmessage = function(e) {
        process.stdout.write(e.data);
    };
};

exports.findURL = function(p) {
    p = p || 'data';
    const ports = JSON.parse(fs.readFileSync(path.join(process.cwd(),'.prevalence','ports'),'utf8'));
    if (ports===null)
        return null;
    else if (typeof ports.http==='number')
        return util.format("ws://localhost:%d/%s",ports.http,p);
    else if (typeof ports.http==='string')
        return util.format("ws+unix://%s:/%s",path.resolve(ports.http),p);
    else
        throw new Error(`unknown http port spec: ${JSON.stringify(ports.http)}`);
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
