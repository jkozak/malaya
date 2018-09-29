"use strict";

const   engine = require('../engine.js');
const   Engine = engine.Engine;

const   assert = require("chai").assert;
const     temp = require('temp').track();
const       fs = require('fs');
const     path = require('path');
const     util = require('../util.js');
const   VError = require('verror');
const  request = require('request');

describe("web server",function() {
    const  dir = temp.mkdirSync();
    const wdir = path.join(dir,'www');
    const text = "What! Dead? and never called me Mother!";
    const file = "EastLynne.txt";
    const xdir = 'Ellen';
    let    eng;
    let   port;
    it("starts",function(done) {
        fs.mkdirSync(wdir);
        eng = new Engine({ports:           {http:0},
                          privateTestUrls: true,
                          dir:             dir});
        eng.init();
        eng.start();
        fs.writeFileSync(path.join(wdir,file),text);
        fs.mkdirSync(path.join(wdir,xdir));
        fs.writeFileSync(path.join(wdir,xdir,'Wood'),text);
        eng.on('listen',(type,port0)=>{
            port = port0;
            done();
        });
        eng.become('master');
    });
    it("serves static content",function(done){
        request(util.format('http://localhost:%d/%s',port,file),
                (err,resp,body) => {
                    if (err)
                        done(err);
                    else {
                        if (resp.statusCode!==200)
                            done(new VError("expected status 200, got %j",resp.statusCode));
                        else if (body===text)
                            done();
                        else
                            done(new VError("expected East Lynne, got: %j",body));
                    }
                } );
    });
    it("handles requests for non-existent files graciously",function(done){
        request(util.format('http://localhost:%d/%s',port,'there-is-no-file-called-this'),
                (err,resp,body) => {
                    if (err)
                        done(err);
                    else {
                        if (resp.statusCode!==404)
                            done(new VError("expected status 404, got %j",resp.statusCode));
                        else
                            done();
                    }
                } );
    });
    it("handles requests for missing directories graciously",function(done){
        request(util.format('http://localhost:%d/%s',port,'this-is-not-a-directory'),
                (err,resp,body) => {
                    if (err)
                        done(err);
                    else {
                        if (resp.statusCode!==404)
                            done(new VError("expected status 404, got %j",resp.statusCode));
                        else
                            done();
                    }
                } );
    });
    it("handles requests for existing directories graciously",function(done){
        request(util.format('http://localhost:%d/%s',port,xdir),
                (err,resp,body) => {
                    if (err)
                        done(err);
                    else {
                        if (resp.statusCode!==403)
                            done(new VError("expected status 403, got %j",resp.statusCode));
                        else
                            done();
                    }
                } );
    });
    it("transpiles chrjs",function(done){
        const filej = "test.chrjs";
        const chrjs = "module.exports = store {};";
        fs.writeFileSync(path.join(wdir,filej),chrjs);
        request(util.format('http://localhost:%d/%s',port,filej),
                (err,resp,body) => {
                    if (err)
                        done(err);
                    else {
                        const contentType = resp.headers['content-type'];
                        if (resp.statusCode!==200)
                            done(new VError("expected status 200, got %j %s",resp.statusCode,body));
                        else if (body===chrjs)
                            done(new VError("no transpilation!"));
                        else if (!contentType.startsWith('application/javascript'))
                            done(new VError("expected application/javascript, got %j",contentType));
                        else
                            done();
                    }
                } );
    });
    it("discretely spills the beans",function(done){
        request(`http://localhost:${port}/_private/facts`,
                (err,resp,body) => {
                    if (err)
                        done(err);
                    else if (resp.statusCode!==200)
                        done(new VError("expected status 200, got %j",resp.statusCode));
                    else {
                        assert.deepEqual(util.deserialise(body),
                                         eng.chrjs._private.orderedFacts);
                        done();
                    }
                } );

    });
    it("discretely queries the beans",function(done){
        request(`http://localhost:${port}/_private/facts?q=[*][0]`,
                (err,resp,body) => {
                    if (err)
                        done(err);
                    else if (resp.statusCode!==200)
                        done(new VError("expected status 200, got %j",resp.statusCode));
                    else {
                        assert.deepEqual(util.deserialise(body),
                                         eng.chrjs._private.orderedFacts.map(x=>x[0]));
                        done();
                    }
                } );

    });
    it("stops",function(done){
        eng.become('idle');
        eng.stop(true,done);
    });
});
// +++ tests for require/bundle +++
