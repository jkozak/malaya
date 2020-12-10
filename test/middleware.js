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

describe("middleware XXX",function() {
    const       testDir = temp.mkdirSync();
    const prevalenceDir = path.join(testDir,'prevalence');
    before(function(done){
        const eng = new engine.Engine({
            prevalenceDir
        });
        eng.init();
        done();
    });
    it("creates a minimal connect app",function(done){
        const app = connect();
        const srv = http.createServer(app);
        const eng = middleware.install(srv,'/WebSocket','test/bl/middleware.malaya',{
            prevalenceDir
        });
        eng.on('mode',mode=>{
            if (mode==='master') {
                srv.listen(0,()=>{
                    const ws = new WebSocket(`ws://127.0.0.1:${srv.address().port}/WebSocket?t=197`);
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
});
