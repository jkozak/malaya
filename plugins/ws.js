"use strict";

const      util = require('../util.js');
const    plugin = require('../plugin.js');

const WebSocket = require('ws');

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
        pl.wss.on('connection',(ws,request)=>{
            const portName = util.makeHttpPortName(request);
            pl.update(['connect',{request,port:portName}]);
            pl.connections[portName] = ws;
            ws.on('message',msg=>{
                // +++ JSONify, send to malaya +++
            });
            pl.wss.once('close',ws=>{
                pl.update(['disconnect',{port:portName}]);
                delete pl.connections[portName];
            });
        });
        pl.wss.listening(()=>cb());
    }
    stop(cb) {
        const pl = this;
        pl.wss.once('close',ws=>{
            cb();
        });
        Object.values(pl.connections).forEach(ws=>ws.close());
        pl.wss.close(cb);
        pl.wss = null;
    }
    out(js,name,addr) {
        // +++ send data to socket +++
    }
});
