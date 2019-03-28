"use strict";

const  plugin = require('../plugin.js');

const      fs = require('fs');
const    http = require('http');
const    path = require('path');

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
        pl.server = http.createServer();
        pl.server.on('listening',()=>{
            pl.port = pl.server.address().port;
            super.start(cb);
        });
        pl.server.listen(pl.port0);
    }
    ready() {
        const pl = this;
        pl.using('port',pl.port);
        pl.server.on('request',(req,res)=>{
            pl.reqs[++pl.index] = [req,res];
            pl.update(['request',{
                id:pl.index,
                method:req.method,path:req.path,headers:req.headers,url:req.url} ]);
        });
    }
    stop(cb) {
        const pl = this;
        pl.server.close(()=>super.stop(cb));
        // +++ close connections +++
        pl.server = null;
    }
    out([op,args],name,addr) {
        const pl = this;
        switch (op) {
        case 'response': {
            const res = pl.reqs[args.id][1];
            delete pl.reqs[args.id];
            res.statusCode    = args.statusCode || 500;
            res.statusMessage = args.statusMessage;
            if (args.headers)
                Object.keys(args.headers).forEach(k=>res.setHeader(k,args.headers[k]));
            if (args.body)
                res.write(args.body);
            if (args.sendfile)
                res.write(fs.readFileSync(path.join(pl.engine.options.dir,args.sendfile),
                                          'utf8')); // !!! s/be async !!!<
            res.end();
            break;
        }
        default:
            throw new Error(`unknown ${name} out: ${op}`);
        }
    }
});
