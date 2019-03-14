"use strict";

const      testutil = require('../testutil.js');

const        assert = require('assert').strict;
const          path = require('path');
const            fs = require('fs');

const makeTimestamp = testutil.makeTimestamp;

describe("testutil",function() {

    describe("runInCountEngine",function() {
        it("organises an engine with a chr store to which connections can be made",function(done) {
            testutil.runInCountEngine({
                main: function(eng) {
                    const io = testutil.createIO();
                    eng.addConnection('test://',io);
                    eng.chrjs.once('fire',function() {
                        assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:1}]]);
                        eng.stopPrevalence(true,done);
                    });
                    assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:0}]]);
                    io.i.write(['x',{}]);
                }
            });
        });
        it("works with a simpler syntax",function(done) {
            testutil.runInCountEngine(function(eng) {
                const io = testutil.createIO();
                eng.addConnection('test://',io);
                eng.chrjs.once('fire',function() {
                    assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:1}]]);
                    eng.stopPrevalence(true,done);
                });
                assert.deepEqual(eng.chrjs._private.orderedFacts,[['stats',{xCount:0}]]);
                io.i.write(['x',{}]);
            });
        });
    });

    describe("makeTimestamp",function() {
        it("generates multiple timestamp makers",function() {
            const ts1 = makeTimestamp();
            const ts2 = makeTimestamp();
            assert.strictEqual(ts1(),1);
            assert.strictEqual(ts1(),2);
            assert.strictEqual(ts2(),1);
            assert.strictEqual(ts2(),2);
            assert.strictEqual(ts1(),3);
            assert.strictEqual(ts1(),4);
            assert.strictEqual(ts2(),3);
            assert.strictEqual(ts2(),4);
        });
    });

    describe("ExtServer/WS",function(){
        this.bail(true);
        const srv = new testutil.ExtServer('malaya');
        it("is not alive initially",function(){
            assert.ok(!srv.isAlive());
        });
        it("inits a server",function(done){
            this.timeout(10000);
            srv.init(['test/bl/pingpong.malaya'],(err)=>{
                if (err)
                    done(err);
                else {
                    assert(fs.existsSync(srv.prevalenceDir));
                    assert(fs.existsSync(path.join(srv.prevalenceDir,'state')));
                    done();
                }
            });
        });
        it("is still not alive yet",function(){
            assert.ok(!srv.isAlive());
        });
        it("starts a server",function(done){
            this.timeout(10000);
            srv.run(['test/bl/pingpong.malaya'],err=>{
                if (err)
                    done(err);
                else {
                    assert.strictEqual(typeof srv.port,'number');
                    done();
                }
            });
        });
        it("is alive now",function(){
            assert.ok(srv.isAlive());
        });
        it("is tested with a monad via server object",function(done){
            new testutil.WS(srv)
                .opened()
                .call(facts=>assert.deepEqual(facts.map(f=>f[0]),
                                              ['restart'] ))
            // +++ make this work with ws plugin +++
                //.close()
                //.closed()
                //.call(facts=>assert.deepEqual(facts.map(f=>f[0]),
                //                              ['restart','_connect','_disconnect'] ))
                //.assert(facts=>facts.length===3)
                .end(done);
        });
        // +++ make this work with ws plugin +++
        // it("is tested with a monad via url",function(done){
        //     new testutil.WS(`http://localhost:${srv.port}/data`)
        //         .opened()
        //         .close()
        //         .closed()
        //         .end(done);
        // });
        // it("transmits and receives",function(done){
        //     new testutil.WS(srv)
        //         .opened()
        //         .xmit(['ping',{id:1}])
        //         .rcve(js=>assert.deepEqual(js,['pong',{id:1}]))
        //         .end(done);
        // });
        // it("transmits and receives multiple times",function(done){
        //     const seen = [];
        //     new testutil.WS(srv)
        //         .opened()
        //         .xmit(['ping',{id:1}])
        //         .xmit(['ping',{id:2}])
        //         .rcveWhile(js=>{
        //             seen.push(js[1].id);
        //             return seen.length<2;
        //         })
        //         .end(done);
        // });
        // it("ensures end is a one-off",function(){
        //     assert.throws(()=>{
        //         new testutil.WS(srv)
        //             .end()
        //             .end();
        //     });
        // });
        // it("yet allows civilised chaining",function(done){
        //     const ws = new testutil.WS(srv);

        //     ws.end(()=>ws.end(done));
        // });
        it("is still alive",function(){
            assert.ok(srv.isAlive());
        });
        it("closes down nicely",function(done){
            srv.proc.once('exit',()=>done());
            srv.kill();
        });
        it("is not alive again",function(){
            assert.ok(!srv.isAlive());
        });
    });

});
