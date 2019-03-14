"use strict";

const     hash = require('../../hash.js');
const     util = require('../../util.js');
const   engine = require('../../engine.js');
const   plugin = require('../../plugin.js');

const       fs = require('fs');
const     path = require('path');
const     temp = require('temp').track();
const   assert = require('assert').strict;

describe("hash plugin",function(){
    const   dir = temp.mkdirSync();
    let     eng;
    let      pl;
    const  text = "another fine mess";
    const htext = hash(util.hashAlgorithm).hash(text);
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
    .plugin('hash')
    .plugin('dummy');
`);
        eng = new engine.Engine({
            dir,
            ports:         {},
            debug:         true,
            businessLogic: src
        });
        eng.init();
        eng.start();
        eng.become('master',done);
    });
    it("has created the plugin",function() {
        pl = plugin.get('hash');
        assert(pl);
    });
    it("puts a value into the store", function(done) {
        plugin.get('dummy').reader.once('data',js=>{
            assert.deepEqual(js,['rcve',{data:['put',{hash:htext,value:text},'hash']},{}]);
            done();
        });
        eng.update(['put',{value:text},{dst:'hash'}]);
    });
    it("reads a value back from the store", function(done) {
        plugin.get('dummy').reader.once('data',js=>{
            assert.deepEqual(js,['rcve',{data:['get',{hash:htext,value:text},'hash']},{}]);
            done();
        });
        eng.update(['get',{hash:htext},{dst:'hash'}]);
    });
});
