"use strict";

/* eslint-disable */  // this is a stub

// provides access to the Malaya hash-store

const  plugin = require('../plugin.js');

const  crypto = require('crypto');

plugin.add('random',class extends plugin.Plugin {
    out([op,js]) {
        const pl = this;
        switch (op) {
        case  'UInt8':
        case 'UInt16':
        case 'UInt32':
        case   'Int8':
        case  'Int16':
        case  'Int32':
        case 'String':
            throw new Error('NYI');
        default:
            throw new Error("bad op: %j",op);
        }
    }
});
