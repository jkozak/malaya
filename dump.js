#!/usr/bin/env node

"use strict";

var     argv = require('minimist')(process.argv.slice(2));
var     util = require('./util.js');
var       fs = require('fs');
var        _ = require('underscore');
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

