"use strict";

const  plugin = require('../plugin.js');

const    http = require('http');

exports.http = plugin.add('http',class extends plugin.Plugin {
    constructor({port=3000}) {
        super();
        const pl = this;
        pl.port0  = port;
        pl.port   = null;
        pl.index  = 0;
        pl.reqs   = {};
        pl.server = null;
    }
    start(cb) {
        const pl = this;
        pl.server = http.createServer((request,response)=>{
            pl.reqs[++pl.index] = [request,response];
            pl.update(['request',{id:pl.index,request}]);
        });
        cb();
    }
    stop(cb) {
        const pl = this;
        pl.server.close(cb);
        // +++ close connections +++
        pl.server = null;
    }
    out([op,args],name,addr) {
        const pl = this;
        switch (op) {
        case 'response': {
            const res = pl.reqs[args.id][1];
            delete pl.reqs[args.id];
            res.status(args.status); // ??? is this right? ???
            break;
        }
        default:
            throw new Error(`unknown ${name} out: ${op}`);
        }
    }
});
