"use strict";

const middleware = require('../middleware.js');

const     engine = require('../engine.js');
const       util = require('../util.js');


const  WebSocket = require('ws');
const    connect = require('connect');
const     assert = require('assert').strict;
const       http = require('http');
const       path = require('path');
const       temp = require('temp').track();
const         fs = require('fs');

describe("middleware",function() {
    const       testDir = temp.mkdirSync();
    const prevalenceDir = path.join(testDir,'prevalence');
    before(function(done){
        const eng = new engine.Engine({
            prevalenceDir
        });
        eng.init();
        done();
    });
    let eng,srv,ws;
    it("creates a minimal connect app",function(done){
        const app = connect();
        srv = http.createServer(app);
        eng = middleware.install(srv,'/WebSocket','test/bl/middleware.malaya',{
            prevalenceDir
        });
        eng.on('mode',mode=>{
            if (mode==='master') {
                srv.listen(0,()=>{
                    ws = new WebSocket(`ws://127.0.0.1:${srv.address().port}/WebSocket?t=197`);
                    ws.on('open',()=>{
                        ws.send(JSON.stringify(['ping',{two:2}]));
                    });
                    ws.on('error',err=>{
                        done(err);
                    });
                    ws.on('message',msg=>{
                        assert.equal(msg,'["pong",{"two":2}]');
                        done();
                    });
                });
            }
        });
    });
    describe("has written a malaya journal",function(){
        let journal;
        it("wrote it",function(){
            journal = fs.readFileSync(path.join(prevalenceDir,'state/journal'),'utf8')
                .split('\n')
                .filter(l=>l!=='')
                .map(util.deserialise);
        });
        it("first record is 'previous'",function(){
            assert.equal(journal[0][1],'previous');
        });
        it("second record is 'code'",function(){
            assert.equal(journal[1][1],'code');
        });
        it("third record is 'connect' 'update' with query",function(){
            assert.equal(journal[2][1],'update');
            assert.equal(journal[2][2][0],'connect');
            assert.equal(journal[2][2][1].query.t,'197');
        });
        it("fourth record is 'ping' 'update'",function(){
            assert.equal(journal[3][1],'update');
            assert.equal(journal[3][2][0],'ping');
        });
    });
    describe("another session, a short one",function() {
        it("can set a reason for close",function(done){
            const ws = new WebSocket(`ws://127.0.0.1:${srv.address().port}/WebSocket?t=198`);
            ws.on('open',()=>{
                ws.send(JSON.stringify(['bye',{code:4100,reason:"too tired"}]));
            });
            ws.on('error',err=>{
                done(err);
            });
            ws.on('close',(code,reason)=>{
                assert.equal(code,4100);
                assert.equal(reason,"too tired");
                done();
            });
        });
    });
    describe("handles garbage gracefully",function() {
        it("non JSON",function(done){
            const ws = new WebSocket(`ws://127.0.0.1:${srv.address().port}/WebSocket?t=200`);
            const nf = eng.chrjs.orderedFacts.length;
            ws.on('open',()=>{
                ws.send("garbage");
            });
            ws.on('error',err=>{
                done(err);
            });
            ws.on('close',(code,reason)=>{ 
                assert.equal(eng.chrjs.orderedFacts[nf][0],'connect');
                assert.equal(eng.chrjs.orderedFacts[nf+1][0],'error');
                assert.equal(eng.chrjs.orderedFacts[nf+1][1].err,"broken msg");
                assert.equal(eng.chrjs.orderedFacts[nf+2][0],'disconnect');
                assert.equal(code,middleware.WS_CLOSE.badJSON);
                assert.equal(reason,"received: garbage");
                done();
            });
        });
        it("non fact",function(done){
            const ws = new WebSocket(`ws://127.0.0.1:${srv.address().port}/WebSocket?t=201`);
            const nf = eng.chrjs.orderedFacts.length;
            ws.on('open',()=>{
                ws.send("0");
            });
            ws.on('error',err=>{
                done(err);
            });
            ws.on('close',(code,reason)=>{
                assert.equal(eng.chrjs.orderedFacts[nf][0],'connect');
                assert.equal(eng.chrjs.orderedFacts[nf+1][0],'error');
                assert.equal(eng.chrjs.orderedFacts[nf+1][1].err,"broken msg");
                assert.equal(eng.chrjs.orderedFacts[nf+2][0],'disconnect');
                assert.equal(code,middleware.WS_CLOSE.badFact);
                assert.equal(reason,"received: 0");
                done();
            });
        });
    });
    describe("ends",function(){
        it("first closing websocket",function(done){
            ws.on('close',()=>done());
            ws.close();
        });
        it("via http server shutdown",function(done){
            eng.on('saved',(s,w,j)=>{
                assert.equal(typeof s,'string');
                assert.equal(typeof w,'string');
                assert.equal(typeof j,'string');
                done();
            });
            srv.close();
        });
    });
    describe("prevalence store",function(){
        it("is nicely shut down",function(){
            const journal = fs.readFileSync(path.join(prevalenceDir,'state/journal'),'utf8')
                  .split('\n')
                  .filter(l=>l!=='')
                  .map(util.deserialise);
            assert.equal(journal.length,1);
        });
    });
});
