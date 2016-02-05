#!/usr/bin/env node

"use strict";
/*eslint-disable no-console*/

const     argv = require('minimist')(process.argv.slice(2));
const compiler = require('./compiler.js');

compiler.debug = true;

const sourceFilename = argv._[0];

require(sourceFilename);

const stanzas = compiler.getStanzas(sourceFilename);

stanzas.forEach(function(stanza) {
    stanza.draws.forEach(function(draw) {
        delete draw.node;
    });
    console.log("%j",stanza);
});
