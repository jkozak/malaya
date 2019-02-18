"use strict";

const   engine = require('../../engine.js');
const   plugin = require('../../plugin.js');

const       fs = require('fs');
const      net = require('net');
const     path = require('path');
const     temp = require('temp').track();
const   assert = require('assert').strict;

describe("tcp plugin",function(){
    const   dir = temp.mkdirSync();
    let     eng;
    let      pl;
    let  client;
    this.bail(true);
    after(done=>{
        eng.become('idle');
        eng.stop(true,done);
    });
    after(()=>{plugin._private.reset();});
    it("creates and starts engine with plugin", function(done) {
        const src = path.join(dir,'test.malaya');
        fs.writeFileSync(src,`
module.exports = store {
     rule (-['ping',{...data},{src}],
           +['pong',{...data},{dst:src}] );
     rule (-[x,a,{src}],
           +['rcve',{data:[x,a,src]},{dst:'dummy'}] );
}
    .plugin('tcp',{port:0})
    .plugin('dummy');
`);
        eng = new engine.Engine({
            dir,
            magic:         [],
            ports:         {},
            debug:         true,
            businessLogic: src
        });
        eng.init();
        eng.start();
        eng.become('master',done);
    });
    it("has created the plugin",function() {
        pl = plugin.get('tcp');
        assert(pl);
    });
    it("has a port",function() {
        assert.equal(typeof pl.port,'number');
    });
    it("makes a connection",function(done) {
        plugin.get('dummy').reader.once('data',js=>{
            assert.equal(js[0],'rcve');
            if (js[1].data[0]==='connect')
                done();
        });
        client = net.createConnection({port:pl.port});
    });
    it("receives and replies to a message",function(done) {
        client.on('data',msg=>{
            done();
        });
        client.write(JSON.stringify(['ping',{test:555}])+'\n');
    });
    it("closes a connection",function(done) {
        plugin.get('dummy').reader.once('data',js=>{
            assert.equal(js[0],'rcve');
            if (js[1].data[0]==='disconnect')
                done();
        });
        client.end();
    });
});
