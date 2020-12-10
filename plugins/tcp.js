"use strict";

const  plugin = require('../plugin.js');
const whiskey = require('../whiskey.js');

const     net = require('net');

plugin.add('tcp',class extends plugin.Plugin {
    constructor({port=0,Reader=whiskey.JSONParseStream,Writer=whiskey.StringifyJSONStream}) {
        super();
        const pl = this;
        pl.port0       = port;    // IP port requested
        pl.server      = null;
        pl.Reader      = Reader;
        pl.Writer      = Writer;
        pl.port        = null;    // IP port allocated
        pl.connections = {};
    }
    start(cb) {
        const pl = this;
        pl.server = net.createServer({});
        pl.server.listen(pl.portReq,()=>{
            pl.port = pl.server.address().port;
            super.start(cb);
        });
    }
    ready() {
        const pl = this;
        pl.using('port',pl.port);
        pl.server.on('error',err=>{
            pl.update(['error',{err}]);
        });
        pl.server.on('connection',socket=>{
            const portName = plugin.makeTcpPortName(socket);
            const       rs = plugin.instantiateReadStream(pl.Reader);
            const       ws = plugin.instantiateWriteStream(pl.Writer);
            socket.pipe(rs);
            ws.pipe(socket);
            rs.on('data',js=>{
                if (!Array.isArray(js) || js.length!==2 || typeof js[0]!=='string' || typeof js[1]!=='object') {
                    console.log("dud input: %j",js);
                } else {
                    pl.update(js,[portName]);
                }
            });
            pl.update(['connect',{port:portName}]);
            pl.connections[portName] = {socket,rs,ws};
            socket.on('close',err=>{
                // +++ destroy reader and writer +++
                delete pl.connections[portName];
                pl.update(['disconnect',{port:portName}],[portName]);
            });
            pl.update(['connect',{port:portName}]);
        });
    }
    stop(cb) {
        const pl = this;
        pl.server.once('close',()=>{
            pl.server = null;
            pl.port   = null;
            super.stop(cb);
        });
        Object.values(pl.connections).forEach(c=>c.socket.destroy());
        pl.server.close();
    }
    out(js,name,addr) {
        const pl = this;
        pl.connections[addr[0]].ws.write(js);
    }
});
