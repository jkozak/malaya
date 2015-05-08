"use strict";

var _      = require('underscore');
var crypto = require('crypto');
var stream = require('stream');
var fs     = require('fs');
var util   = require('./util.js');
var events = require('events');
var path   = require('path');

// This module is largely sync but is only called during single-activity time
// (loading,saving) so that doesn't really matter.

module.exports = function(algorithm) {
    var ans = {
        init: function(dirname) {
            try {               // if dirname doesn't exist, create it
                var st = fs.statSync(dirname);
                if (!st.isDirectory())
                    throw new util.Fail(util.format("hash store %j exists and is not a directory",dirname));
            } catch (err) {
                if (err.code==='ENOENT') 
                    try {
                        fs.mkdirSync(dirname);
                    } catch (err1) {
                        throw new util.Fail(util.format("can't find or open a hashstore at: %j",dirname));
                    }
                else
                    throw err;
            }
        },
        makeStore: function(dirname) {
            var      ee = new events.EventEmitter();
            var setMode = function(filename) {
                if (util.env==='prod')
                    fs.chmodSync(filename,4*8*8+4*8+4); // mode 0444
            };
            ans.init(dirname);
            var store = {
                on:           function(what,handler) {ee.on(what,handler);},
                makeFilename: function(h) {
                    return path.join(dirname,h);
                },
                contains: function(h) {
                    return fs.existsSync(store.makeFilename(h));
                },
                putFileSync: function(filename) {
                    return store.putSync(fs.readFileSync(filename));
                },
                putSync: function(x) {
                    var        h = ans.hash(x);
                    var filename = store.makeFilename(h);
                    if (!fs.existsSync(filename)) {
                        ee.emit('add',h);
                        fs.writeFileSync(filename,x);
                    }
                    setMode(filename);
                    return h;
                },
                getSync: function(h,opts) {
                    opts = opts || {encoding:'utf8'};
                    return fs.readFileSync(store.makeFilename(h),opts);
                },
                getHashes:function() {
                    return fs.readdirSync(dirname);
                },
                check: function(hash) {
                    var b = ans.hash(store.getSync(hash))===hash;
                    if (!b)
                        fs.unlinkSync(store.makeFilename(hash)); // not worth keeping?
                    return b;
                },
                sanityCheck: function() {
                    var hashes = store.getHashes();
                    for (var k in hashes) { // check all hashes are sound
                        var h = hashes[k];
                        if (ans.hash(store.getSync(h))!==h)
                            ee.emit("error",util.format("broken hash: %j",h));
                    }
                },
                stageId: 1,
                createWriteStream: function() {
                    var      fn = path.join(dirname,util.format('stage.%d',this.stageId++));
                    var hstream = crypto.createHash(algorithm);
                    var fstream = fs.createWriteStream(fn);
                    var wstream = stream.PassThrough();
                    var   done2 = _.after(2,function() {
                        var   h = hstream.read().toString('hex');
                        var hfn = store.makeFilename(h);
                        fs.rename(fn,hfn,function(err1) {
                            if (err1)
                                wstream.emit('error',new Error("failed to rename hash"));
                            else {
                                setMode(hfn); // !!! s/be async
                                wstream.emit('stored',h);
                            }
                        });
                    });
                    hstream.on('finish',done2);
                    fstream.on('finish',done2);
                    wstream.pipe(hstream);
                    wstream.pipe(fstream);
                    return wstream;
                }
            };
            return store;
        },
        makeHasher: function() {
            return crypto.createHash(algorithm);
        },
        hash: function(x) {
            var hasher = ans.makeHasher();
            hasher.write(x);
            return hasher.digest('hex');
        }
    };
    return ans;
};
