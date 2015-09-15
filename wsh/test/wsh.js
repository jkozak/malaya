"use strict";

var wsh    = require('../wsh.js');

var assert = require("assert");
var   temp = require('temp').track();
var   path = require('path');
var     fs = require('fs');

describe("wsh",function() {
    var doNotCall = function() {
        throw new Error("Do Not Disturb");
    };
    var dir3txt = temp.mkdirSync();
    before(function() {
        fs.writeFileSync(path.join(dir3txt,'1.txt'));
        fs.writeFileSync(path.join(dir3txt,'2.txt'));
        fs.writeFileSync(path.join(dir3txt,'3.txt'));
    });

    describe("doCmd",function() {
        var doCmd = function(cmd,exec,rmRF) {
            return wsh._private.doCmd(cmd,{exec:exec||doNotCall,rmRF:rmRF||doNotCall});
        };
        var doCmdRc0 = function(cmd,exec,rmRF) {
            assert.strictEqual(doCmd(cmd,exec,rmRF),0);
        };
        it("returns zero if a command completes",function() {
            doCmdRc0(['nonesuch'],function(){});
        });
        it("returns given status code if child throws",function() {
            var rc = 177;
            assert.strictEqual(doCmd(['nonesuch'],function() {
                var e = new Error("oops");
                e.status = rc;
                throw e;
            }),rc);
        });
        it("ignores comments",function() {
            doCmdRc0(['#nonesuch']);
        });
        it("executes commands",function() {
            doCmdRc0(['cmd','with','args'],function(c) {
                assert.strictEqual(c,"cmd with args");
            });
        });
        it("executes commands after trimming comments",function() {
            doCmdRc0(['cmd','#with','args'],function(c) {
                assert.strictEqual(c,"cmd");
            });
        });
        it("removes a single file",function() {
            doCmdRc0(['rm','-rf','file1'],null,function(f) {
                assert.strictEqual(f,"file1");
            });
        });
        it("removes multiple files",function() {
            var files = [];
            doCmdRc0(['rm','-rf','file1','file2','file3'],null,function(f){files.push(f);});
            assert.deepEqual(files,['file1','file2','file3']);
        });
    });

});
    
