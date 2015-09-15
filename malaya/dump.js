#!/usr/bin/env node

"use strict";
/*eslint-disable no-console*/

var     argv = require('minimist')(process.argv.slice(2));
var compiler = require('./compiler.js');

compiler.debug = true;

var sourceFilename = argv._[0];

require(sourceFilename);

var stanzas = compiler.getStanzas(sourceFilename);

stanzas.forEach(function(stanza) {
    stanza.draws.forEach(function(draw) {
        delete draw.node;
    });
    console.log("%j",stanza);
});
