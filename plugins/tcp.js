"use strict";

const plugin = require('./plugin.js');

//const    net = require('net');

plugin.add('tcp',class extends plugin.Plugin {
    constructor({port=0,raw=false,delimiter='\n'}) {
        super();
        const pl = this;
        pl.portReq   = port;
        pl.port      = null;    // not listening yet
        pl.raw       = raw;
        pl.delimiter = delimiter;
    }
    start(opts,cb) {
        super.start(opts);
        //const pl = this;

    }
});
