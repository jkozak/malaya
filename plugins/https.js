"use strict";

const  plugin = require('../plugin.js');
const    http = require('./http.js');

//const   https = require('https');

exports.https = plugin.add('https',class extends http.http {
    constructor({port=3443,ws=null}) {
        super();
        const pl = this;
        pl.port0  = port;
        throw new Error("NYI");
    }
});
