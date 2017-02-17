"use strict";

const   engine = require('../engine.js');
const   Engine = engine.Engine;

const        _ = require("underscore");
const   assert = require("chai").assert;
const    sinon = require("sinon");
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

const runInCountEngine      = testutil.runInCountEngine;
const createIO              = testutil.createIO;
const appendToJournal       = testutil.appendToJournal;
const appendStringToJournal = testutil.appendStringToJournal;

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
        it("won't initialise over existing dir",function() {
            const  dir = temp.mkdirSync();
            const  eng = new Engine({dir:dir});
            fs.mkdirSync(path.join(dir,'.prevalence'));
            assert.throws(function() {
                eng.init();
            });
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
            eng.walkJournalFile(path.join(dir,'.prevalence','state','journal'),
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
                    eng.walkJournalFile(path.join(dir,'.prevalence','state','journal'),
                                        false,
                                        function(err,x,what) {
                                            assert.strictEqual(err,null);
                                            if (what==='journal') {
                                                eng.walkHashes(x,
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
    });
    describe("#addConnection using `_output` pseudo-fact",function() {
        it("sends input, receives output",function(done) {
            const eng = new Engine({dir:           temp.mkdirSync(),
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
        const mkOutChrjs = require(path.join(__dirname,'bl','out.chrjs'));
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
        it("schedules",function(done){
            const   eng = new Engine({dir:   temp.mkdirSync(),
                                      chrjs: mkOutChrjs() });
            const    io = createIO();
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert(!err);
                eng.addConnection('test://1',io);
                io.i.write(['schedule_me',{}]);
                assert.strictEqual(Object.keys(eng.chrjs._private.orderedFacts).length,0);
                clock.tick(9999);
                assert.strictEqual(Object.keys(eng.chrjs._private.orderedFacts).length,0);
                clock.tick(1);
                assert.strictEqual(Object.keys(eng.chrjs._private.orderedFacts).length,1);
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
                factChecker([['_connect',{port:'test://1',type:'data'},{port:'server:'}]],done);
                eng.addConnection('test://1',createIO());
            });
            it("learn about another new connection",function(done){
                factChecker([['_connect',{port:'test://2',type:'data'},{port:'server:'}]],done);
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
});
