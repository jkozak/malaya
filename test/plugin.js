"use strict";

const   plugin = require('../plugin.js');

const   engine = require('../engine.js');

const        _ = require('underscore');
const     temp = require('temp').track();
const     path = require('path');
const    sinon = require('sinon');
const   assert = require('assert').strict;


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
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['restart',{},{port:'plugin:restart'}]]);
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
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['restart',{},{port:'plugin:restart'}]]);
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
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['tick',{t:1000},{port:'plugin:timer'}]]);
    });
    it("waits another second", function() {
        clock.tick(1000);
    });
    it("two ticks sent", function() {
        assert.deepEqual(eng.chrjs._private.orderedFacts,[
            ['tick',{t:1000},{port:'plugin:timer'}],
            ['tick',{t:2000},{port:'plugin:timer'}] ]);
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
        assert.deepEqual(eng.chrjs._private.orderedFacts,[['tick',{t:10000},{port:'plugin:timer'}]]);
    });
    it("waits another second", function() {
        clock.tick(10000);
    });
    it("two ticks sent", function() {
        assert.deepEqual(eng.chrjs._private.orderedFacts,[
            ['tick',{t:10000},{port:'plugin:timer'}],
            ['tick',{t:20000},{port:'plugin:timer'}] ]);
    });
});
