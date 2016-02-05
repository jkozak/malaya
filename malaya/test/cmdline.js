"use strict";

const cmdline = require("../cmdline.js");

const util    = require("../util.js");
const fs      = require("fs");
const temp    = require("temp").track();
const path    = require("path");
const assert  = require("assert");
const VError  = require("verror");

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
