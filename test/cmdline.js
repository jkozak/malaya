"use strict";

const cmdline = require("../cmdline.js");

const util    = require("../util.js");
const fs      = require("fs");
const temp    = require("temp").track();
const path    = require("path");
const assert  = require("assert");
const VError  = require("verror");
const child   = require('child_process');

const engine  = require('../engine.js');
const whiskey = require('../whiskey.js');

const fillDirWithSomeData = function(dir,data,cb) {
    const dfn = path.join(dir,'data.json');
    fs.writeFileSync(dfn,JSON.stringify(data));
    process.argv = [null,null,
                    "-p",path.join(dir,'.prevalence'),
                    "init",
                    '-d',dfn,
                    'bl.chrjs'];
    cmdline.run({callback:cb});
    return dir;
};

describe("utility functions for this test file",function() {
    describe('fillDirWithSomeData',function() {
        it("does what it says on the tin",function(done) {
            const dir = temp.mkdirSync();
            fillDirWithSomeData(dir,[['pp',{}],['qq',{}]],function(err0) {
                if (err0)
                    done(err0);
                else {
                    const eng = new engine.Engine({dir:dir});
                    eng.start();
                    eng.startPrevalence(function(err1) {
                        if (err1)
                            done(err1);
                        else {
                            let err = null;
                            try {
                                assert.strictEqual(eng.chrjs.size,2);
                            } catch (e) {err=e;}
                            eng.stopPrevalence(true,function(){done(err);});
                        }
                    });
                }
            });
        });
    });
});

describe("cmdline",function() {
    let saveArgv;
    before(function() {
        saveArgv = process.argv;
    });
    after(function() {
        process.argv = saveArgv;
    });
    describe("init",function() {
        it("builds the prevalence directory structure",function() {
            const dir = temp.mkdirSync();
            process.argv = [null,null,
                            "-p",path.join(dir,'.prevalence'),
                            "init",
                            'bl.chrjs'];
            cmdline.run();
            assert(fs.statSync(path.join(dir,'.prevalence')).isDirectory());
            assert(fs.statSync(path.join(dir,'.prevalence','state')).isDirectory());
            assert(fs.statSync(path.join(dir,'.prevalence','state','world')).isFile());
            assert(fs.statSync(path.join(dir,'.prevalence','state','journal')).isFile());
        });
    });
    describe("run",function() {
    });
    describe("slave",function() {
    });
    describe("transform",function() {
        const transform = function(data,sourcefn,check) { // a test driver for `transform`
            const dir = temp.mkdirSync();
            fillDirWithSomeData(dir,data,function(err) {
                process.argv = [null,null,
                                "-p",path.join(dir,'.prevalence'),
                                "transform",
                                path.join(__dirname,'tfm',sourcefn) ];
                cmdline.run({callback:function(err1) {
                    if (err1) throw err1;
                    const eng = new engine.Engine({dir:dir});
                    eng.start();
                    eng.startPrevalence(function(err2) {
                        assert(!err2);
                        check(eng);
                        eng.stopPrevalence(true);
                    });
                }});
            });
        };
        it("removes all facts by default",function(done) {
            transform([['a',{}]],
                      "null.chrjs",
                      function(eng) {
                          let err = null;
                          try {
                              assert.deepEqual(eng.chrjs._private.orderedFacts,[]);
                          } catch (e) {err=e;}
                          done(err);
                      });
        });
        it("keeps explicitly requested facts",function(done) {
            transform([['b',{}],['c',{}]],
                      "keep_b.chrjs",
                      function(eng) {
                          let err = null;
                          try {
                              assert.deepEqual(eng.chrjs._private.orderedFacts,
                                               [['b',{}]] );
                          } catch (e) {err=e;}
                          done(err);
                      });
        });
        it("has `_transform` for global operations",function(done) {
            transform([['b',{}],['c',{}]],
                      "global.chrjs",
                      function(eng) {
                          let err = null;
                          try {
                              assert.deepEqual(eng.chrjs._private.orderedFacts,
                                               [['theLot',{}]] );
                          } catch (e) {err=e;}
                          done(err);
                      });
        });
        it("makes entry in journal",function(done) {
            transform([['b',{}],['c',{}]],
                      "null.chrjs",
                      function(eng) {
                          eng.buildHistoryStream(function(err,history) {
                              if (err)
                                  done(err);
                              else {
                                  let n = 0;
                                  history.pipe(whiskey.LineStream(util.deserialise))
                                      .on('data',function(js) {
                                          if (js[1]==='transform')
                                              n++;
                                      })
                                      .on('end',function() {
                                          if (n!==1)
                                              done(new VError("found %d transforms in journal, expected 1",n));
                                          else
                                              done();
                                      });
                              }
                          });
                      });
        });
    });
});

describe("cmd line interface [slow]",function() {
    const   dir = temp.mkdirSync();
    const  pdir = path.join(dir,'.prevalence');
    let  malaya;
    const ports = {};
    //N.B. use "node malaya" in these tests (rather than ./malaya) to
    //     get something that should work on linux and windows.
    it("inits prevalence store",function(done) {
        this.timeout(10000);
        child.exec(util.format("node malaya -p %j init",pdir),
                   {},
                   (code,stdout,stderr)=>{
                       if (code!==null)
                           done(new VError("`malaya init` failed code: %j",code));
                       else if (code!==null)
                           done(new VError("failed code: %j",code));
                       else if (!fs.statSync(pdir).isDirectory())
                           done(new VError("prevalence dir not created"));
                       else
                           done();
                   });
    });
    it("rejects attempts to init twice",function(done) {
        this.timeout(10000);
        child.exec(util.format("node malaya -p %j init",pdir),
                   {},
                   (code,stdout,stderr)=>{
                       if (code===null)
                           done(new VError("`malaya init` didn't detect extant prevalence dir"));
                       else
                           done();
                   });
    });
    it("shows as not running",function(done) {
        this.timeout(10000);
        child.exec(util.format("node malaya -p %j status",pdir),
                   {},
                   (code,stdout,stderr)=>{
                       if (code!==null)
                           done(new VError("`malaya status` fails"));
                       else {
                           if (stdout.split('\n').filter((l)=>/server:[ ]+not running/.exec(l)).length===1)
                               done();
                           else
                               done(new VError("bad output from `malaya status`: %j",stdout));
                       }
                   });
    });
    it("runs",function(done) {
        this.timeout(10000);
        let buf = '';
        malaya = child.spawn("node",['malaya','-p',pdir,'run','-w0']);
        malaya.stdout.on('data',(data)=>{
            buf += data;
            const lines = buf.split('\n');
            buf = lines.slice(-1)[0];
            lines.slice(0,-1).forEach((l)=>{
                const m = /([a-z0-9]+) listening on [^:]:([0-9]+)/.exec(l);
                if (m) {
                    ports[m[1]] = parseInt(m[2]);
                } else if (/mode now: master/.exec(l)) {
                    malaya.stdout.removeAllListeners();
                    done();
                }
            });
        });
    });
    it("shows as running",function(done) {
        this.timeout(10000);
        child.exec(util.format("node malaya -p %j status",pdir),
                   {},
                   (code,stdout,stderr)=>{
                       if (code!==null)
                           done(new VError("`malaya status` fails"));
                       else {
                           if (stdout.split('\n').filter((l)=>/server:[\t ]+running .*/.exec(l)).length===1)
                               done();
                           else
                               done(new VError("bad output from `malaya status`: %j",stdout));
                       }
                   });
    });
    // +++ saving, port access &c +++
    it("stops",function(done) {
        this.timeout(10000);
        malaya.on('exit',(code,signal)=> {
            if (util.onWindows && code===null)
                done();
            else if (code===1)
                done();
            else
                done(new VError("bad return code: %j",code));
            malaya = null;
        });
        malaya.kill('SIGINT');
    });
    it("shows as not running",function(done) {
        this.timeout(10000);
        child.exec(util.format("node malaya -p %j status",pdir),
                   {},
                   (code,stdout,stderr)=>{
                       if (code!==null)
                           done(new VError("`malaya status` fails"));
                       else {
                           if (stdout.split('\n').filter((l)=>/server:[ ]+not running/.exec(l)).length===1)
                               done();
                           else
                               done(new VError("bad output from `malaya status`: %j",stdout));
                       }
                   });
    });
});