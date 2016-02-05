"use strict";

const      testutil = require('../testutil.js');
const        assert = require('assert');

const makeTimestamp = testutil.makeTimestamp;

describe("testutil",function() {

    describe("runInCountEngine",function() {
        it("organises an engine with a chr store to which connections can be made",function(done) {
            testutil.runInCountEngine({
                main: function(eng) {
                    var io = testutil.createIO();
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
                var io = testutil.createIO();
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
            var ts1 = makeTimestamp();
            var ts2 = makeTimestamp();
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

});
