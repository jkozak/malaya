#!/usr/bin/env node

"use strict";
/*eslint-disable no-process-exit*/

const     argv = require('minimist')(process.argv.slice(2));
const   SockJS = require('ws');
const readline = require('readline');
const     path = require('path');
const       fs = require('fs');
const      URL = require('url').URL;

const     util = require('./util.js');
const     lock = require('./lock.js');

// Helper function to create a WebSocket connection with redirect handling
const createConnection = function(url,options,onOpen,onMessage,onError,onClose) {
    options = options || {};
    const cookies = options.cookies || [];
    const maxRedirects = options.maxRedirects !== undefined ? options.maxRedirects : 10;
    let redirectCount = 0;

    const attemptConnection = function(currentUrl) {
        const wsOptions = {};
        if (cookies.length>0) {
            wsOptions.headers = {
                'Cookie': cookies.map(c=>`${encodeURIComponent(c[0])}=${encodeURIComponent(c[1])}`).join('; ')
            };
        }
        wsOptions.rejectUnauthorized = !options.noCheckCert;

        const sock = new SockJS(currentUrl,wsOptions);
        let handledResponse = false;

        sock.on('unexpected-response',function(req,res) {
            handledResponse = true;
            const statusCode = res.statusCode;

            if (statusCode >= 300 && statusCode < 400) {
                const location = res.headers.location;
                if (!location) {
                    if (onError) onError(new Error(`Redirect response ${statusCode} without Location header`));
                    return;
                }

                redirectCount++;
                if (redirectCount > maxRedirects) {
                    if (onError) onError(new Error(`Too many redirects (max: ${maxRedirects})`));
                    return;
                }

                // Resolve the redirect URL (may be relative)
                const redirectUrl = new URL(location,currentUrl).href;
                console.log(`Following redirect ${redirectCount}/${maxRedirects}: ${redirectUrl}`);

                sock.terminate();
                attemptConnection(redirectUrl);
            } else {
                if (onError) onError(new Error(`Unexpected response: ${statusCode}`));
            }
        });

        if (onOpen) {
            sock.onopen = function() {
                handledResponse = true;
                onOpen(sock);
            };
        }
        if (onMessage) sock.onmessage = onMessage;
        if (onError) {
            sock.onerror = function(err) {
                if (!handledResponse) onError(err);
            };
        }
        if (onClose) sock.onclose = onClose;

        return sock;
    };

    return attemptConnection(url);
};

exports.repl = function(url,options) {
    options = options || {};
    let sock = null;
    let messages = [];

    const write = function(js) {
        if (sock) sock.send(JSON.stringify(js)+'\n');
    };

    const rl = readline.createInterface({
        input:  process.stdin,
        output: process.stdout
    });

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
        if (sock) sock.close();
    });

    sock = createConnection(
        url,
        options,
        function(connectedSock) {
            sock = connectedSock;
            repl();
        },
        function(e) {
            messages.push(e.data);
        },
        function(err) {
            console.log(`error: ${err.message}`);
            if (sock) sock.close();
        },
        function() {
            rl.close();
        }
    );
};

exports.nonInteractive = function(url,options) {
    options = options || {};
    createConnection(
        url,
        options,
        null, // onOpen
        function(e) {
            process.stdout.write(e.data);
        },
        function(err) {
            console.error(`error: ${err.message}`);
            process.exit(1);
        },
        null // onClose
    );
};

exports.findURL = function(p) {
    p = p || 'data';
    const data = lock.lockDataSync(path.join(process.cwd(),'.prevalence','lock'));
    if (data===null || !data.ports.http) {
        const ports = JSON.parse(fs.readFileSync(path.join(process.cwd(),'.prevalence','ports')));
        if (!ports.http)
            return null;
        else
            return `http://127.0.0.1:${ports.http}/${p}`;
    } else
        return util.format("http://127.0.0.1:%d/%s",data.ports.http,p);
};

if (require.main===module) {
    let url1;
    if (argv._.length!==1) {
        url1 = exports.findURL();
    } else
        url1 = argv._[0];
    if (url1)
        exports.repl(url1,{});
    else
        console.log("connection URL you want is something like `http://localhost:3000/data`");
}
