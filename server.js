#!/usr/bin/env node

"use strict";

var argv = require('minimist')(process.argv.slice(2));
var util = require('./util.js');

var server = require('./malaya.js').createServer({
    prevalenceDir: argv.d || '.prevalence',
    webDir:        'www',
    fe3Port:       5110,
    port:          argv.p ? parseInt(argv.p) : 3000,
    audit:         true,
    logging:       true,
    init:          argv.init,
    businessLogic: argv.bl
});

server.on('loaded',function(hash) {
    util.debug("opening hash is: %s",hash);
});
server.on('closed',function(hash) {
    util.debug("closing hash is: %s",hash);
});
server.on('makeConnection',function(mc) {
    util.debug("hello, %j",mc);
});
server.on('loseConnection',function(mc) {
    util.debug("farewell, %j",mc);
});

server.run();



