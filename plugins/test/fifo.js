"use strict";

const   engine = require('../../engine.js');
const   plugin = require('../../plugin.js');

const       fs = require('fs');
const     path = require('path');
const     temp = require('temp').track();
const   assert = require('assert').strict;

describe("fifo plugin",function(){
    const   dir = temp.mkdirSync();
    let     eng;
    let      pl;
    const  fifo = path.join(dir,"test.fifo");
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
    .plugin('fifo',{path:'${fifo}'})
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
        pl = plugin.get('fifo');
        assert(pl);
    });
    it("has created the fifo", function() {
        const st = fs.statSync(fifo);
        assert(st.isFIFO());
    });
    it("receives msg from fifo", function(done) {
        plugin.get('dummy').reader.once('data',js=>{
            assert.deepEqual(js,['rcve',{data:['msg',{data:'yes'},'fifo']},{}]);
            done();
        });
        fs.writeFileSync(fifo,
                         JSON.stringify(['msg',{data:'yes'}])+'\n',
                         {
                             encoding:'utf8',
                             flag:    'a'
                         });
    });
    it("receives another msg from fifo", function(done) {
        plugin.get('dummy').reader.once('data',js=>{
            assert.deepEqual(js,['rcve',{data:['msg',{data:'no'},'fifo']},{}]);
            done();
        });
        fs.writeFileSync(fifo,
                         JSON.stringify(['msg',{data:'no'}])+'\n',
                         {
                             encoding:'utf8',
                             flag:    'a'
                         });
    });
});
