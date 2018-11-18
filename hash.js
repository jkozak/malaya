"use strict";

const _      = require('underscore');
const crypto = require('crypto');
const stream = require('stream');
const fs     = require('fs');
const util   = require('./util.js');
const events = require('events');
const path   = require('path');
const VError = require('verror');
const rmRF   = require('rimraf');

// This module is largely sync but is only called during single-activity time
// (loading,saving) so that doesn't really matter.

module.exports = function(algorithm) {
    const ans = {
        init: function(dirname) {
            try {               // if dirname doesn't exist, create it
                const st = fs.statSync(dirname);
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
            const      ee = new events.EventEmitter();
            const setMode = function(filename) {
                if (util.env==='prod')
                    fs.chmodSync(filename,4*8*8+4*8+4); // mode 0444
            };
            ans.init(dirname);
            rmRF.sync(path.join(dirname,'*.tmp'));      // forget any partially put files
            rmRF.sync(path.join(dirname,'stage.*'));    // forget any partially put files
            const store = {
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
                    const        h = ans.hash(x);
                    const filename = store.makeFilename(h);
                    if (!fs.existsSync(filename)) {
                        // use rename to make this (more?) atomic
                        // fs.writeFileSync has no guarantees of when the file is named
                        fs.writeFileSync(filename+'.tmp',x);
                        fs.renameSync(filename+'.tmp',filename);
                        ee.emit('add',h);
                    }
                    setMode(filename);
                    return h;
                },
                getSync: function(h,opts) {
                    opts = Object.assign({},{encoding:'utf8'},opts);
                    return fs.readFileSync(store.makeFilename(h),opts);
                },
                getHashes:function() {
                    return fs.readdirSync(dirname).filter(f=>!f.endsWith('.tmp'));
                },
                check: function(hash) {
                    const b = ans.hash(store.getSync(hash))===hash;
                    if (!b)
                        fs.unlinkSync(store.makeFilename(hash)); // not worth keeping?
                    return b;
                },
                sanityCheck: function(cb) {
                    const hashes = store.getHashes();
                    for (const k in hashes) { // check all hashes are sound
                        const h = hashes[k];
                        if (ans.hash(store.getSync(h,{encoding:null}))!==h)
                            cb(new VError("broken hash: %j",h));
                    }
                },
                stageId: 1,
                createWriteStream: function() {
                    const      fn = path.join(dirname,util.format('stage.%d',this.stageId++));
                    const hstream = crypto.createHash(algorithm);
                    const fstream = fs.createWriteStream(fn);
                    const wstream = stream.PassThrough();
                    const   done2 = _.after(2,function() {
                        const   h = hstream.read().toString('hex');
                        const hfn = store.makeFilename(h);
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
            const hasher = ans.makeHasher();
            hasher.write(x);
            return hasher.digest('hex');
        },
        hashFileSync: function(filename) {
            return ans.hash(fs.readFileSync(filename));
        }
    };
    return ans;
};
