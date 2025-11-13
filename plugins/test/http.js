"use strict";

const   engine = require('../../engine.js');
const   plugin = require('../../plugin.js');

const       fs = require('fs');
const     path = require('path');
const     temp = require('temp').track();
const   assert = require('assert').strict;
const  request = require('superagent');

describe("http plugin",function(){
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
    rule (-['request',{id,method:'GET',url:'/NotFound',...},{src:'http'}],
          +['response',{id,statusCode:404},{dst:'http'}] );
    rule (-['request',{id,method:'GET',url:'/SomeCrap',...},{src:'http'}],
          +['response',{id,statusCode:200,body:'"SomeCrap"',headers:{'Content-Type':'application/json'}},{dst:'http'}] );
    rule (-['request',{id,method:'POST',url:'/MoreCrap',body,...},{src:'http'}],
          +['response',{id,statusCode:200,body,headers:{'Content-Type':'application/json'}},{dst:'http'}] );
    rule (-['request',{id,method:'GET',url:'/StillCrap',cookies:{crap:"yesItIs"},...},{src:'http'}],
          +['response',{id,statusCode:200},{dst:'http'}] );
    rule (-['request',{id,method:'GET',url:'/PureJoy',...},{src:'http'}],
           ['file',{name:'PureJoy.txt',hash}],
          +['response',{id,statusCode:200,body:{hash},headers:{'Content-Type':'application/json'}},{dst:'http'}] );
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
            .get(`http://127.0.0.1:${pl.port}/NotFound`)
            .end((err,res)=>{
                assert(err);
                assert.equal(err.status,404);
                done();
            });
    });
    it("serves actual data via a GET request",function(done) {
        request
            .get(`http://127.0.0.1:${pl.port}/SomeCrap`)
            .end((err,res)=>{
                if (!err) {
                    assert.equal(res.status,200);
                    assert.equal(res.body,'SomeCrap');
                }
                done(err);
            });
    });
    it("turns round body via a POST request",function(done) {
        request
            .post(`http://127.0.0.1:${pl.port}/MoreCrap`)
            .send('"MoreCrap"')
            .end((err,res)=>{
                if (!err) {
                    assert.equal(res.status,200);
                    assert.equal(res.body,'MoreCrap');
                }
                done(err);
            });
    });
    it("handles a cookie via a GET request",function(done) {
        request
            .get(`http://127.0.0.1:${pl.port}/StillCrap`)
            .set('Cookie','crap=yesItIs')
            .end((err,res)=>{
                if (!err) {
                    assert.equal(res.status,200);
                }
                done(err);
            });
    });
    it("serves actual data from the hash store via a GET request",function(done) {
        const s = JSON.stringify("testing is just bliss");
        const h = eng.hashes.putSync(s);
        eng.chrjs.add(['file',{name:'PureJoy.txt',hash:h}]);
        request
            .get(`http://127.0.0.1:${pl.port}/PureJoy`)
            .end((err,res)=>{
                if (!err) {
                    assert.equal(res.status,200);
                    assert.equal(JSON.stringify(res.body),s);
                }
                done(err);
            });
    });
});
