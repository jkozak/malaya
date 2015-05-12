var  engine = require('../engine.js');
var  Engine = engine.Engine;

var       _ = require("underscore");
var  assert = require("assert");
var    temp = require('temp').track();
var      fs = require('fs');
var    path = require('path');
var    util = require('../util.js');
var  VError = require('verror');
var    rmRF = require('rimraf');
var noteReq = require('./note-requires.js');

function createTestStore() {
    return engine.makeInertChrjs();
}

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

describe("Engine",function() {
    describe("initialisation",function() {
        it("initialises various good things",function() {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir,chrjs:createTestStore()});
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
            var  eng = new Engine({dir:dir,chrjs:createTestStore()});
            assert.throws(function() {
                eng.init();
            });
        });    
        it("won't start without initialising",function() {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir,chrjs:createTestStore()});
            assert.throws(function() {
                eng.start();
            });
        });
    });
    describe("hashes",function() {
        it("creates a hash store at init time",function() {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir,chrjs:createTestStore()});
            eng.init();
            eng.start();
            var cHashes = eng.hashes.getHashes().length;
            var x = "testie testie";
            var h = eng.hashes.putSync(x);
            assert.strictEqual(eng.hashes.getHashes().length,cHashes+1);
            assert.strictEqual(eng.hashes.getSync(h,{encoding:'utf8'}),x);
        });
    });
    describe("#update",function() {
        it("writes items to store",function(done) {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir,chrjs:createTestStore()});
            eng.init();
            eng.start();
            assert.strictEqual(eng.chrjs.size,0);
            eng.update(['test',{},{}],function() {
                assert.strictEqual(eng.chrjs.size,1);
                eng.on('stopped',function() {
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
                });
                eng.stop(true);
            });
        });
    });
    describe("#stop",function() {
        it("saves the world slowly",function() {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir,chrjs:createTestStore()});
            eng.init();
            eng.start();
            rmRF.sync(path.join(eng.prevalenceDir,'state-OLD'));
            eng.on('stopped',function() {
                assert(fs.existsSync(path.join(eng.prevalenceDir,'state')));
                assert(fs.existsSync(path.join(eng.prevalenceDir,'state-OLD')));
            });
            eng.stop();
        });
        it("saves the world quickly",function() {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir,chrjs:createTestStore()});
            eng.init();
            eng.start();
            rmRF.sync(path.join(eng.prevalenceDir,'state-OLD'));
            eng.on('stopped',function() {
                assert( fs.existsSync(path.join(eng.prevalenceDir,'state')));
                assert(!fs.existsSync(path.join(eng.prevalenceDir,'state-OLD')));
            });
            eng.stop(true);
        });
    });
    describe("walking utilities",function() {
        it("traverses the journal file",function(done) {
            var dir = temp.mkdirSync();
            var eng = new Engine({dir:dir,chrjs:createTestStore()});
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
            var   eng = new Engine({dir:dir,chrjs:createTestStore()});
            var    hs = [];
            var done2 = _.after(2,done);
            eng.init();
            eng.start();
            eng.stop();
            eng.start();
            eng.stop();
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
    describe("#loadData",function() {
        it("loads single item from a json file",function(done) {
            var   dir = temp.mkdirSync();
            var chrjs = createTestStore();
            var   eng = new Engine({dir:dir,chrjs:chrjs});
            var  data = [['abc',{a:1}]];
            var   dfn = path.join(dir,'data.json');
            fs.writeFileSync(dfn,JSON.stringify(data));
            eng.init();
            eng.start();
            assert.deepEqual(_.values(chrjs._private.facts),[]);
            eng.loadData(dfn,function(err) {
                assert(!err);
                assert.deepEqual(_.values(chrjs._private.facts),data);
                done();
            });
        });
        it("loads two items from a json file",function(done) {
            var   dir = temp.mkdirSync();
            var chrjs = createTestStore();
            var   eng = new Engine({dir:dir,chrjs:chrjs});
            var  data = [['abc',{a:1}],['def',{d:4}]];
            var   dfn = path.join(dir,'data.json');
            fs.writeFileSync(dfn,JSON.stringify(data));
            eng.init();
            eng.start();
            assert.deepEqual(_.values(chrjs._private.facts),[]);
            eng.loadData(dfn,function(err) {
                assert(!err);
                assert.deepEqual(_.values(chrjs._private.facts),data);
                done();
            });
        });
    });
});

