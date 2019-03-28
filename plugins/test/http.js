"use strict";

const   engine = require('../../engine.js');
const   plugin = require('../../plugin.js');

const       fs = require('fs');
const     path = require('path');
const     temp = require('temp').track();
const   assert = require('assert').strict;
const  request = require('superagent');

describe("http plugin XXX",function(){
    const   dir = temp.mkdirSync();
    const   dat = {data:123};
    let     eng;
    let      pl;
    this.bail(true);
    after(done=>eng.stop(true,done));
    after(()=>{plugin._private.reset();});
    it("creates and starts engine with plugin", function(done) {
        const src = path.join(dir,'test.malaya');
        fs.writeFileSync(path.join(dir,'SomeFile'),JSON.stringify(dat));
        fs.writeFileSync(src,`
module.exports = store {
    rule (-['request',{id,method:'GET',url:'/NotFound',...},{src:'http'}],
          +['response',{id,statusCode:404},{dst:'http'}] );
    rule (-['request',{id,method:'GET',url:'/SomeCrap',...},{src:'http'}],
          +['response',{id,statusCode:200,body:'"SomeCrap"',headers:{'Content-Type':'application/json'}},{dst:'http'}] );
    rule (-['request',{id,method:'GET',url:'/SomeFile',...},{src:'http'}],
          +['response',{id,statusCode:200,sendfile:'SomeFile',headers:{'Content-Type':'application/json'}},{dst:'http'}] );
}
    .plugin('http',{port:0});
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
        pl = plugin.get('http');
        assert(pl);
    });
    it("has allocated a port to the plugin", function() {
        assert(pl.port);
    });
    it("serves a 404 GET request",function(done) {
        request
            .get(`http://localhost:${pl.port}/NotFound`)
            .end((err,res)=>{
                assert(err);
                assert.equal(err.status,404);
                done();
            });
    });
    it("serves actual data via a GET request",function(done) {
        request
            .get(`http://localhost:${pl.port}/SomeCrap`)
            .end((err,res)=>{
                if (!err) {
                    assert.equal(res.status,200);
                    assert.equal(res.body,'SomeCrap');
                }
                done(err);
            });
    });
    it("serves actual file data via a GET request",function(done) {
        request
            .get(`http://localhost:${pl.port}/SomeFile`)
            .end((err,res)=>{
                if (!err) {
                    assert.equal(res.status,200);
                    assert.deepEqual(res.body,dat);
                }
                done(err);
            });
    });
});
