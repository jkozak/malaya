"use strict";

// for use in test scripts

const util = require('./util.js');

if (util.env==='test')  {
    const WebSocket = require('ws');
    const   whiskey = require("./whiskey.js");
    const    byline = require('byline');
    const    VError = require('verror');
    const    engine = require('./engine.js');
    const    Engine = engine.Engine;
    const    assert = require("assert");
    const    events = require("events");
    const    stream = require("stream");
    const     jsdom = require('jsdom');
    const      http = require('http');
    const      path = require('path');
    const      temp = require('temp').track();
    const        fs = require('fs');
    const        cp = require('child_process');
    let          id = 0;

    const runInEngine = exports.runInEngine = function(source,opts) {
        if ((typeof opts)==='function')
            opts = {main:opts};
        else
            opts = opts || {};
        const dir = opts.dir || temp.mkdirSync();
        const eng = new Engine({dir:dir,businessLogic:source});
        eng.__id = id++;
        if (opts.bind)
            eng._bindGlobals();
        if (opts.init!==false)
            eng.init();
        eng.start();
        if (opts.init)
            opts.init(eng);
        eng.startPrevalence(function(e) {
            assert(!e);
            if (opts.main)
                opts.main(eng);
        });
    };
    exports.runInCountEngine = function(opts) {runInEngine(path.join(__dirname,'test/bl/count.chrjs'),opts);};

    exports.createIO = function(type) { // make a "terminal" which can be connected to an Engine
        const ee = new events.EventEmitter();
        const io = {
            i:     new stream.PassThrough({objectMode:true}),
            o:     new stream.PassThrough({objectMode:true}),
            type:  type || 'data',
            rcved: [],
            on:    function(w,h){return ee.on(w,h);}
        };
        io.o.on('data',function(js) {
            io.rcved.push(js);
            ee.emit("rcved");
        });
        return io;
    };

    exports.makeTimestamp = function() {
        let i = 1;
        return function() {
            return i++;
        };
    };

    exports.appendToJournal = function(eng,type,entry) {
        exports.appendToJournalWithTimestamp(eng,eng._timestamp(),type,entry);
    };

    exports.appendToJournalWithTimestamp = function(eng,ts,type,entry) {
        exports.appendStringToJournal(eng,util.serialise([ts,type,entry])+'\n');
    };

    exports.appendStringToJournal = function(eng,s) {
        fs.writeFileSync(path.join(eng.prevalenceDir,'state','journal'),s,{flag:'a'});
    };

    exports.dumpFile = function(filename) {
        console.log("========================== begin %s ==========================",filename);
        util.readFileLinesSync(filename,function(l) {
            console.log("  %s",l);
            return true;
        });
        console.log("=========================== end %s ===========================",filename);
    };

    exports.resetBl = (bl,fixture) => {
        const outputs = [];
        bl.reset();                 // `bl` is effectively shared by `require`
        for (const i in fixture)
            bl.add(fixture[i]);
        bl.getOutputs = function() {
            const ans = [];
            this._private.orderedFacts.forEach(function(f) {
                if (f[0]==='_output')
                    ans.push(f);
            });
            return ans.concat(outputs);
        };
        bl.addReturningOutputs = function(x) {
            this.add(x);
            const outs = this.getOutputs();
            this.add(['_take-outputs']); // convention to delete `_output` from store
            outputs.length = 0;
            return outs;
        };
        bl.addReturningOneOutput = function(x) {
            const outs = this.addReturningOutputs(x);
            assert(outs.length===1,util.format("expected single output, not: %j",outs));
            return outs[0];
        };
        bl.addReturningNoOutput = function(x) {
            const outs = this.addReturningOutputs(x);
            assert(outs.length===0,util.format("expected no output, not: %j",outs));
        };
        bl.getFactsWithTag = function(tag) { // +++ use Set() +++
            const ans = [];
            this._private.orderedFacts.forEach(function(f) {
                if (f[0]===tag)
                    ans.push(f[1]);
            });
            return ans;
        };
        return bl;
    };

    const testPort0 = 10000;
    exports.SystemSlice = function(bl) {
        this.port     = testPort0;
        this.bl       = bl;
        this.browsers = [];
        this.jsdom    = jsdom;  // save this so users can get correct module
    };

    exports.SystemSlice.prototype.reset = function(fixture) {
        exports.resetBl(this.bl,fixture||[]);
        this.browsers = [];
    };

    exports.SystemSlice.prototype.addBrowser = function(config) {
        const ss = this;
        return jsdom.env(Object.assign(
            {
                features: {
                    ProcessExternalResources: ["script"]
                }
            },
            config,
            {
                created: (err,w) => {
                    if (err)
                        throw err;
                    else {
                        w.WebSocket = function(url) {
                            const ws = {
                                port:      ss.port++,
                                send:      (s) => {
                                    const   js = JSON.parse(s);
                                    const fact = [js[0],js[1],{port:ws.port}];
                                    const outs = ss.bl.addReturningOutputs(fact);
                                    console.log("exec: %j\n====> %j",fact,outs);
                                    for (const k in outs) {
                                        const   out = outs[k];
                                        const reply = {data:JSON.stringify(out[2])+'\n'};
                                        if (out[1]==='all')
                                            ss.browsers.forEach((b)=>b._ws.onmessage(reply));
                                        else if (out[1]==='self')
                                            ws.onmessage(reply);
                                        else if (Number.isInteger(out[1])) {
                                            const dest = ss.browsers[out[1]-testPort0];
                                            if (dest)
                                                dest._ws.onmessage(reply);
                                            else
                                                throw new VError("NYI: send to %j",out[1]);
                                        } else
                                            throw new VError("NYI: send to %j",out[1]);
                                    }
                                },
                                onmessage: (x) => {
                                    throw new Error("onmessage called without handler: %j",x);
                                },
                                onerror: (x) => {
                                    throw new Error("onerror called without handler: %j",x);
                                }
                            };
                            w._ws = ws;
                            return ws;
                        };
                        if (config.created)
                            config.created(null,w);
                    }
                },
                onload:   (w) => {
                    ss.browsers.push(w);
                    if (config.onload)
                        config.onload(w);
                },
                ws: null
            }));
    };

    const ExtServer = function(serverJs,opts) {
        const srv = this;
        opts = opts || {};
        srv.serverJs      = serverJs;
        srv.prevalenceDir = opts.prevalenceDir || path.join(temp.mkdirSync(),'.prevalence');
        srv.git           = opts.git;
        srv.noisy         = opts.noisy;
        srv.proc          = null;
        srv.port          = null;
    };
    ExtServer.prototype._spawn = function(subcommand,args) {
        const srv = this;
        return cp.spawn("node",
                        [srv.serverJs,
                         '-p',srv.prevalenceDir
                        ].concat(
                            [subcommand],
                            args
                        ) );
    };
    ExtServer.prototype.init = function(args,done) {
        const srv = this;
        if (done===undefined) {
            done = args;
            args = [];
        }
        const proc = srv._spawn('init',args);
        proc
            .once('error',done)
            .once('exit',done);
    };
    ExtServer.prototype.run = function(args,cb) {
        const srv = this;
        if (cb===undefined) {
            cb   = args;
            args = [];
        }
        srv.proc = srv._spawn('run',
                              ['--private-test-urls',
                               '-w','0'].concat(args) );
        srv.proc.once('error',(err)=>{
            cb(err);
        });
        srv.proc.once('exit',(err)=>{
            srv.proc = null;
        });
        byline(srv.proc.stdout).on('data',(line)=>{
            line = line.toString();
            let m = /http listening on \*:([0-9]+)/.exec(line);
            if (m)
                srv.port = parseInt(m[1]);
            m = /^mode now: ([a-z]+)$/.exec(line);
            if (m && m[1]==='master')
                cb();
            if (srv.noisy)
                console.log(line);
        });
    };
    ExtServer.prototype.kill = function(sig) {
        const srv = this;
        if (srv.proc)
            srv.proc.kill(sig);
    };
    ExtServer.prototype._getFacts = function(cb) {
        const srv = this;
        http.get(`http://localhost:${srv.port}/_private/facts`,res=>{
            if (res.statusCode!==200) {
                cb(new Error(`_getFacts fails: ${res.statusCode}`));
                res.resume();
            } else {
                res.setEncoding('utf8');
                let data = '';
                res.on('data',chunk=>{data+=chunk;});
                res.on('end',()=>cb(null,util.deserialise(data)));
            }
        });
    };
    ExtServer.prototype.call = function(fn,cb) {
        const srv = this;
        srv._getFacts((err,facts)=>{
            if (err)
                cb(err);
            else try {
                cb(null,fn(facts));
            } catch (e) {
                cb(e);
            }
        });
    };
    exports.ExtServer = ExtServer;

    const WS = function(url,options) {
        const ws = this;
        if (url instanceof ExtServer) {
            ws.srv = url;
            url = `http://localhost:${url.port}/data`;
        } else
            ws.srv = null;
        ws.queue = [];
        // +++ cookies in `options` +++
        ws.sock  = new WebSocket(url,options);
        ws.jps   = new whiskey.JSONParseStream();
        ws.sock.onmessage = (e)=>{
            ws.jps.write(e.data);
        };
        ws.sock.onopen = ()=>{};
        ws._closehandler = ()=>{};    // internal
        ws.onclose       = ()=>{};    // for the user
        ws.sock.onclose  = ()=>{
            ws._closehandler();
            if (ws.onclose)
                ws.onclose();
        };
    };
    WS.prototype._next = function() {
        const ws = this;
        if (ws.queue.length>0) {
            const fn = ws.queue.shift();
            fn();
        }
    };
    WS.prototype.xmit = function(js) {
        const ws = this;
        ws.queue.push(()=>{
            if (js instanceof Function)
                js = js();
            ws.sock.send(JSON.stringify(js)+'\n');
            ws._next();
        });
        return ws;
    };
    WS.prototype.rcve = function(fn) {
        const ws = this;
        ws.queue.push(()=>{
            ws.jps.once('data',(js)=>{
                fn(js);
                ws._next();
            });
        });
        return ws;
    };
    WS.prototype.close = function(fn) {
        const ws = this;
        ws.queue.push(()=>{
            if (fn) fn();
            ws.sock.close();
            ws._next();
        });
        return ws;
    };
    WS.prototype.opened = function(fn) {
        const ws = this;
        ws.queue.push(()=>{
            if (ws.sock.readyState===1) {
                if (fn) fn();
                ws._next();
            } else
                ws.sock.onopen = ()=>{
                    ws.sock.onopen = null;
                    if (fn) fn();
                    ws._next();
                };
        });
        return ws;
    };
    WS.prototype.closed = function(fn) {
        const ws = this;
        ws.queue.push(()=>{
            if (ws.sock.readyState===3) {
                if (fn) fn();
                ws._next();
            } else
                ws._closehandler = ()=>{
                    if (fn) fn();
                    ws._next();
                };
        });
        return ws;
    };
    WS.prototype.call = function(fn) {
        const ws = this;
        if (fn.length===0) {
            ws.queue.push(()=>{
                fn();
                ws._next();
            });
        } else {
            if (ws.srv===null)
                throw new Error("can't do `call`, server unknown");
            ws.queue.push(()=>{
                ws.srv.call(fn,(err)=>{
                    if (err)
                        throw err;
                    else
                        ws._next();
                });
            });
        }
        return ws;
    };
    WS.prototype.assert = function(fn) {
        const ws = this;
        if (ws.srv===null)
            throw new Error("can't do `call`, server unknown");
        ws.queue.push(()=>{
            ws.srv.call((facts)=>assert(fn(facts),util.format("assert failed, facts: %j",facts)),
                        (err)=>{
                if (err)
                    throw err;
                else
                    ws._next();
            });
        });
        return ws;
    };
    WS.prototype.end = function(fn) {
        const ws = this;
        ws.queue.push(()=>{
            if (fn) fn();
            if (ws.queue.length>0)
                throw new VError("WS: end not final item: %j",ws.queue.map(fn1=>fn1.toString().slice(0,40)));
        });
        ws._next();
    };
    exports.WS = WS;

    exports.makeConnection = (srv)=>{
        if (srv instanceof ExtServer)
            return new WS(srv);
        else if (srv instanceof Engine)
            return new WS(srv);
        else
            throw new VError("can't find a connector for %j",srv);
    };
}
