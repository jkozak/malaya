"use strict";

const   engine = require('../engine.js');
const   Engine = engine.Engine;
const compiler = require('../compiler.js');
const   plugin = require('../plugin.js');

const        _ = require('underscore');
const   assert = require('assert').strict;
const    sinon = require('sinon');
const    shell = require('shelljs');
const     temp = require('temp').track();
const       fs = require('fs');
const     path = require('path');
const     util = require('../util.js');
const testutil = require('../testutil.js');
const   VError = require('verror');
const     rmRF = require('rimraf');

describe("makeInertChrjs",function() {
    it("behaves somewhat like a chrjs store with no rules",function() {
        const st = engine.makeInertChrjs();
        assert.strictEqual(st.size,0);
        assert.deepEqual(st.add(['test',1]),{err:null,adds:[1],dels:[],refs:[]});
        assert.strictEqual(st.size,1);
        st.reset();
        assert.strictEqual(st.size,0);
    });
});

const runInCountEngine             = testutil.runInCountEngine;
const runInEngine                  = testutil.runInEngine;
const createIO                     = testutil.createIO;
const appendToJournal              = testutil.appendToJournal;
const appendToJournalWithTimestamp = testutil.appendToJournalWithTimestamp;
const appendStringToJournal        = testutil.appendStringToJournal;

describe("Engine",function() {
    describe("initialisation",function() {
        it("initialises various good things",function() {
            const dir = temp.mkdirSync();
            const eng = new Engine({dir:dir});
            eng.init();
            fs.statSync(dir);
            fs.statSync(path.join(dir,'.prevalence'));
            fs.statSync(path.join(dir,'.prevalence','hashes'));
            fs.statSync(path.join(dir,'.prevalence','state'));
            fs.statSync(path.join(dir,'.prevalence','state','journal'));
            fs.statSync(path.join(dir,'.prevalence','state','world'));
        });
        it("won't initialise over existing dir by default",function() {
            const  dir = temp.mkdirSync();
            const  eng = new Engine({dir:dir});
            fs.mkdirSync(path.join(dir,'.prevalence'));
            assert.throws(function() {
                eng.init();
            });
        });
        it("will initialise over existing dir if asked",function() {
            const  dir = temp.mkdirSync();
            const hdir = path.join(dir,'.prevalence','hashes');
            let    eng = new Engine({dir:dir});
            eng.init();
            fs.statSync(path.join(dir,'.prevalence'));
            assert.strictEqual(fs.readdirSync(hdir).length,1); // init saves world
            eng = new Engine({dir:dir,overwrite:true});
            eng.init();
            assert.strictEqual(fs.readdirSync(hdir).length,3); // 2 init saves and the term journal
        });
        it("won't start without initialising",function() {
            const dir = temp.mkdirSync();
            const eng = new Engine({dir:dir});
            assert.throws(function() {
                eng.start();
            });
        });
    });
    describe("hashes",function() {
        it("creates a hash store at init time",function() {
            const dir = temp.mkdirSync();
            const eng = new Engine({dir:dir});
            eng.init();
            eng.start();
            const cHashes = eng.hashes.getHashes().length;
            const x = "testie testie";
            const h = eng.hashes.putSync(x);
            assert.strictEqual(eng.hashes.getHashes().length,cHashes+1);
            assert.strictEqual(eng.hashes.getSync(h,{encoding:'utf8'}),x);
        });
    });
    describe("rng",function(){
        it("rng created, seeded with zero by default",function(){
            const eng = new Engine({dir:temp.mkdirSync()});
            eng.init();
            assert.strictEqual(eng._rng.seed,0);
        });
        it("rng created, seeded from options where present",function(){
            const seed = 9982918;
            const  eng = new Engine({dir:temp.mkdirSync(),
                                     rngSeed:seed});
            eng.init();
            assert.strictEqual(eng._rng.seed,seed);
        });
    });
    describe("#update",function() {
        it("writes items to store",function(done) {
            const dir = temp.mkdirSync();
            const eng = new Engine({dir:dir});
            eng.init();
            eng.start();
            assert.strictEqual(eng.chrjs.size,0);
            eng.startPrevalence(function(err) {
                if (err)
                    done(err);
                else
                    eng.update(['test',{},{}],function() {
                        assert.strictEqual(eng.chrjs.size,1);
                        eng.stopPrevalence(true,function(err1) {
                            if (err1)
                                done(err1);
                            else {
                                let i = 1;
                                util.readFileLinesSync(path.join(eng.prevalenceDir,'state','journal'),function(l) {
                                    const js = util.deserialise(l);
                                    switch (i++) {
                                    case 1:
                                        assert.strictEqual(js[1],'previous');
                                        break;
                                    case 2:
                                        assert.strictEqual(js[1],'update');
                                        assert.deepEqual(js[2],['test',{},{}]);
                                        break;
                                    default:
                                        throw new VError("unexpected line %d %j",i,l);
                                    }
                                });
                                eng.stop(true,done);
                            }
                        });
                    });
            });
        });
    });
    describe("#stop",function(done) {
        it("saves the world slowly",function() {
            const dir = temp.mkdirSync();
            const eng = new Engine({dir:dir});
            eng.init();
            eng.start();
            eng.startPrevalence(function(err1) {
                if (err1)
                    done(err1);
                else {
                    rmRF.sync(path.join(eng.prevalenceDir,'state-OLD'));
                    eng.stopPrevalence(false,function(err2) {
                        assert(!err2);
                        assert(fs.existsSync(path.join(eng.prevalenceDir,'state')));
                        assert(fs.existsSync(path.join(eng.prevalenceDir,'state-OLD')));
                    });
                }
            });
        });
        it("saves the world quickly",function() {
            const dir = temp.mkdirSync();
            const eng = new Engine({dir:dir});
            eng.init();
            eng.start();
            eng.startPrevalence(function(err1) {
                if (err1)
                    done(err1);
                else {
                    rmRF.sync(path.join(eng.prevalenceDir,'state-OLD'));
                    eng.stopPrevalence(true,function(err2) {
                        assert(!err2);
                        assert( fs.existsSync(path.join(eng.prevalenceDir,'state')));
                        assert(!fs.existsSync(path.join(eng.prevalenceDir,'state-OLD')));
                    });
                }
            });
        });
    });
    describe("prevalence",function() {
        after(()=>compiler._bindGlobals());
        it("loads from newly initted state directory",function(done) {
            runInCountEngine(function(eng) {
                assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:0}]]);
                eng.stopPrevalence(true,done);
            });
        });
        it("replays updates",function(done){
            runInCountEngine({
                init: function(eng) {appendToJournal(eng,'update',['x',{}]);},
                main: function(eng) {
                    assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:1}]]);
                    eng.stopPrevalence(true,done);
                }
            });
        });
        it("saves and reloads",function(done){
            runInCountEngine({
                init: function(eng) {appendToJournal(eng,'update',['x',{}]);},
                main: function(eng) {
                    assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:1}]]);
                    eng.stopPrevalence(false,function(err) {
                        assert(!err);
                        eng.startPrevalence(function(err1) {
                            assert(!err1);
                            assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:1}]]);
                            eng.stopPrevalence(true,done);
                        });
                    });
                }
            });
        });
        it("saves and reloads journal",function(done){
            runInCountEngine({
                init: function(eng) {appendToJournal(eng,'update',['x',{}]);},
                main: function(eng) {
                    assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:1}]]);
                    eng.stopPrevalence(false,function(err) {
                        assert(!err);
                        appendToJournal(eng,'update',['x',{}]);
                        eng.startPrevalence(function(err1) {
                            assert(!err1);
                            assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:2}]]);
                            eng.stopPrevalence(true,done);
                        });
                    });
                }
            });
        });
        it("closes and reloads journal",function(done){
            runInCountEngine({
                init: function(eng) {appendToJournal(eng,'update',['x',{}]);},
                main: function(eng) {
                    assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:1}]]);
                    eng.stopPrevalence(true,function(err) {
                        assert(!err);
                        appendToJournal(eng,'update',['x',{}]);
                        eng.startPrevalence(function(err1) {
                            assert(!err1);
                            assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:2}]]);
                            eng.stopPrevalence(true,done);
                        });
                    });
                }
            });
        });
        it("copes with crash-damaged journal",function(done){ // bug in 2015-07-20 demo
            runInCountEngine({
                init: function(eng) {
                    appendToJournal(eng,'update',['x',{}]);
                    appendStringToJournal(eng,"[1437635839892,\":upd"); // possible crash behaviour
                },
                main: function(eng) {
                    assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:1}]]);
                    eng.stopPrevalence(true,function(err) {
                        assert(!err);
                        appendToJournal(eng,'update',['x',{}]);
                        eng.startPrevalence(function(err1) {
                            assert(!err1);
                            assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:2}]]);
                            eng.stopPrevalence(true,done);
                        });
                    });
                }
            });
        });
        it("sets Date.now from journal timestamp",function(done) {
            const  ts = 12345678;
            runInEngine(path.join(__dirname,'bl/timely.malaya'),{
                init: function(eng) {
                    eng._bindGlobals();
                    appendToJournalWithTimestamp(eng,12345678,'update',['x',{}]);
                },
                main: function(eng) {
                    assert.strictEqual(eng.chrjs._private.orderedFacts.length,1);
                    assert.strictEqual(ts,eng.chrjs._private.orderedFacts[0][1].date);
                    done();
                }
            });
        });
        describe("Math.random determinism",function(){
            this.bail(true);
            const dir = temp.mkdirSync();
            let   r1,r2,r3;
            let   d2;
            it("sanity tests for (my understanding of) mt",function(){
                const random = require('random-js');
                const    rng = {
                    engine: random.engines.mt19937(),
                    dist:   random.real(0,1,false)
                };
                rng.engine.seed(0);
                r1 = rng.dist(rng.engine);
                r2 = rng.dist(rng.engine);
                r3 = rng.dist(rng.engine);
                rng.engine.seed(0);
                assert.strictEqual(r1,rng.dist(rng.engine)); d2 = rng.engine.getUseCount();
                assert.strictEqual(r2,rng.dist(rng.engine));
                assert.strictEqual(r3,rng.dist(rng.engine));
                rng.engine.seed(0);
                rng.engine.discard(0);
                assert.strictEqual(r1,rng.dist(rng.engine));
                assert.strictEqual(r2,rng.dist(rng.engine));
                assert.strictEqual(r3,rng.dist(rng.engine));
                rng.engine.seed(0);
                rng.engine.discard(d2);
                assert.strictEqual(r2,rng.dist(rng.engine));
                assert.strictEqual(r3,rng.dist(rng.engine));
            });
            it("runs and stops quickly",function(done) {
                runInEngine(path.join(__dirname,'bl/rando.malaya'),{
                    dir:  dir,
                    bind: true,
                    init: function(eng) {
                        appendToJournal(eng,'update',['r',{}]);
                    },
                    main: function(eng) {
                        assert.strictEqual(eng.chrjs._private.orderedFacts.length,1);
                        assert.strictEqual(r1,eng.chrjs._private.orderedFacts[0][1].random);
                        eng.stopPrevalence(true,done);
                    }
                });
            });
            it("reloads from journal",function(done) {
                runInEngine(path.join(__dirname,'bl/rando.malaya'),{
                    dir:  dir,
                    bind: true,
                    init: false,
                    main: function(eng) {
                        assert.strictEqual(eng.chrjs._private.orderedFacts.length,1);
                        assert.strictEqual(r1,eng.chrjs._private.orderedFacts[0][1].random);
                        eng.update(['r',{}],(err)=>{
                            if (err)
                                done(err);
                            else {
                                assert.strictEqual(r2,eng.chrjs._private.orderedFacts[0][1].random);
                                eng.stopPrevalence(false,done);
                            }
                        });
                    }
                });
            });
            it("reloads from world",function(done) {
                runInEngine(path.join(__dirname,'bl/rando.malaya'),{
                    dir:  dir,
                    bind: true,
                    init: false,
                    main: function(eng) {
                        assert.strictEqual(eng.chrjs._private.orderedFacts.length,1);
                        assert.strictEqual(r2,eng.chrjs._private.orderedFacts[0][1].random);
                        eng.update(['r',{}],(err)=>{
                            if (err)
                                done(err);
                            else {
                                assert.strictEqual(r3,eng.chrjs._private.orderedFacts[0][1].random);
                                eng.stopPrevalence(true,done);
                            }
                        });
                    }
                });
            });
        });
        it("handles journal item causing `fail`",function(done){
            runInEngine(path.join(__dirname,'bl/fail.malaya'),{
                init: function(eng) {
                    appendToJournal(eng,'update',['fail',{}]);
                },
                main: function(eng) {
                    assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{failCount:1}]]);
                    done();
                }
            });
        });
        // +++
    });
    describe("walking utilities",function() {
        it("traverses the journal file",function(done) {
            const dir = temp.mkdirSync();
            const eng = new Engine({dir:dir});
            const  hs = [];
            eng.init();
            eng.start();
            eng.stop();
            engine.walkJournalFile(path.join(dir,'.prevalence','state','journal'),
                                   false,
                                   function(err,x,what) {
                                       assert.strictEqual(err,null);
                                       if (what==='journal')
                                           hs.push(x);
                                   },
                                   function() {
                                       assert.strictEqual(hs.length,1);
                                       done(); });
        });
        it("traverses the journal file and hash store",function(done) {
            const   dir = temp.mkdirSync();
            const   eng = new Engine({dir:dir});
            const    hs = [];
            const done2 = _.after(2,done);
            eng.init();
            eng.start();
            eng.startPrevalence(function(e1) {
                assert(!e1);
                eng.stopPrevalence(false,function(e2) {
                    assert(!e2);
                    engine.walkJournalFile(path.join(dir,'.prevalence','state','journal'),
                                           false,
                                           function(err,x,what) {
                                               assert.strictEqual(err,null);
                                               if (what==='journal') {
                                                   engine.walkHashes(eng.hashes,
                                                                     x,
                                                                     false,
                                                                     function(err1,h,w) {
                                                                         assert(!err1);
                                                                         if (what==='journal')
                                                                             hs.push(h);
                                                                     },
                                                                     function() {
                                                                         done2();
                                                                     });
                                               }
                                           },
                                           function() {
                                               done2(); });
                });
            });
        });
    });
    describe("#loadData",function() {
        it("loads single item from a json file",function(done) {
            const   dir = temp.mkdirSync();
            const   eng = new Engine({dir:dir});
            const  data = [['abc',{a:1}]];
            const   dfn = path.join(dir,'data.json');
            fs.writeFileSync(dfn,JSON.stringify(data));
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert(!err);
                assert.deepEqual(_.values(eng.chrjs._private.orderedFacts),[]);
                eng.loadData(dfn,function(err1) {
                    assert(!err1);
                    assert.deepEqual(_.values(eng.chrjs._private.orderedFacts),data);
                    eng.stopPrevalence(true,done);
                });
            });
        });
        it("loads two items from a json file",function(done) {
            const   dir = temp.mkdirSync();
            const   eng = new Engine({dir:dir});
            const  data = [['abc',{a:1}],['def',{d:4}]];
            const   dfn = path.join(dir,'data.json');
            fs.writeFileSync(dfn,JSON.stringify(data));
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert(!err);
                assert.deepEqual(_.values(eng.chrjs._private.orderedFacts),[]);
                eng.loadData(dfn,function(err1) {
                    assert(!err1);
                    assert.deepEqual(_.values(eng.chrjs._private.orderedFacts),data);
                    eng.stopPrevalence(true,done);
                });
            });
        });
        it("loads many items from a jsonl file",function(done) {
            const   dir = temp.mkdirSync();
            const   eng = new Engine({dir:dir});
            const  data = [['abc',{a:1}],['def',{d:4}]];
            const   dfn = path.join(dir,'data.jsonl');
            const     n = 60;
            for (let i=0;i<60;i++)
                fs.writeFileSync(dfn,JSON.stringify([data,{value:i}])+'\n',{flag:'a'});
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert(!err);
                assert.strictEqual(eng.chrjs._private.orderedFacts.length,0);
                eng.loadData(dfn,function(err1) {
                    if (err1)
                        throw err1;
                    assert.strictEqual(eng.chrjs._private.orderedFacts.length,n);
                    eng.stopPrevalence(true,done);
                });
            });
        });
    });
    describe("#addConnection using `_output` pseudo-fact",function() {
        it("sends input, receives output",function(done) {
            const eng = new Engine({dir:           temp.mkdirSync(),
                                    magic:         {'_take-outputs':true},
                                    businessLogic: path.join(__dirname,'bl','output.chrjs') });
            const  io = createIO();
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert(!err);
                eng.addConnection('test://1',io);
                io.on('rcved',function() {
                    try {
                        assert.deepEqual(io.rcved,[{msg:"will this do?"}]);
                        eng.stopPrevalence(true,done);
                    } catch (e) {done(e);}
                });
                io.i.write(['do_summat',{}]);
            });
        });
        it("multiplexes",function(done) {
            const eng = new Engine({dir:           temp.mkdirSync(),
                                    magic:         {'_take-outputs':true},
                                    businessLogic: path.join(__dirname,'bl','output.chrjs') });
            const io1 = createIO();
            const io2 = createIO();
            const io3 = createIO();
            let  err1 = null;
            let     n = 0;
            const dun = _.after(3,()=>eng.stopPrevalence(true,(e)=>{
                if (!err1)
                    assert.strictEqual(n,3);
                done(err1);
            }));
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert(!err);
                eng.addConnection('test://1',io1);
                eng.addConnection('test://2',io2);
                eng.addConnection('test://3',io3);
                [io1,io2,io3].forEach(function(io) {
                    io.on('rcved',function() {
                        try {
                            assert.deepEqual(io.rcved,[{msg:"that's yer lot"}]);
                            n++;
                            dun();
                        } catch (e) {err1=e;dun();}
                    });
                });
                io1.i.write(['do_em_all',{}]);
            });
        });
    });
    describe("#addConnection using `out` function",function() {
        let clock;
        before(()=>{clock=sinon.useFakeTimers();});
        after(()=>{clock.restore();});
        const mkOutChrjs = require(path.join(__dirname,'bl','out.chrjs')); // eslint-disable-line security/detect-non-literal-require
        it("sends input, receives output",function(done) {
            const eng = new Engine({dir:   temp.mkdirSync(),
                                    chrjs: mkOutChrjs() });
            const  io = createIO();
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert(!err);
                eng.addConnection('test://1',io);
                io.on('rcved',function() {
                    try {
                        assert.deepEqual(io.rcved,[{msg:"did you like that?"}]);
                        eng.stopPrevalence(true,done);
                    } catch (e) {done(e);}
                });
                io.i.write(['do_summat',{}]);
            });
        });
        it("multiplexes",function(done) {
            const eng = new Engine({dir:   temp.mkdirSync(),
                                    chrjs: mkOutChrjs() });
            const io1 = createIO();
            const io2 = createIO();
            const io3 = createIO();
            let     n = 0;
            let  err1 = null;
            const dun = _.after(3,()=>eng.stopPrevalence(true,(e)=>{
                if (!err1)
                    assert.strictEqual(n,3);
                done(err1);
            }));
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert(!err);
                eng.addConnection('test://1',io1);
                eng.addConnection('test://2',io2);
                eng.addConnection('test://3',io3);
                [io1,io2,io3].forEach(function(io) {
                    io.on('rcved',function() {
                        try {
                            assert.deepEqual(io.rcved,[{msg:"shame... that's all there is..."}]);
                            n++;
                            dun();
                        } catch (e) {err1=e;dun();}
                    });
                });
                io1.i.write(['do_em_all',{}]);
            });
        });
        it("disconnects",function(done){
            const eng = new Engine({dir:   temp.mkdirSync(),
                                    chrjs: mkOutChrjs() });
            const  io = createIO();
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert(!err);
                eng.addConnection('test://1',io);
                eng.once('connectionClose',function(portName,type) {
                    assert.strictEqual(portName,'test://1');
                    assert.strictEqual(type,    'data');
                    done();
                });
                io.i.write(['disconnect_me',{}]);
            });
        });
        describe("schedules",function(){
            let eng,io,facts;
            before((done)=>{
                eng = new Engine({dir:   temp.mkdirSync(),
                                  chrjs: mkOutChrjs() });
                io    = createIO();
                facts = ()=>eng.chrjs._private.orderedFacts;
                eng.init();
                eng.start();
                eng.startPrevalence(function(err) {
                    if (err)
                        done(err);
                    else {
                        eng.addConnection('test://1',io);
                        done();
                    }
                });
            });
            after((done)=>{
                eng.stop(true,done);
            });
            it("a single anonymous event",function(done){
                io.i.write(['schedule_me',{}]);
                assert.strictEqual(facts().length,0);
                clock.tick(9999);
                assert.strictEqual(facts().length,0);
                clock.tick(1);
                assert.strictEqual(facts().length,1);
                assert.strictEqual(facts()[0][0],'scheduled');
                clock.tick(20000);
                assert.strictEqual(facts().length,1); // no repeat
                eng.chrjs.reset();
                assert.strictEqual(facts().length,0);
                done();
            });
            it("a single named event",function(done){
                assert.strictEqual(facts().length,0);
                io.i.write(['schedule_me_named',{named:'ev'}]);
                clock.tick(0);
                assert.strictEqual(facts().length,1);
                assert.strictEqual(facts()[0][1].named,'ev');
                clock.tick(9999);
                assert.strictEqual(facts().length,1);
                clock.tick(1);
                assert.strictEqual(facts().length,2);
                clock.tick(20000);
                assert.strictEqual(facts().length,2); // no repeat
                eng.chrjs.reset();
                assert.strictEqual(facts().length,0);
                done();
            });
            it("a single named event...",function(done){
                assert.strictEqual(facts().length,0);
                io.i.write(['schedule_me_named',{named:'ev'}]);
                clock.tick(0);
                assert.strictEqual(facts().length,1);
                assert.strictEqual(facts()[0][1].named,'ev');
                assert(facts()[0][1]._id);
                clock.tick(9998);
                assert.strictEqual(facts().length,1);
                done();
            });
            it("...which is cancelled",function(done){
                io.i.write(['cancel_me',{named:'ev'}]);
                clock.tick(0);
                assert.strictEqual(facts().length,0);
                clock.tick(20000);
                assert.strictEqual(facts().length,0);
                done();
            });
            it("a repeating event...",function(done){
                assert.strictEqual(facts().length,0);
                io.i.write(['schedule_me_named_lots',{named:'maev'}]);
                clock.tick(0);
                assert.strictEqual(facts().length,1);
                assert.strictEqual(facts()[0][1].named,'maev');
                clock.tick(999);
                assert.strictEqual(facts().length,1);
                clock.tick(1);
                assert.strictEqual(facts().length,2);
                assert.strictEqual(facts()[1][0],'muchScheduled');
                clock.tick(1000);
                assert.strictEqual(facts().length,3);
                clock.tick(1000);
                assert.strictEqual(facts().length,4);
                done();
            });
            it("...which is also cancelled",function(done){
                io.i.write(['cancel_me',{named:'maev'}]);
                clock.tick(0);
                assert.strictEqual(facts().length,3); // deletes the _scheduled
                clock.tick(20000);
                assert.strictEqual(facts().length,3);
                eng.chrjs.reset();
                assert.strictEqual(facts().length,0);
                done();
            });
            it("an anonymous repeating event",function(done){
                assert.strictEqual(facts().length,0);
                io.i.write(['schedule_me_lots',{}]);
                clock.tick(0);
                assert.strictEqual(facts().length,0);
                clock.tick(999);
                assert.strictEqual(facts().length,0);
                clock.tick(1);
                assert.strictEqual(facts().length,1);
                assert.strictEqual(facts()[0][0],'muchScheduled');
                clock.tick(1000);
                assert.strictEqual(facts().length,2);
                clock.tick(1000);
                assert.strictEqual(facts().length,3);
                done();
            });
        });
    });
    describe("magic facts",function(){
        let eng;
        const factChecker = (facts,done) => {
            setImmediate(()=> {
                try {
                    assert.deepEqual(eng.chrjs._private.orderedFacts,facts);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        };
        const mkMagicEngineStarter = (magic) => (done) => {
            eng = new Engine({dir:   temp.mkdirSync(),
                              ports: {},
                              magic: magic});
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert.deepEqual(eng.chrjs.size,0);
                done(err);
            });
        };
        describe("_restart when requested",function(){
            before(mkMagicEngineStarter({_restart:true}));
            it("learns about rebirth",function(done){
                eng.on('mode',(mode)=>{
                    if (mode==='master')
                        factChecker([['_restart',{},{port:'server:'}]],done);
                });
                eng.become('master');
            });
        });
        describe("_connect and _disconnects when requested",function(){
            before(mkMagicEngineStarter({_connect:true,_disconnect:true}));
            beforeEach(function(){eng.chrjs.reset();});
            it("learn about a new connection",function(done){
                factChecker([['_connect',{port:'test://1',type:'data',cookies:{}},{port:'server:'}]],done);
                eng.addConnection('test://1',createIO());
            });
            it("learn about another new connection",function(done){
                factChecker([['_connect',{port:'test://2',type:'data',cookies:{}},{port:'server:'}]],done);
                eng.addConnection('test://2',createIO());
            });
            it("learn about a lost connection",function(done){
                factChecker([['_disconnect',{port:'test://1',type:'data'},{port:'server:'}]],done);
                eng.closeConnection('test://1');
            });
            it("learn about another lost connection",function(done){
                factChecker([['_disconnect',{port:'test://2',type:'data'},{port:'server:'}]],done);
                eng.closeConnection('test://2');
            });
        });
        describe("when not requested",function(){
            before(mkMagicEngineStarter({}));
            beforeEach(function(){eng.chrjs.reset();});
            it("remain ignorant about rebirth",function(done){
                eng.on('mode',(mode)=>{
                    if (mode==='master')
                        factChecker([],done);
                });
                eng.become('master');
            });
            it("doesn't learn about a new connection",function(done){
                factChecker([],done);
                eng.addConnection('test://1',createIO());
            });
            it("doesn't learn about a lost connection",function(done){
                factChecker([],done);
                eng.closeConnection('test://1');
            });
        });
    });
    describe("replication",function() {
        it("streams out the journal",function(done) {
            const eng = new Engine({dir:           temp.mkdirSync(),
                                    businessLogic: path.join(__dirname,'bl','null.chrjs') });
            const io = createIO('replication');
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert(!err);
                eng.addConnection('test://replication/1',io);
                eng.update(['something',{},{port:'test://'}]);
                eng.update(['else',{},{port:'test://'}],function() {
                    try {
                        assert.strictEqual(io.rcved.length,3);
                        assert.strictEqual(        io.rcved[0][0],'open');
                        assert.strictEqual((typeof io.rcved[0][1].journalSize),'number');
                        assert.strictEqual((typeof io.rcved[1][0]),'number');
                        assert.strictEqual(        io.rcved[1][1], 'update');
                        assert.deepEqual(          io.rcved[1][2], ['something',{},{port:'test://'}]);
                        assert.strictEqual((typeof io.rcved[2][0]),'number');
                        assert.strictEqual(        io.rcved[2][1], 'update');
                        assert.deepEqual(          io.rcved[2][2], ['else',{},{port:'test://'}]);
                        assert(io.rcved[1][0]<io.rcved[2][0]); // timestamps are monotonic increasing, distinct
                        eng.stopPrevalence(true,done);
                    } catch (e) {done(e);}
                });
            });
        });
    });
    describe("administration",function() {
        it("supplies handy info on connect",function(done) {
            const eng = new Engine({dir:           temp.mkdirSync(),
                                    businessLogic: path.join(__dirname,'bl','null.chrjs') });
            const  io = createIO('admin');
            let    ok = false;
            eng.init();
            eng.start();
            io.on('rcved',function() {
                try {
                    if (!ok) {
                        assert.strictEqual(io.rcved[0][0],'engine');
                        assert.strictEqual((typeof io.rcved[0][1].syshash),'string');
                        assert.strictEqual(io.rcved[0][1].mode,'idle');
                        done();
                        ok = true;
                    }
                } catch (e) {done(e);}
            });
            eng.addConnection('test://admin',io);
        });
    });
    describe("git prevalence backup",function(){
        let       dir;
        let       srv;
        const jHashes = [];
        const     git = (args,opts)=>shell.exec("git "+args,
                                                _.extend({cwd:   srv.prevalenceDir,
                                                          silent:true},
                                                         opts));
        after(()=>{
            if (srv)
                srv.kill();
        });
        it("won't init into an existing repo",function(done){
            dir = temp.mkdirSync();
            srv = new testutil.ExtServer('malaya',{prevalenceDir:path.join(dir,'.prevalence')});
            this.timeout(10000);
            assert.strictEqual(git("init",{cwd:dir}).code,0);
            srv.init(['--git','commit','test/bl/null.chrjs'],(err)=>{
                if (err)
                    done();
                else
                    done(new Error(`--git init should fail against an existing repo`));
            });
        });
        it("git inits a repo at init time",function(done){
            dir = temp.mkdirSync();
            srv = new testutil.ExtServer('malaya',{prevalenceDir:path.join(dir,'.prevalence')});
            this.timeout(10000);
            srv.init(['--git','commit','test/bl/null.chrjs'],done);
        });
        it("has an initial commit...",function(){
            const log = git("log --oneline");
            assert.strictEqual(log.code,0);
            const lines = log.stdout.trim().split('\n');
            assert.strictEqual(lines.length,1);
            assert(/^[0-9a-f]+ prevalence world save: [0-9a-f]+$/.exec(lines[0]));
        });
        it("...in special branch",function(){
            const branch = git("branch");
            assert.strictEqual(branch.code,0);
            const lines = branch.stdout.trim().split('\n');
            assert.strictEqual(lines.length,1);
            assert.strictEqual(lines[0],"* prevalence");
        });
        it("commits again when engine cycled",function(done){
            this.timeout(10000);
            srv.run(['test/bl/null.chrjs'],(err)=>{
                if (err)
                    done(err);
                else {
                    srv.proc.once('exit',()=>{
                        const log = git("log --oneline");
                        assert.strictEqual(log.code,0);
                        const lines = log.stdout.trim().split('\n');
                        assert.strictEqual(lines.length,2);
                        lines.forEach((l)=>{
                            const m = /^[0-9a-f]+ prevalence world save: ([0-9a-f]+)$/.exec(l);
                            assert(m);
                            jHashes.push(m[1]);
                        });
                        done();
                    });
                    srv.kill('SIGINT');
                }
            });
        });
        it("has created tags",function(){
            const tagrc = git("tag");
            assert.strictEqual(tagrc.code,0);
            const tags = tagrc.stdout.split(/\r?\n/);
            jHashes.forEach(jh=>{
                assert(tags.includes('JOURNAL-'+jh));
            });
        });
    });
    describe("plugin",function(){
        const opts = {};
        let    eng;
        before(()=>{
            eng = new Engine({dir:           temp.mkdirSync(),
                              businessLogic: path.join(__dirname,'bl','null.chrjs') });
        });
        after(()=>{plugin._private.forgetAll();});
        it("provides special out destination",function(done) {
            const jsOut = {op:'munge',data:[3,4,5]};
            opts.out = (js)=>{
                assert.deepEqual(js,jsOut);
                done();
            };
            eng.addPlugin('twiddle',opts);
            eng.init();
            eng.start();
            eng.out('twiddle',jsOut);
        });
        it("installs an update function",function(){
            assert.strictEqual(typeof opts.update,'function');
        });
    });
});
