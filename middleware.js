// Simpler way to integrate malaya into a web app.

// Attaches to an external web server, so malaya doesn't need to have
// all the web-serving logic, which was in practice tedious wrappers
// round 'express'.

// +++ REST +++

"use strict";

const       engine = require('./engine.js');
const       plugin = require('./plugin.js');
const      tracing = require('./tracing.js');

const    WebSocket = require('ws');

const objectFromEntries = kvs=>Object.assign({},...Array.from(kvs,([k,v])=>({[k]:v})));

exports.install = (server,path,source,opts)=>{
    plugin.add('middleware',class extends plugin.Plugin {
        constructor() {
            super();
            const pl = this;
            pl.ws          = null;
            pl.connections = {};
        }
        start(cb) {
            const pl = this;
            super.start(err=>{
                if (!err)
                    pl.ws = new WebSocket.Server({server,path});
                cb(err);
            });
        }
        ready() {
            const pl = this;
            pl.ws.on('connection',(client,req)=>{
                const     url = new URL(req.url,'http://example.com');
                const    port = plugin.makeTcpPortName(req.socket);
                const   query = objectFromEntries(Array.from(url.searchParams));
                const cookies = objectFromEntries((req.headers.cookie||'')
                                                  .split(';')
                                                  .map(s=>s.trim())
                                                  .map(s=>s.split('=')) );
                pl.connections[port] = client;
                client.onmessage = m=>{
                    const js = JSON.parse(m.data);
                    if (!Array.isArray(js) || js.length!==2)
                        throw new Error(`bad ws msg: ${m.data}`);
                    pl.update(js,[port]);
                };
                client.onclose = ()=>{
                    pl.update(['disconnect',{port}]);
                };
                client.onerror = err=>{
                    pl.update(['error',{port,err}]);
                };
                pl.update(['connect',{port,query,cookies}]);
            });
        }
        stop(cb) {
            const pl = this;
            pl.ws.once('close',()=>{
                pl.ws = null;
                super.stop(cb);
            });
            Object.values(pl.connections).forEach(c=>c.close());
            pl.ws.close();
        }
        out(js,name,addr) {
            const   pl = this;
            const conn = pl.connections[addr[0]];
            if (conn)
                conn.send(JSON.stringify(js));
            else
                throw new Error(`${addr[0]} is not a port of ${pl.name}`);
        }
    });
    const eng = new engine.Engine(Object.assign({
        businessLogic: source,
        ports:         {}
    },opts||{} ));
    if (opts.debug)
        tracing.trace(eng.chrjs,'index.malaya',{long:false});
    eng.start();
    eng.become('master');
    server.on('close',()=>{
        eng.stopPrevalence(false,err=>{
            if (err)
                throw err;
            eng.become('idle');
        });
    });
    return eng;
};
