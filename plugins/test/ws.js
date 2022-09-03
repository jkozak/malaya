"use strict";

const    engine = require('../../engine.js');
const    plugin = require('../../plugin.js');

const        fs = require('fs');
const      path = require('path');
const      temp = require('temp').track();
const    assert = require('assert').strict;

const WebSocket = require('ws');

describe("ws plugin",function(){
    const   dir = temp.mkdirSync();
    let     eng;
    let      pl;
    let  client;
    this.bail(true);
    after(done=>eng.stop(true,done));
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
    .plugin('http',{port:0})
    .plugin('ws',{server:'http'})
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
        pl = plugin.get('ws');
        assert(pl);
    });
    it("is not associated with a port",function() {
        assert(!pl.port);
    });
    it("has found its server",function() {
        assert(pl.server);                            // the plugin
        assert(pl.server.server);                     // the http server
        assert.equal(typeof pl.server.port,'number'); // we know its port
    });
    it("makes a connection",function(done) {
        plugin.get('dummy').reader.once('data',js=>{
            assert.equal(js[0],'rcve');
            if (js[1].data[0]==='connect')
                done();
        });
        client = new WebSocket(`http://127.0.0.1:${pl.server.port}/`);
    });
    it("receives and replies to a message",function(done) {
        client.on('message',msg=>{
            done();
        });
        client.send(JSON.stringify(['ping',{test:555}]));
    });
    it("closes a connection",function(done) {
        plugin.get('dummy').reader.once('data',js=>{
            assert.equal(js[0],'rcve');
            if (js[1].data[0]==='disconnect')
                done();
        });
        client.close();
    });
});
