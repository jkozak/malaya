"use strict";

const   plugin = require('../plugin.js');

const        _ = require('underscore');
const   assert = require('assert').strict;
const   engine = require('../engine.js');
const     temp = require('temp').track();
const     path = require('path');


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
        eng.out('plugin:twiddle',jsOut);
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
        plugin.start({},done);
    });
    it("stops",function(done) {
        plugin.stop({},done);
    });
    it("starts again",function(done) {
        plugin.start({},done);
    });
    it("stops again",function(done) {
        plugin.stop({},done);
    });
    it("starts and stops",function(done) {
        plugin.start({},err=>{
            if (err)
                done(err);
            else
                plugin.stop({},done);
        });
    });
});

describe("plugin start/stop with standard plugins",function(){
    before(()=>{plugin._private.reset();});
    after(()=>{plugin._private.reset();});
    it("starts",function(done) {
        plugin.start({},done);
    });
    it("stops",function(done) {
        plugin.stop({},done);
    });
    it("starts again",function(done) {
        plugin.start({},done);
    });
    it("stops again",function(done) {
        plugin.stop({},done);
    });
    it("starts and stops",function(done) {
        plugin.start({},err=>{
            if (err)
                done(err);
            else
                plugin.stop({},done);
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
        eng.out('plugin:twiddle',jsOut);
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
        eng.out('plugin:twiddle', jsOut);
        eng.out('plugin:twiddle1',jsOut);
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

describe("subaddressing",function(){
    this.bail(true);
    let   n = 0;
    let eng;
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("provides special out destination",function(done) {
        plugin.add('twoddle',class extends plugin.Plugin {
            out(js,name,addr) {
                assert.deepEqual(js,  jsOut);
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
        eng.out('plugin:twoddle:1854:aq',jsOut);
    });
    it("installed an update function",function(){
        assert.strictEqual(typeof plugin.get('twoddle').update,'function');
    });
    it("passed output to plugin",function(){
        assert.strictEqual(n,1);
    });
});

// +++ update

// +++ addSubcommand

// +++ subcommands

describe("restart",function(){
    this.bail(true);
    let eng;
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("instantiates plugin",function() {
        plugin.instantiate('restart');
    });
    it("starts engine",function(){
        eng = new engine.Engine({dir:           temp.mkdirSync(),
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(__dirname,'bl','null.chrjs') });
        eng.init();
        plugin.get('restart').connect(eng.chrjs);
        eng.start();
        eng.become('master',()=>{});
    });
    it("restart has been sent",function(){
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['restart',{},{port:'plugin:restart'}]]);
    });
});

describe("specify restart plugin in source code",function(){
    this.bail(true);
    let eng;
    after(()=>{plugin._private.reset();});
    after(()=>(eng && eng.stop()));
    it("loads source file",function(){
        eng = new engine.Engine({dir:           temp.mkdirSync(),
                                 magic:         {},
                                 ports:         {},
                                 businessLogic: path.join(__dirname,'bl','restart.malaya') });
        eng.init();
        eng.start();
        eng.become('master',()=>{});
    });
    it("restart has been sent",function(){
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['restart',{},{port:'plugin:restart'}]]);
    });
});
