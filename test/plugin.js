"use strict";

const   plugin = require('../plugin.js');

const   engine = require('../engine.js');
const  whiskey = require('../whiskey.js');

const        _ = require('underscore');
const       fs = require('fs');
const     temp = require('temp').track();
const     path = require('path');
const    sinon = require('sinon');
const   assert = require('assert').strict;
const   stream = require('stream');


const jsOut = {op:'munge',data:[3,4,5]};

describe("old style (v0.7) plugins",function(){
    this.bail(true);
    let      n = 0;
    let    eng;
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("provides special out destination",function(done) {
        const  eps = {};
        eps.out = (js)=>{
            assert.deepEqual(js,jsOut);
            n++;
            done();
        };
        eng = new engine.Engine({dir:           temp.mkdirSync(),
                                 ports:         {},
                                 businessLogic: path.join(__dirname,'bl','null.chrjs') });
        eng.addPlugin('twiddle',eps);
        eng.init();
        eng.start();
        eng.out('twiddle',jsOut);
    });
    it("installed an update function",function(){
        assert.strictEqual(typeof plugin.get('twiddle').update,'function');
    });
    it("passed output to plugin",function(){
        assert.strictEqual(n,1);
    });
});

describe("plugin start/stop with no plugins",function(){
    before(()=>{plugin._private.forgetAll();});
    after(()=>{plugin._private.reset();});
    it("starts",function(done) {
        plugin.start(done);
    });
    it("stops",function(done) {
        plugin.stop(done);
    });
    it("starts again",function(done) {
        plugin.start(done);
    });
    it("stops again",function(done) {
        plugin.stop(done);
    });
    it("starts and stops",function(done) {
        plugin.start(err=>{
            if (err)
                done(err);
            else
                plugin.stop(done);
        });
    });
});

describe("plugin start/stop with standard plugins",function(){
    before(()=>{plugin._private.reset();});
    after(()=>{plugin._private.reset();});
    it("starts",function(done) {
        plugin.start(done);
    });
    it("stops",function(done) {
        plugin.stop(done);
    });
    it("starts again",function(done) {
        plugin.start(done);
    });
    it("stops again",function(done) {
        plugin.stop(done);
    });
    it("starts and stops",function(done) {
        plugin.start(err=>{
            if (err)
                done(err);
            else
                plugin.stop(done);
        });
    });
});


describe("dolce stil novista",function(){
    this.bail(true);
    let   n = 0;
    let eng;
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("provides special out destination",function(done) {
        plugin.add('twiddle',class extends plugin.Plugin {
            out(js,name,addr) {
                assert.deepEqual(js,  jsOut);
                assert.deepEqual(addr,'');
                n++;
                done();
            }
        });
        plugin.instantiate('twiddle');
        eng = new engine.Engine({dir:           temp.mkdirSync(),
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(__dirname,'bl','null.chrjs') });
        eng.init();
        eng.start();
        eng.out('twiddle',jsOut);
    });
    it("installed an update function",function(){
        assert.strictEqual(typeof plugin.get('twiddle').update,'function');
    });
    it("passed output to plugin",function(){
        assert.strictEqual(n,1);
    });
});

describe("multiple instance of plugin",function(){
    this.bail(true);
    const outs = {twiddle:0,twiddle1:0};
    let    eng;
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("provides special out destinations",function(done) {
        const done1 = _.after(2,done);
        plugin.add('twiddle',class extends plugin.Plugin {
            out(js,name,addr) {
                assert.deepEqual(js,  jsOut);
                assert.deepEqual(addr,'');
                outs[name]++;
                done1();
            }
        });
        plugin.instantiate('twiddle');
        plugin.instantiate('twiddle',{name:'twiddle1'});
        eng = new engine.Engine({dir:           temp.mkdirSync(),
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(__dirname,'bl','null.chrjs') });
        eng.init();
        eng.start();
        eng.out('twiddle', jsOut);
        eng.out('twiddle1',jsOut);
    });
    it("installed an update function",function(){
        assert.strictEqual(typeof plugin.get('twiddle') .update,'function');
        assert.strictEqual(typeof plugin.get('twiddle1').update,'function');
    });
    it("passed outputs to correct plugins",function(){
        assert.strictEqual(outs.twiddle, 1);
        assert.strictEqual(outs.twiddle1,1);
    });
});

describe("subaddressing :-style",function(){
    this.bail(true);
    let   n = 0;
    let eng;
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("provides special out destination",function(done) {
        plugin.add('twoddle',class extends plugin.Plugin {
            out(js,name,addr) {
                assert.deepEqual(js,  jsOut);
                assert.deepEqual(name,'twoddle');
                assert.deepEqual(addr,'1854:aq');
                n++;
                done();
            }
        });
        plugin.instantiate('twoddle');
        eng = new engine.Engine({dir:           temp.mkdirSync(),
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(__dirname,'bl','null.chrjs') });
        eng.init();
        eng.start();
        eng.out('twoddle:1854:aq',jsOut);
    });
    it("installed an update function",function(){
        assert.strictEqual(typeof plugin.get('twoddle').update,'function');
    });
    it("passed output to plugin",function(){
        assert.strictEqual(n,1);
    });
});

describe("subaddressing array style",function(){
    this.bail(true);
    let   n = 0;
    let eng;
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("provides special out destination",function(done) {
        plugin.add('twoddle',class extends plugin.Plugin {
            out(js,name,addr) {
                assert.deepEqual(js,  jsOut);
                assert.deepEqual(name,'twoddle');
                assert.deepEqual(addr,['1854','aq']);
                n++;
                done();
            }
        });
        plugin.instantiate('twoddle');
        eng = new engine.Engine({dir:           temp.mkdirSync(),
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(__dirname,'bl','null.chrjs') });
        eng.init();
        eng.start();
        eng.out(['twoddle','1854','aq'],jsOut);
    });
    it("installed an update function",function(){
        assert.strictEqual(typeof plugin.get('twoddle').update,'function');
    });
    it("passed output to plugin",function(){
        assert.strictEqual(n,1);
    });
});

describe("StreamPlugin",function() {
    this.bail(true);
    let   eng;
    let    pl;
    const dir = temp.mkdirSync();
    const src = path.join(dir,"pingpong.malaya");
    before(()=>fs.writeFileSync(src,`
module.exports = store {
    rule (-['ping',{...rest},{src}],
          +['pong',{...rest},{dst:src}] );
    rule (-['pang',{...rest},{src}],
          +['peng',{...rest},{dst:'NoneSuch'}] );
}
    .plugin('twuddle');
`));
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("creates engine with test plugin",function(done) {
        plugin.add('twuddle',class extends plugin.StreamPlugin {
        });
        eng = new engine.Engine({dir:           path.join(dir),
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: src });
        eng.init();
        eng.start();
        eng.become('master');
        assert.equal(plugin._private.plugins.length,1);
        done();
    });
    it("finds plugin",function(){
        assert.equal(plugin._private.plugins.length,1);
        pl = plugin.get('twuddle');
        assert(pl);
    });
    it("sends message", function() {
        pl.writer.write(['ping',{test:777}]);
    });
    it("not lodged in store", function() {
        assert.deepEqual(eng.chrjs._private.orderedFacts,[]);
    });
    it("receives reply", function(done) {
        pl.reader.once('data',data=>{
            assert.deepEqual(data,['pong',{test:777},{}]);
            done();
        });
    });
    it("sends and receives another reply", function(done) {
        pl.reader.once('data',data=>{
            assert.deepEqual(data,['pong',{test:888},{}]);
            done();
        });
        pl.writer.write(['ping',{test:888}]);
    });
    it("not lodged in store", function() {
        assert.deepEqual(eng.chrjs._private.orderedFacts,[]);
    });
    it("sends a pang message", function() {
        pl.writer.write(['pang',{test:999}]);
    });
    it("NoneSuch plugin msg lodged in store", function() {
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['peng',{test:999},{dst:'NoneSuch'}]]);
    });
});

describe("instantiateReadStream",function() {
    let rs;
    it("creates chained readable stream",function() {
        rs = plugin.instantiateReadStream([whiskey.StringifyJSONStream,
                                           class extends stream.Transform {
                                               constructor() {
                                                   super({objectMode:true});
                                               }
                                               _transform(chunk,enc,cb) {
                                                   chunk[1].test3 = 222;
                                                   this.push(chunk);
                                               }
                                           }
                                           ]);
    });
    it("writes to far end of chain",function() {
        rs.write(['test',{}]);
    });
    it("reads from near end",function(done) {
        rs.on('data',data=>{
            assert.equal(data,`["test",{"test3":222}]\n`);
            done();
        });
    });
});

describe("instantiateWriteStream with chained classes", function() {
    this.bail(true);
    let   eng;
    let    pl;
    let    ws;
    const dir = temp.mkdirSync();
    const src = path.join(dir,"test.malaya");
    before(()=>fs.writeFileSync(src,`
module.exports = store {
}
    .plugin('tweddle');
`));
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("creates engine with test plugin",function(done) {
        plugin.add('tweddle',class extends plugin.StreamPlugin {
        });
        eng = new engine.Engine({dir:           path.join(dir),
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: src });
        eng.init();
        eng.start();
        eng.become('master',done);
        assert.equal(plugin._private.plugins.length,1);
    });
    it("finds plugin",function(){
        assert.equal(plugin._private.plugins.length,1);
        pl = plugin.get('tweddle');
        assert(pl);
    });
    it("creates chained writable stream",function() {
        ws = plugin.instantiateWriteStream([whiskey.JSONParseStream,
                                            class extends stream.Transform {
                                                constructor() {
                                                    super({objectMode:true});
                                                }
                                                _transform(chunk,enc,cb) {
                                                    chunk[1].test2 = 111;
                                                    this.push(chunk);
                                                }
                                            } ]);
    });
    it("wires chained stream to plugin input",function() {
        ws.pipe(pl.writer);
    });
    it("chained stream sends data",function() {
        ws.write(`["test",{}]\n`);
    });
    it("data lodged in store",function() {
        assert.deepEqual(eng.chrjs._private.orderedFacts,
                         [['test',{test2:111},{src:'tweddle'}]] );
    });
});


// +++ update

// +++ addSubcommand

// +++ subcommands

describe("restart plugin added dynamically",function(){
    this.bail(true);
    let eng;
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("instantiates plugin",function() {
        plugin.instantiate('restart');
    });
    it("starts engine",function(done){
        eng = new engine.Engine({dir:           temp.mkdirSync(),
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(__dirname,'bl','null.chrjs') });
        eng.init();
        plugin.get('restart').connect(eng.chrjs);
        eng.start();
        eng.once('mode',mode=>{
            if (mode==='master')
                done();
        });
        eng.become('master');
    });
    it("restart has been sent",function(){
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['restart',{},{src:'restart'}]]);
    });
});

describe("restart",function(){
    this.bail(true);
    let eng;
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("loads source file",function(done){
        eng = new engine.Engine({dir:           temp.mkdirSync(),
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(__dirname,'bl','restart.malaya') });
        eng.init();
        eng.start();
        eng.once('mode',mode=>{
            if (mode==='master')
                done();
        });
        eng.become('master');
    });
    it("restart has been sent",function(){
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['restart',{},{src:'restart'}]]);
    });
});

describe("timer with default interval",function(){
    this.bail(true);
    let eng;
    let clock;
    before(()=>{clock=sinon.useFakeTimers();});
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    after(()=>{clock.restore();});
    it("loads source file",function(done){
        eng = new engine.Engine({dir:           temp.mkdirSync(),
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(__dirname,'bl','timer.malaya') });
        eng.init();
        eng.start();
        eng.once('mode',mode=>{
            if (mode==='master')
                done();
        });
        eng.become('master');
    });
    it("nothing sent yet",function(){
        assert.deepEqual(eng.chrjs._private.orderedFacts,[]);
    });
    it("waits no time at all", function() {
        clock.tick(0);
    });
    it("nothing sent yet",function(){
        assert.deepEqual(eng.chrjs._private.orderedFacts,[]);
    });
    it("waits not quite a second", function() {
        clock.tick(999);
    });
    it("nothing sent yet",function(){
        assert.deepEqual(eng.chrjs._private.orderedFacts,[]);
    });
    it("waits just a second", function() {
        clock.tick(1);
    });
    it("one tick sent", function() {
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['tick',{t:1000},{src:'timer'}]]);
    });
    it("waits another second", function() {
        clock.tick(1000);
    });
    it("two ticks sent", function() {
        assert.deepEqual(eng.chrjs._private.orderedFacts,[
            ['tick',{t:1000},{src:'timer'}],
            ['tick',{t:2000},{src:'timer'}] ]);
    });
});

describe("timer explicit interval",function(){
    this.bail(true);
    let eng;
    let clock;
    before(()=>{clock=sinon.useFakeTimers();});
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    after(()=>{clock.restore();});
    it("loads source file",function(done){
        eng = new engine.Engine({dir:           temp.mkdirSync(),
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(__dirname,'bl','timer10.malaya') });
        eng.init();
        eng.start();
        eng.once('mode',mode=>{
            if (mode==='master')
                done();
        });
        eng.become('master');
    });
    it("nothing sent yet",function(){
        assert.deepEqual(eng.chrjs._private.orderedFacts,[]);
    });
    it("waits no time at all", function() {
        clock.tick(0);
        assert.deepEqual(eng.chrjs._private.orderedFacts,[]);
    });
    it("nothing sent yet",function(){
        assert.deepEqual(eng.chrjs._private.orderedFacts,[]);
    });
    it("waits not quite a second", function() {
        clock.tick(9999);
    });
    it("nothing sent yet",function(){
        assert.deepEqual(eng.chrjs._private.orderedFacts,[]);
    });
    it("waits just a second", function() {
        clock.tick(1);
    });
    it("one tick sent", function() {
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['tick',{t:10000},{src:'timer'}]]);
    });
    it("waits another second", function() {
        clock.tick(10000);
    });
    it("two ticks sent", function() {
        assert.deepEqual(eng.chrjs._private.orderedFacts,[
            ['tick',{t:10000},{src:'timer'}],
            ['tick',{t:20000},{src:'timer'}] ]);
    });
});

describe("restart and timer in concert",function(){
    this.bail(true);
    let eng;
    let clock;
    before(()=>{clock=sinon.useFakeTimers();});
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    after(()=>{clock.restore();});
    it("loads source file",function(done){
        eng = new engine.Engine({dir:           temp.mkdirSync(),
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(__dirname,'bl','restart_timer.malaya') });
        eng.init();
        eng.start();
        eng.once('mode',mode=>{
            if (mode==='master')
                done();
        });
        eng.become('master');
    });
    it("restart has been sent",function(){
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['restart',{},{src:'restart'}]]);
    });
    it("waits no time at all", function() {
        clock.tick(0);
    });
    it("only restart sent",function(){
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['restart',{},{src:'restart'}]]);
    });
    it("waits not quite a second", function() {
        clock.tick(999);
    });
    it("still only restart sent",function(){
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['restart',{},{src:'restart'}]]);
    });
    it("waits just a second", function() {
        clock.tick(1);
    });
    it("restart and one tick sent", function() {
        assert.deepEqual(eng.chrjs._private.orderedFacts,[
            ['restart',{},{src:'restart'}],
            ['tick',{t:1000},{src:'timer'}]
        ]);
    });
});

describe("fs readFile",function() {
    this.bail(true);
    let   eng;
    const dir = temp.mkdirSync();
    const xxx = path.join(dir,'xxx');
    before(()=>{
        fs.writeFileSync(xxx,'xxx');
        fs.writeFileSync(path.join(dir,'test.malaya'),`
module.exports = store {
    rule (-['go',{},{}],
           out('fs',['readFile',{filename:'${xxx}'}]) );

    rule ( ['readFile',{...},{src:'fs'}],
           out('callback',['done',{}]) );
}
    .plugin('fs')
    .plugin('callback');
`);
    });
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("loads source file",function(done){
        eng = new engine.Engine({dir,
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(dir,'test.malaya') });
        eng.init();
        eng.start();
        eng.become('master',done);
    });
    it("trigger activity",function(done) {
        eng.update(['go',{},{}]);
        plugin._private.callback = done;
    });
    it("file has been read",function() {
        const facts = eng.chrjs._private.orderedFacts;
        assert.equal(facts.length,1);
        assert.equal(facts[0][0],         'readFile');
        assert.equal(facts[0][1].filename,xxx);
        assert.equal(facts[0][1].contents,'xxx');
    });
});

describe("fs writeFile",function() {
    this.bail(true);
    let   eng;
    const dir = temp.mkdirSync();
    const xxx = path.join(dir,'xxx');
    before(()=>{
        fs.writeFileSync(path.join(dir,'test.malaya'),`
module.exports = store {
    rule (-['go',{},{}],
           out('fs',['writeFile',{filename:'${xxx}',contents:'xxx'}]) );

    rule ( ['writeFile',{...},{src:'fs'}],
           out('callback',['done',{}]) );
}
    .plugin('fs')
    .plugin('callback');
`);
    });
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("loads source file",function(done){
        eng = new engine.Engine({dir,
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(dir,'test.malaya') });
        eng.init();
        eng.start();
        eng.become('master',done);
    });
    it("trigger activity",function(done) {
        eng.update(['go',{},{}]);
        plugin._private.callback = done;
    });
    it("file has been written", function() {
        assert.equal(fs.readFileSync(xxx,'utf8'),'xxx');
    });
    it("write has been notified",function() {
        const facts = eng.chrjs._private.orderedFacts;
        assert.equal(facts.length,1);
        assert.equal(facts[0][0],         'writeFile');
        assert.equal(facts[0][1].filename,xxx);
    });
});


describe("file read",function(){
    this.bail(true);
    let   eng;
    const dir = temp.mkdirSync();
    before(()=>{
        fs.writeFileSync(path.join(dir,'test.malaya'),`
module.exports = store {}
    .plugin('file',{src:'${path.join(dir,'test.data')}'});
`,
                     {encoding:'utf8'} );
        fs.writeFileSync(path.join(dir,'test.data'),`
["test",{"id":1}]
["test",{"id":2}]
["test",{"id":3}]
`.trimLeft(),
                     {encoding:'utf8'} );
    });
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("loads source file",function(done){
        eng = new engine.Engine({dir,
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(dir,'test.malaya') });
        eng.init();
        eng.start();
        eng.on('mode',mode=>{
            if (mode==='master')
                done();
        });
        eng.become('master');
    });
    it("data has been seen",function(done){
        // +++ resolve hacky use of setImmediate [e494983e74a66ced] +++
        setImmediate(()=>{
            assert.deepEqual(eng.chrjs._private.orderedFacts,[
                ['test',{id:1},{src:'file'}],
                ['test',{id:2},{src:'file'}],
                ['test',{id:3},{src:'file'}]
            ]);
            done();
        });
    });
});

describe("file write",function(){
    this.bail(true);
    let   eng;
    const dir = temp.mkdirSync();
    before(()=>{
        fs.writeFileSync(path.join(dir,'test.malaya'),`
module.exports = store {
    rule (-['ping',{}],
          +['pong',{},{dst:'file'}] );
}
    .plugin('file',{dst:'${path.join(dir,'test.data')}'});
`,
                     {encoding:'utf8'} );
    });
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("loads source file",function(done){
        eng = new engine.Engine({dir,
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(dir,'test.malaya') });
        eng.init();
        eng.start();
        eng.on('mode',mode=>{
            if (mode==='master')
                done();
        });
        eng.become('master');
    });
    it("receives data", function(done) {
        eng.update(['ping',{}],done);
    });
    it("data has been written",function(done){
        // +++ resolve hacky use of setImmediate [e494983e74a66ced] +++
        setImmediate(()=>{
            const wd = fs.readFileSync(path.join(dir,'test.data'),'utf8');
            assert.deepEqual(JSON.parse(wd),['pong',{}]);
            done();
        });
    });
});
