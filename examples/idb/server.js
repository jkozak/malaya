#!/usr/bin/env node

"use strict";

var   argv = require('minimist')(process.argv.slice(2));
var   util = require('../../util.js');

var FE3_PORT = 5110;
var  WS_PORT = 3000;

var malaya = require('../../malaya.js').createServer({
    prevalenceDir: argv.d || '.prevalence',
    webDir:        'www',
    port:          argv.p ? parseInt(argv.p) : WS_PORT,
    audit:         true,
    logging:       true,
    init:          argv.init,
    businessLogic: argv.bl
});

var fe3 = require('./fe3.js').createServer({malaya:malaya});
fe3.on('connect',function(mc) {
    malaya.addConnection(mc);
});
fe3.on('listening',function() {
    util.debug('fe3  listening on *:%s',FE3_PORT);
});

malaya.on('loaded',function(hash) {
    util.debug("opening hash is: %s",hash);
});
malaya.on('closed',function(hash) {
    util.debug("closing hash is: %s",hash);
});
malaya.on('makeConnection',function(mc) {
    util.debug("hello, %j",mc);
});
malaya.on('loseConnection',function(mc) {
    util.debug("farewell, %j",mc);
});
malaya.on('closed',function() {
    fe3.close();
    fe3 = null;
});

malaya.run(function() {
    fe3.listen(FE3_PORT);
});



