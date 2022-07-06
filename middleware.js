// Simpler way to integrate malaya into a web app.

// Attaches to an external web server, so malaya doesn't need to have
// all the web-serving logic, which was in practice tedious wrappers
// round 'express'.

// +++ REST +++
//     encode request id in src
//     src is: ['middleware','REST',<id>]
//     e.g. ['GET',{url,...},['middleware','REST',17]]

// +++ WS +++
// +++ auth: initial handshake on GET before UPGRADE +++
//     don't open WS until known secure

"use strict";

const       engine = require('./engine.js');
const       plugin = require('./plugin.js');
const      tracing = require('./tracing.js');

const    WebSocket = require('ws');

const objectFromEntries = kvs=>Object.assign({},...Array.from(kvs,([k,v])=>({[k]:v})));

// +++ verifyClient see https://github.com/websockets/ws/issues/377#issuecomment-462152231 +++
//                   (don't use the verifyClient parameter)

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
                if (port) {
                    pl.connections[port] = client;
                    client.onmessage = m=>{
                        const js = JSON.parse(m.data);
                        if (!Array.isArray(js) || js.length!==2)
                            throw new Error(`bad ws msg: ${m.data}`);
                        pl.update(js,[port]);
                    };
                    client.onclose = ev=>{
                        pl.update(['disconnect',{port,code:ev.code,reason:ev.reason}]);
                        delete pl.connections[port];
                        client.emit('_malaya_close');
                    };
                    client.onerror = err=>{
                        pl.update(['error',{port,err}]);
                    };
                    pl.update(['connect',{port,query,cookies}]);
                } else {
                    client.close(); // is this right?
                }
            });
        }
        stop(cb) {
            const pl = this;
            if (pl.ws) {
                pl.ws.once('close',()=>{
                    pl.ws = null;
                    if (Object.keys(pl.connections).length===0)
                        super.stop(cb);
                    else
                        Object.keys(pl.connections).forEach(k=>{
                            pl.connections[k].once('_malaya_close',()=>{
                                if (Object.keys(pl.connections).length===0)
                                    super.stop(cb);
                            });
                        });
                });
                Object.values(pl.connections).forEach(c=>c.close());
                pl.ws.close();
            }
        }
        out(js,name,addr) {
            const   pl = this;
            if (addr.length===0) { // talking to middleware, not its port
                switch (js[0]) {
                case 'disconnect': {
                    const conn = pl.connections[js[1].port];
                    if (!conn)
                        console.log(`middleware disconnect: port ${js[1].port} not known`);
                    else
                        conn.close(js[1].code,js[1].reason);
                    break;
                }
                default:
                    console.log(`unknown instruction to middleware: ${js[0]}`);
                }
            } else {
                const conn = pl.connections[addr[0]];
                if (conn)
                    conn.send(JSON.stringify(js));
                else
                    console.log(`${addr[0]} is not a port of ${pl.name}`);
            }
        }
    });
    let     traceOff = null;
    const traceChrjs = ()=>{
        traceOff = tracing.trace(eng.chrjs,eng.chrjs.source,Object.assign(
            {},
            {long:false},
            opts.tracing||{} ))
    };
    const installSignalHandlers = function() {
        /* eslint no-process-exit:0 */
        process.on('SIGHUP',function() {
            if (eng && eng.mode==='master') {
                eng.stopPrevalence(false,function(err) {
                    eng.startPrevalence();
                });
            }
        });
        process.on('SIGUSR1',function() {
            if (eng) {
                if (traceOff) {
                    traceOff();
                    traceOff = null;
                    process.stderr.write(`=== tracing off ===\n`);
                }
                else {
                    try {
                        // +++ this may be wrong for revisit +++
                        traceChrjs();
                        process.stderr.write(`=== tracing on ===\n`);
                    } catch (e) {
                        process.stderr.write(`!!! can't start trace: ${e}\n`);
                    }
                }
            }
        });
    };
    const eng = new engine.Engine(Object.assign({
        debug:           opts.debug||opts.trace,
        businessLogic:   source,
        ports:           {},
        httpIsLocal:     true,
        privateTestUrls: opts.debug,
    },opts||{} ));
    eng._bindGlobals();
    if (opts.debug && opts.trace)
        traceChrjs();
    if (opts.ports && Object.keys(opts.ports).length>0) {
        const  path = require('path');
        const    fs = require('fs');
        const ports = {};
        eng.on('listen',function(protocol,port) {
            console.log("debug %s listening on *:%s",protocol,port);
            ports[protocol] = port;
            if (Object.keys(ports).length===Object.keys(eng.options.ports).length)
                fs.writeFileSync(path.join(eng.prevalenceDir,'ports'),JSON.stringify(ports));
        });
        process.on('exit',()=>{
            try {
                fs.unlinkSync(path.join(eng.prevalenceDir,'ports'));
            } catch (e) {
                // ignore
            }
        });
    }
    eng.start();
    if (opts.signalHandlers || opts.debug)
        installSignalHandlers();
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
