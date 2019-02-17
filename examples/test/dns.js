"use strict";

// dns.malaya has side effects, so we require it in a controlled
// environment below, not here

const plugin = require('../../plugin.js');

const assert = require('assert').strict;

describe("dns example",function() {
    let dns;

    before(()=>{dns=require('../dns.malaya');});
    after(()=>plugin._private.reset());

    describe("DNS labels",function() {
        it("packs simplest label", function() {
            const buf = Buffer.alloc(3);
            const off = dns._private.packDNSname(buf,0,['a']);
            assert.equal(off,3);
            assert.equal(buf.readUInt8(0),1);            // one char in first segment
            assert.equal(buf.slice(1,2).toString(),"a");
            assert.equal(buf.readUInt8(2),0);
        });
        it("unpacks simplest label", function() {
            const      buf = Buffer.from([1,'a'.charCodeAt(0),0]);
            const [js,off] = dns._private.unpackDNSname(buf,0);
            assert.equal(off,3);
            assert.deepEqual(js,['a']);
        });
        it("packs simplest label with offset", function() {
            const buf = Buffer.alloc(4);
            const off = dns._private.packDNSname(buf,1,['a']);
            assert.equal(off,4);
            assert.equal(buf.readUInt8(1),1);            // one char in first segment
            assert.equal(buf.slice(2,3).toString(),"a");
            assert.equal(buf.readUInt8(3),0);
        });
        it("unpacks simplest label with offset", function() {
            const      buf = Buffer.from([0,1,'a'.charCodeAt(0),0]);
            const [js,off] = dns._private.unpackDNSname(buf,1);
            assert.equal(off,4);
            assert.deepEqual(js,['a']);
        });
    });
});
