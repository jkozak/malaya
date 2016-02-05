"use strict";

// for use in test scripts

const util = require('./util.js');

if (util.env==='test')  {
    const    engine = require('./engine.js');
    const    Engine = engine.Engine;
    const    assert = require("assert");
    const    events = require("events");
    const    stream = require("stream");
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

}
