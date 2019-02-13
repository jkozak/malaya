"use strict";

const    plugin = require('../plugin.js');

const WebSocket = require('ws');

function makeHttpPortName(req) {
    const s = req.socket;
    let   a = s.remoteAddress;
    if (a.startsWith('::ffff:'))
        a = a.slice(7);
    return `${a}:${s.remotePort}${req.url}`;
}

exports.ws = plugin.add('ws',class extends plugin.Plugin {
    constructor({server,port}) {
        super();
        if ((server && port) || !(server || port))
            throw new Error("plugin ws: specify one of 'server' or 'port'");
        const pl = this;
        pl.port0       = port;
        pl.port        = null;
        pl.server      = server && pl.depends(server); // the http(s?) server plugin
        pl.wss         = null;
        pl.connections = {};
    }
    start(cb) {
        const pl = this;
        if (pl.server)
            pl.wss = new WebSocket.Server({server:pl.server.server});
        else if (pl.port0) {
            pl.wss  = new WebSocket.Server({port:pl.port0});
            pl.port = pl.wss.address.port;
        } else
            throw new Error('SNO');
        pl.wss.on('connection',(ws,req)=>{
            const portName = makeHttpPortName(req,req.url);
            pl.update(['connect',{request:{url:req.url},port:portName}]);
            pl.connections[portName] = ws;
            ws.on('message',msg=>{
                pl.update(JSON.parse(msg),[portName]);
            });
            ws.once('close',ws=>{
                pl.update(['disconnect',{port:portName}]);
                delete pl.connections[portName];
            });
        });
        pl.wss.once('listening',()=>{
            super.start(cb);
        });
    }
    stop(cb) {
        const pl = this;
        pl.wss.once('close',ws=>{
            super.stop(cb);
        });
        Object.values(pl.connections).forEach(ws=>ws.close());
        pl.wss.close(cb);
        pl.wss  = null;
        pl.port = null;
    }
    out(js,name,addr) {
        const pl = this;
        pl.connections[addr].send(js);
    }
});
