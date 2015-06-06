var    engine = require('../engine.js');
var    Engine = engine.Engine;

var         _ = require("underscore");
var    assert = require("assert");
var    events = require("events");
var    stream = require("stream");
var      temp = require('temp').track();
var        fs = require('fs');
var      path = require('path');
var      util = require('../util.js');
var  testutil = require('../testutil.js');
var    VError = require('verror');
var      rmRF = require('rimraf');

describe("makeInertChrjs",function() {
    it("behaves somewhat like a chrjs store with no rules",function() {
        var st = engine.makeInertChrjs();
        assert.strictEqual(st.size,0);
        assert.deepEqual(st.add(['test',1]),{err:null,adds:[1],dels:[],refs:[]});
        assert.strictEqual(st.size,1);
        st.reset();
        assert.strictEqual(st.size,0);
    });
});

runInCountEngine = testutil.runInCountEngine;
createIO         = testutil.createIO;
makeTimestamp    = testutil.makeTimestamp;
appendToJournal  = testutil.appendToJournal;

describe("Engine",function() {
    describe("initialisation",function() {
        it("initialises various good things",function() {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir});
            eng.init();
            fs.statSync(dir);
            fs.statSync(path.join(dir,'.prevalence'));
            fs.statSync(path.join(dir,'.prevalence','hashes'));
            fs.statSync(path.join(dir,'.prevalence','state'));
            fs.statSync(path.join(dir,'.prevalence','state','journal'));
            fs.statSync(path.join(dir,'.prevalence','state','world'));
        });
        it("won't initialise over existing dir",function() {
            var  dir = temp.mkdirSync();
            var pdir = fs.mkdirSync(path.join(dir,'.prevalence'));
            var  eng = new Engine({dir:dir});
            assert.throws(function() {
                eng.init();
            });
        });    
        it("won't start without initialising",function() {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir});
            assert.throws(function() {
                eng.start();
            });
        });
    });
    describe("hashes",function() {
        it("creates a hash store at init time",function() {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir});
            eng.init();
            eng.start();
            var cHashes = eng.hashes.getHashes().length;
            var x = "testie testie";
            var h = eng.hashes.putSync(x);
            assert.strictEqual(eng.hashes.getHashes().length,cHashes+1);
            assert.strictEqual(eng.hashes.getSync(h,{encoding:'utf8'}),x);
        });
    });
    describe("#update",function(done) {
        it("writes items to store",function(done) {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir});
            eng.init();
            eng.start();
            assert.strictEqual(eng.chrjs.size,0);
            eng.startPrevalence(function(err) {
                if (err)
                    done(err);
                else
                    eng.update(['test',{},{}],function() {
                        assert.strictEqual(eng.chrjs.size,1);
                        eng.stop(true,function(err1) {
                            if (err1)
                                done(err1);
                            else {
                                var i = 1;
                                util.readFileLinesSync(path.join(eng.prevalenceDir,'state','journal'),function(l) {
                                    var js = util.deserialise(l);
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
                                    return true;
                                });
                                done();
                            }
                        });
                    });
            });
        });
    });
    describe("#stop",function(done) {
        it("saves the world slowly",function() {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir});
            eng.init();
            eng.start();
            eng.startPrevalence(function(err1) {
                if (err1)
                    done(err1);
                else {
                    rmRF.sync(path.join(eng.prevalenceDir,'state-OLD'));
                    eng.stopPrevalence(false,function(err2) {
                        if (err2)
                            cb(err2);
                        else {
                            assert(fs.existsSync(path.join(eng.prevalenceDir,'state')));
                            assert(fs.existsSync(path.join(eng.prevalenceDir,'state-OLD')));
                        }
                    });
                }
            });
        });
        it("saves the world quickly",function() {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir});
            eng.init();
            eng.start();
            eng.startPrevalence(function(err1) {
                if (err1)
                    done(err1);
                else {
                    rmRF.sync(path.join(eng.prevalenceDir,'state-OLD'));
                    eng.stopPrevalence(true,function(err2) {
                        if (err2)
                            cb(err2);
                        else {
                            assert( fs.existsSync(path.join(eng.prevalenceDir,'state')));
                            assert(!fs.existsSync(path.join(eng.prevalenceDir,'state-OLD')));
                        }
                    });
                }
            });
        });
    });
    describe("prevalence",function() {
        it("loads from newly initted state directory",function(done) {
            runInCountEngine(function(eng) {
                assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:0}]]);
                done();
            });
        });
        it("replays updates",function(done){
            runInCountEngine({
                init: function(eng) {appendToJournal(eng,'update',['x',{}]);},
                main: function(eng) {
                    assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:1}]]);
                    done();
                }
            }); 
        });
        it("saves and reloads updates",function(done){
            runInCountEngine({
                init: function(eng) {appendToJournal(eng,'update',['x',{}]);},
                main: function(eng) {
                    assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:1}]]);
                    eng.stopPrevalence(false,function(err) {
                        assert(!err);
                        eng.startPrevalence(function(err) {
                            assert(!err);
                            assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:1}]]);
                        });
                    });
                    done();
                }
            }); 
        });
        it("saves and reloads updates including journal",function(done){
            runInCountEngine({
                init: function(eng) {appendToJournal(eng,'update',['x',{}]);},
                main: function(eng) {
                    assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:1}]]);
                    eng.stopPrevalence(false,function(err) {
                        assert(!err);
                        appendToJournal(eng,'update',['x',{}]);
                        eng.startPrevalence(function(err) {
                            assert(!err);
                            assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:2}]]);
                        });
                    });
                    done();
                }
            }); 
        });
        // +++ 
    });
    describe("walking utilities",function() {
        it("traverses the journal file",function(done) {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir});
            var  hs = [];
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
            var   dir = temp.mkdirSync();
            var   eng = new Engine({dir:dir});
            var    hs = [];
            var done2 = _.after(2,done);
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
                                                               function(err,h,what) {
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
            var   dir = temp.mkdirSync();
            var   eng = new Engine({dir:dir});
            var  data = [['abc',{a:1}]];
            var   dfn = path.join(dir,'data.json');
            fs.writeFileSync(dfn,JSON.stringify(data));
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert(!err);
                assert.deepEqual(_.values(eng.chrjs._private.orderedFacts),[]);
                eng.loadData(dfn,function(err) {
                    assert(!err);
                    assert.deepEqual(_.values(eng.chrjs._private.orderedFacts),data);
                    done();
                });
            });
        });
        it("loads two items from a json file",function(done) {
            var   dir = temp.mkdirSync();
            var   eng = new Engine({dir:dir});
            var  data = [['abc',{a:1}],['def',{d:4}]];
            var   dfn = path.join(dir,'data.json');
            fs.writeFileSync(dfn,JSON.stringify(data));
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert(!err);
                assert.deepEqual(_.values(eng.chrjs._private.orderedFacts),[]);
                eng.loadData(dfn,function(err) {
                    assert(!err);
                    assert.deepEqual(_.values(eng.chrjs._private.orderedFacts),data);
                    done();
                });
            });
        });
    });
    describe("#addConnection",function() {
        it("sends input, receives output",function(done) {
            var eng = new Engine({dir:           temp.mkdirSync(),
                                  businessLogic: path.join(__dirname,'bl','output.chrjs') });
            var  io = createIO();
            eng.init();
            eng.start();
            eng.startPrevalence(function(err) {
                assert(!err);
                eng.addConnection('test://1',io);
                io.on('rcved',function() {
                    try {
                        assert.deepEqual(io.rcved,[{msg:"will this do?"}]);
                        done();
                    } catch (e) {done(e);}
                });
                io.i.write(['do_summat',{}]);
            });
        });
        it("multiplexes",function(done) {
            var eng = new Engine({dir:           temp.mkdirSync(),
                                  businessLogic: path.join(__dirname,'bl','output.chrjs') });
            var io1 = createIO();
            var io2 = createIO();
            var io3 = createIO();
            var err = null;
            var dun = _.after(3,function() {done(err);});
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
                            dun();
                        } catch (e) {err=e;dun();}
                    });
                });
                io1.i.write(['do_em_all',{}]);
            });
        });
    });
    describe("replication",function() {
        it("streams out the journal",function(done) {
            var eng = new Engine({dir:           temp.mkdirSync(),
                                  businessLogic: path.join(__dirname,'bl','null.chrjs') });
            var io = createIO('replication');
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
                        assert.deepEqual  (        io.rcved[1][2], ['something',{},{port:'test://'}]);
                        assert.strictEqual((typeof io.rcved[2][0]),'number');
                        assert.strictEqual(        io.rcved[2][1], 'update');
                        assert.deepEqual  (        io.rcved[2][2], ['else',{},{port:'test://'}]);
                        assert(io.rcved[1][0]<io.rcved[2][0]); // timestamps are monotonic increasing, distinct
                        done();
                    } catch (e) {done(e);}
                });
            });
        });
    });
    describe("administration",function() {
        it("supplies handy info on connect",function(done) {
            var eng = new Engine({dir:           temp.mkdirSync(),
                                  businessLogic: path.join(__dirname,'bl','null.chrjs') });
            var io = createIO('admin');
            eng.init();
            eng.start();
            io.on('rcved',function() {
                try {
                    assert.strictEqual(io.rcved.length,1);
                    assert.strictEqual(io.rcved[0][0],'engine');
                    assert.strictEqual((typeof io.rcved[0][1].syshash),'string');
                    assert.strictEqual(io.rcved[0][1].mode,'idle');
                    done();
                } catch (e) {done(e);}
            });
            eng.addConnection('test://admin',io);
        });
    });
});

