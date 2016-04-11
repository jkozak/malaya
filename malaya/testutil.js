"use strict";

// for use in test scripts

const util = require('./util.js');

if (util.env==='test')  {
    const         _ = require('underscore');
    const    VError = require('verror');
    const    engine = require('./engine.js');
    const    Engine = engine.Engine;
    const    assert = require("assert");
    const    events = require("events");
    const    stream = require("stream");
    const     jsdom = require('jsdom');
    const      path = require('path');
    const      temp = require('temp').track();
    const        fs = require('fs');

    const runInEngine = exports.runInEngine = function(source,opts) {
        if ((typeof opts)==='function')
            opts = {main:opts};
        else
            opts = opts || {};
        const dir = temp.mkdirSync();
        const eng = new Engine({dir:dir,businessLogic:source});
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
        exports.appendStringToJournal(eng,util.serialise([eng.timestamp(),type,entry])+'\n');
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
        GLOBAL.out = function(d,j) { // !!! this is not ideal !!!
            outputs.push(['_output',d,j]);
        };
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
        return jsdom.env(_.extend(
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
}
