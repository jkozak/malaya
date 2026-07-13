"use strict";

const   engine = require('../../engine.js');
const   plugin = require('../../plugin.js');

const     http = require('http');
const       fs = require('fs');
const     path = require('path');
const     temp = require('temp').track();
const   assert = require('assert').strict;

describe("fetch plugin",function(){
    const   dir = temp.mkdirSync();
    let     eng;
    let  server;
    let    port;
    this.bail(true);
    before(done=>{
        server = http.createServer((req,res)=>{
            res.writeHead(200,{'content-type':'application/json'});
            res.end(JSON.stringify({hello:'world'}));
        });
        server.listen(0,'127.0.0.1',()=>{port=server.address().port;done();});
    });
    after(done=>eng.stop(true,done));
    after(done=>server.close(done));
    after(()=>{plugin._private.reset();});
    it("creates and starts engine with plugin", function(done) {
        const src = path.join(dir,'test.malaya');
        fs.writeFileSync(src,`
module.exports = store {
     rule (-['go',{url},{...}],
           +['GET',{id:1,url},{dst:'fetch'}] );
     rule (-['response',{id,statusCode,body},{...}],
           +['got',{statusCode,body},{dst:'dummy'}] );
}
    .plugin('fetch')
    .plugin('dummy');
`);
        eng = new engine.Engine({dir,ports:{},businessLogic:src});
        eng.init();
        eng.start();
        eng.become('master',done);
    });
    it("fetches a URL and delivers the JSON response as a fact",function(done) {
        plugin.get('dummy').reader.once('data',js=>{
            assert.equal(js[0],'got');
            assert.equal(js[1].statusCode,200);
            assert.deepEqual(js[1].body,{hello:'world'});
            done();
        });
        plugin.get('dummy').writer.write(['go',{url:`http://127.0.0.1:${port}/`}]);
    });
});
