"use strict";

const  plugin = require('../plugin.js');
const whiskey = require('../whiskey.js');

const     net = require('net');

plugin.add('tcp',class extends plugin.Plugin {
    constructor({port=0,Reader=whiskey.JSONParseStream,Writer=whiskey.StringifyJSONStream}) {
        super();
        const pl = this;
        pl.portReq     = port;    // IP port
        pl.server      = null;
        pl.Reader      = Reader;
        pl.Writer      = Writer;
        pl.connections = {};
    }
    start(cb) {
        const pl = this;
        pl.server = net.createServer({});
        pl.server.on('error',err=>{
            pl.update(['error',{err},{port:'tcp'}]);
        });
        pl.server.on('connection',socket=>{
            const address = socket.address();
            const    port = `tcp://${address.address}:${address.port}/`;
            const      rs = new pl.Reader();
            const      ws = new pl.Writer();
            socket.pipe(rs);
            ws.pipe(socket);
            rs.on('data',js=>{
                if (!Array.isArray(js) || js.length!==2 || typeof js[0]!=='string' || typeof js[1]!=='object') {
                    console.log("dud input: %j",js);
                } else {
                    js.push({port});
                    pl.update(js);
                }
            });
            pl.update(['connect',{port:pl.port},{port:'tcp'}]);
            pl.connections[port] = {socket,rs,ws};
            socket.on('close',err=>{
                // +++ destroy reader and writer +++
                delete pl.connections[address];
                pl.update(['disconnect',{port},{port:'tcp'}]);
            });
            pl.update(['connect',{port},{port:'tcp'}]);
        });
        pl.server.listen(pl.portReq,()=>{
            super.start(cb);
        });
    }
    stop(cb) {
        const pl = this;
        pl.server.once('close',()=>{
            pl.server = null;
            super.stop(cb);
        });
        Object.values(pl.connections).forEach(c=>c.socket.destroy());
        pl.server.close();
    }
    out(js,addr) {
        const pl = this;
        pl.connections.ws.write(js);
    }
});
