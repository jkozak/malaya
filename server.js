#!/usr/bin/env node

"use strict";

var argv = require('minimist')(process.argv.slice(2));

var  WS_PORT = 3000;

var malaya = require('./malaya.js').createServer({
    prevalenceDir: argv.d || '.prevalence',
    webDir:        'www',
    port:          argv.p ? parseInt(argv.p) : WS_PORT,
    audit:         true,
    logging:       true,
    init:          argv.init,
    businessLogic: argv.bl
});

malaya.run();
