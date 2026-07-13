"use strict";

const   engine = require('../../engine.js');
const   plugin = require('../../plugin.js');

const    dgram = require('dgram');
const       fs = require('fs');
const     path = require('path');
const     temp = require('temp').track();
const   assert = require('assert').strict;

describe("udp plugin",function(){
    const   dir = temp.mkdirSync();
    let     eng;
    let      pl;
    this.bail(true);
    after(done=>eng.stop(true,done));
    after(()=>{plugin._private.reset();});
    it("creates and starts engine with plugin", function(done) {
        const src = path.join(dir,'test.malaya');
        fs.writeFileSync(src,`
module.exports = store {
     rule (-[x,a,{src}],
           +['rcve',{data:[x,a,src]},{dst:'dummy'}] );
}
    .plugin('udp',{port:0})
    .plugin('dummy');
`);
        eng = new engine.Engine({
            dir,
            ports:         {},
            businessLogic: src
        });
        eng.init();
        eng.start();
        eng.become('master',done);
    });
    it("has created the plugin",function() {
        pl = plugin.get('udp');
        assert(pl);
    });
    it("has a port",function() {
        assert.equal(typeof pl.port,'number');
    });
    it("receives a well-formed datagram",function(done) {
        plugin.get('dummy').reader.once('data',js=>{
            assert.equal(js[0],'rcve');
            assert.equal(js[1].data[0],'hello');
            done();
        });
        const c = dgram.createSocket('udp4');
        c.send(Buffer.from(JSON.stringify(['hello',{n:1}])),pl.port,'127.0.0.1',()=>c.close());
    });
    it("drops a malformed datagram and still serves valid ones",function(done) {
        plugin.get('dummy').reader.once('data',js=>{
            assert.equal(js[0],'rcve');
            assert.equal(js[1].data[0],'marker');
            done();
        });
        const c = dgram.createSocket('udp4');
        c.send(Buffer.from("this is not json"),pl.port,'127.0.0.1',()=>{
            c.send(Buffer.from(JSON.stringify(['marker',{ok:true}])),pl.port,'127.0.0.1',()=>c.close());
        });
    });
});
