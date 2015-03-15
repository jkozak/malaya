"use strict";
/*eslint-disable camelcase*/

var crypto = require('crypto');
var fs     = require('fs');
var util   = require('./util.js');
var events = require('events');
var   path = require('path');

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
        make_store: function(dirname) {
            var ee = new events.EventEmitter();
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
                    if (util.env==='prod')
                        fs.chmodSync(filename,4*8*8+4*8+4); // mode 0444
                    return h;
                },
                getSync: function(h) {
                    return fs.readFileSync(store.makeFilename(h));
                },
                getHashes:function() {
                    return fs.readdirSync(dirname);
                },
                sanityCheck:function() {
                    var hashes = store.getHashes();
                    for (var k in hashes) { // check all hashes are sound
                        var h = hashes[k];
                        if (ans.hash(store.getSync(h))!==h)
                            throw new Error("broken hash: "+h);
                    }
                }
            };
            return store;
        },
        make_hasher: function() {
            return crypto.createHash(algorithm);
        },
        hash: function(x) {
            var hasher = ans.make_hasher();
            hasher.write(x);
            return hasher.digest('hex');
        }
    };
    return ans;
};
