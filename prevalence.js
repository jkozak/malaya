// JSON prevalence

// state directory contains:
//  <dir>/world
//  <dir>/journal

// strategy for world-saving:
//  * close journal
//  * make new dir <dirname>-NEW
//  * write <dirname>-NEW/world
//  * sync,flush,whatever
//  * rm -rf <dirname>-OLD
//  * mv <dirname> <dirname>-OLD
//  * mv <dirname>-NEW <dirname>
//  * maybe open journal
// then when loading, try:
//  * <dirname> load
//  * if not found:  mv <dirname>-NEW <dirname> && <dirname> load
//  * if that fails: mv <dirname>-OLD <dirname> && <dirname> load

// use child_process.fork for mitosis save

// to use, journalise items _before_ evaluating (this is to make Dates work)

"use strict";
/*eslint-disable*/

var _         = require("underscore");
var events    = require('events');
var assert    = require("assert");
var fs        = require("fs");
var rm_rf     = require("rimraf");
var hash      = require("./hash.js")('sha1');
var path      = require("path");
var util      = require("./util.js");
var lock      = require("./lock.js");
var express   = require('express');
var http      = require('http');
var timestamp = require('monotonic-timestamp');

module.exports = function() {
    var exports = {};
    var  consts = process.binding('constants');
    if (consts.O_DSYNC===undefined)
        // !!! this is probably only true for linux !!!
        consts.O_DSYNC = 4096;  // octal 00010000 from /usr/include

    var dir     = null;
    var fd_jrnl = null;         // file descriptor
    var date    = null;         // effective Date object
    var t_jrnl  = null;         // #lines in active journal

    var audit      = false;
    var hash_store;
    var bl_src;
    var bl_files;
    var bl_running;

    var ee         = new events.EventEmitter();
   
    var master     = true;      // false if replicating

    var sync_journal = 'kludge';

    var sanity_check = true;
    
    var replicatees  = [];      // stream journal to these

    var hash_src_map = null;    // set to {<filename>:<hash>,...} to read source code from hash store
    
    var open = function(dirname,nolock) {
        // open an existing store
        if (dir!==null)
            throw new Error("already open");
        if (!nolock)
            lock.lockSync(path.join(dirname,'lock'));
        try {
            fs.statSync(path.join(dirname,'state'));
        } catch (err) {
            try {
                fs.renameSync(path.join(dirname,'state-NEW'),path.join(dirname,'state'));
            } catch (e) {
                try {
                    fs.renameSync(path.join(dirname,'state-OLD'),path.join(dirname,'state'));
                } catch (e) {
                    throw new Error("can't find a state dir to open");
                }
            }
        }
        var flg;
        switch (sync_journal) {
        case 'o_sync':  flg=consts.O_APPEND|consts.O_CREAT|consts.O_WRONLY|consts.O_SYNC;  break;
        case 'o_dsync': flg=consts.O_APPEND|consts.O_CREAT|consts.O_WRONLY|consts.O_DSYNC; break;
        default:        flg="a"; break;
        }
        fd_jrnl = fs.openSync(path.join(dirname,'state','journal'),flg);
        dir     = dirname;
        date    = null;
        t_jrnl  = null;
    };

    var writeJournalSync = function(entry) {
        t_jrnl++;
        var s = util.serialise(entry)+'\n';
        fs.writeSync(fd_jrnl,s,s.length,null);
        if (sync_journal==='fsync')
            fs.fsyncSync(fd_jrnl);
        else if (sync_journal==='fdatasync')
            fs.fdatasyncSync(fd_jrnl);
        else if (sync_journal==='kludge') {
            var time = Date.now();
            if (journalise.count++%journalise.kludge_count===0 || time-journalise.time>1000) {
                journalise.time = time;
                fs.fsyncSync(fd_jrnl);
            }
        }
        replicatees.forEach(function(r) {
            r.write(s);
        });
    };
    
    var journalise = function(type,datum) {
        // write a journal entry
        if (fd_jrnl===null)
            throw new Error("journal is closed");
        date = timestamp();
        if (!master)
            throw new Error("can't journalise, not master");
        writeJournalSync([date,type,datum]);
    };
    
    var journaliseAsync = function(type,datum,callback) { // !!! not used yet !!!
        // write a journal entry
        if (fd_jrnl===null)
            callback(new Error("journal is closed"),null);
        else {
            date = timestamp();
            t_jrnl++;
            var s = util.serialise([date,type,datum])+'\n';
            fs.write(fd_jrnl,s,s.length,null,function(err,x) {
                if (err)
                    callback(err,null);
                else 
                    switch (sync_journal) {
                    case 'fsync':
                        fs.fsync(fd_jrnl,callback);
                        break;
                    case 'fdatasync':
                        fs.fdatasync(fd_jrnl,callback);
                        break;
                    case 'kludge':
                        {
                            var time = Date.now();
                            if (journalise.count++%journalise.kludge_count===0 || time-journalise.time>1000) {
                                journalise.time = time;
                                fs.fsync(fd_jrnl,callback);
                                break;
                            }
                        }
                        // fallthrough
                    default:
                        callback(null,null);
                    }
            });
            replicatees.forEach(function(r) {
                r.write(s);
            });
        }
    };
    journalise.kludge_count = 16;       // !!! magic number !!!
    journalise.count        = 0;
    journalise.time         = Date.now();

    var init = function(dirname,options) {
        // prepare a directory to be a store
        if (options.sanityCheck!==undefined)
            sanity_check = options.sanityCheck;
        fs.mkdirSync(path.join(dirname,'state'));
        fs.writeFileSync(path.join(dirname,'state','world'),util.serialise(null)+'\n');
        fs.appendFileSync(path.join(dirname,'state','world'),util.serialise({})+'\n');
        open(dirname);
        journalise('init',options);
        close();
    };

    var close = function() {
        // close a store (quickly)
        if (fd_jrnl)
            fs.closeSync(fd_jrnl);
        lock.unlockSync(path.join(dir,'lock'));
        fd_jrnl = null;
        dir     = null;
        date    = null;
        t_jrnl  = null;
    };

    exports.date = function() {
        // get date
        if (date===null)
            throw new Error("date unset");
        return date;
    };

    exports.on   = function(what,handler) {ee.on(  what,handler);};
    exports.once = function(what,handler) {ee.once(what,handler);};

    var save = function(root) {
        // close a store by writing a new image (slow)
        if (dir===null)
            throw new Error("must be open to save");
        var dir_sav = dir;
        var dir_cur = path.join(dir,"state");
        var dir_new = path.join(dir,"state-NEW");
        var dir_old = path.join(dir,"state-OLD");
        var syshash = null;
        close();
        if (audit) 
            syshash = hash_store.putFileSync(path.join(dir_cur,"/journal"));
        rm_rf.sync(dir_new);
        fs.mkdirSync(dir_new);
        fs.writeFileSync( path.join(dir_new,"world"),util.serialise(syshash));
        fs.appendFileSync(path.join(dir_new,"world"),"\n");
        fs.appendFileSync(path.join(dir_new,"world"),util.serialise(root));
        fs.appendFileSync(path.join(dir_new,"world"),"\n");
        rm_rf.sync(dir_old);
        fs.renameSync(dir_cur,dir_old);
        fs.renameSync(dir_new,dir_cur);
        open(dir_sav);
        journalise('previous',syshash);
        return syshash;
    };

    var walkJournalFile = function(filename,deep_check,callback,done) {
        var i = 0;
        util.readFileLinesSync(filename,function(line) {
            var js = util.deserialise(line);
            if (i++===0) {
                switch (js[1]) {
                case 'init':
                    break;
                case 'previous':
                    callback(js[2],"journal");
                    break;
                default:
                    throw new Error(util.format("bad log file hash: %s",hash));
                }
            } else if (deep_check) {
                switch (js[1]) {
                case 'code':
                    if (js[2][2][js[2][1]]) // hash from the bl src code filename
                        callback(js[2][2][js[2][1]],'bl',js[2][1]);
                    for (var k in js[2][2]) 
                        callback(js[2][2][k],"source code",k);
                    break;
                case 'http':
                    callback(js[2][1],"http");
                    break;
                }
            }
            return deep_check; // only read whole file if checking `code` items
        });
        if (done!==undefined)
            done();
    };
    
    var walkHashStore = function(hash0,deep_check,callback) {
        // the structure of the hash store is a linear chain of journal files with
        // other items hanging off them to a depth of one.  A recursive transversal
        // is not needed to scan this exhaustively.
        for (var hash=hash0;hash;) {
            var fn = hash_store.makeFilename(hash);
            callback(hash,"journal");
            hash = null;
            walkJournalFile(fn,deep_check,function(hash1,what) {
                if (what==='journal') {
                    assert.equal(hash,null); // check only one chaining hash per journal
                    hash = hash1;
                }
                callback(hash1,what);
            });
        }
    };

    var checkHashStore = function(hash) {
        var deep_check = true;
        hash_store.sanityCheck();
        walkHashStore(hash,deep_check,function(hash,what) {
            if (!hash_store.contains(hash))
                throw new Error("can't find %s for %s",what,hash);
        });
    };
    
    var load = function(fn_root,fn_datum) {
        var world_file   = path.join(dir,'state','world');
        var journal_file = path.join(dir,'state','journal');
        var lineno       = 1;
        var syshash      = null;
        // load a store
        if (dir===null)
            throw new Error("must be open to load");
        util.readFileLinesSync(world_file,function(line) {
            switch (lineno++) {
            case 1:
                syshash = util.deserialise(line); // only used by humans so far
                return true;
            case 2:
                fn_root(util.deserialise(line));
                return false;
            }
        });
        try {
            t_jrnl = 0;
            util.readFileLinesSync(journal_file,function(line) {
                var di = util.deserialise(line);
                date = di[0];
                if (di[1]==='update')
                    fn_datum(di[2]);
                date = null;
                t_jrnl++;
                return true;
            });
            if (t_jrnl===0)
                journalise('previous',syshash);
        } catch (e) {
            if (e.code==='ENOENT')
                journalise('previous',syshash);
            else
                throw e;
        }
        // +++ don't create journal-file in `save` +++
        // +++ add `previous` line to journal here +++
        if (audit && sanity_check)
            checkHashStore(syshash);
        return syshash;
    };

    var wrap = function(dir,bl,options) {
        bl.tag = options.tag;
        var ans = {
            init:function() {
                init(dir,options);
                bl.init();
            },
            open:function() {
                open(dir);
                if (audit) {
                    journalise('code',[util.sourceVersion,bl_src,bl_files]);
                }
            },
            save:function() {
                return save(bl.get_root());
            },
            close:function() {
                close();
            },
            load:function() {
                return load(bl.set_root,bl.update);
            },
            on:function(what,handler) {
                return bl.on(what,handler);
            },
            get size() {
                return bl.size;
            },
            getFact:function(t) {
                // +++ deepClone for safety +++
                return bl.get(t);
            },
            query:function(q) {
                try {
                    bl_running = true;
                    return bl.query(q);
                } finally {
                    bl_running = false;
                }
            },
            update:function(u) {
                try {
                    journalise('update',u);
                    bl_running = true;
                    return bl.update(u);
                } finally {
                    bl_running = false;
                }
            }
        };
        if (!master)
            ans.updateSlave = function(js) { // !!! TESTING !!!
                try {
                    writeJournalSync(js);
                    bl_running = true;
                    return bl.update(js[2]);
                } finally {
                    bl_running = false;
                }
            };
        if (bl.transform!==undefined) {
            if (bl.query!==undefined || bl.update!==undefined)
                throw new Error("business logic should only define one of query+update or transform");
            ans.transform = function() {
                try {
                    bl_running = true;
                    journalise('transform',null);
                    return bl.transform();
                } finally {
                    bl_running = false;
                }
            };
        }
        if (util.env==='test')
            ans._private = {
                bl: bl
            };
        return ans;
    };

    exports.wrapper = null;

    exports.wrap = function(dir,bl,options) {
        assert.equal(exports.wrapper,null);
        bl_running = true;
        if (options===undefined)
            options = {audit:        true,
                       sync_journal: 'kludge'};         // default options
        sync_journal = options.sync_journal;
        if (sync_journal===undefined)
            sync_journal = 'o_sync';
        if (['fsync','fdatasync','o_sync','o_dsync','none','kludge'].indexOf(sync_journal)===-1)
            throw new Error("bad sync_journal option: "+sync_journal);
        audit = !!options.audit;
        if (audit) {
            bl_files   = {};
            hash_store = hash.make_store(path.join(dir,'hashes'));
            for (var k in require.extensions) {
                require.extensions[k] = (function(ext) {
                    return function(module,filename) {
                        if (bl_running) {
                            if (hash_src_map!==null) 
                                filename = hash_store.makeFilename(hash_src_map[filename]) || filename;
                            else
                                bl_files[filename] = hash_store.putFileSync(filename);
                        }
                        return ext(module,filename);
                    } })(require.extensions[k]);
            }
        }
        bl_src = bl===undefined ? 'bl' : bl;
        if ((typeof bl_src)==='string') {
            if (path.resolve(bl_src)!==path.normalize(bl_src)) // relative path?
                bl_src = './'+bl_src;                      // be explicit if so
            bl = require(bl_src);
        } else {                                // prebuilt business logic object
            if (audit)
                throw new Error("auditing required and source code not given");
        }
        bl_running      = false;
        exports.wrapper = wrap(dir,bl,options);
        return exports.wrapper;
    };

    exports.cacheFile = function(fn) {
        var    seen = {};
        var encache = function(url,filename,entry) {
            entry.hash = hash_store.putFileSync(filename);
            journalise('http',[url,entry.hash]);
            seen[url] = entry;
        };
        var      sn = seen[fn];
        var      st = fs.statSync(fn);
        var      en = {mtime:st.mtime,size:st.size};
        if (sn) {
            if (st.size!==sn.size || st.mtime.getTime()!==sn.mtime.getTime()) // has base file changed?
                encache(fn,fn,en);
        } else
            encache(fn,fn,en);
        sn = seen[fn];
        return [sn.hash,hash_store.makeFilename(sn.hash)];
    };

    exports.createExpressMiddleware = function(p) {
        return function(req,res,next) {
            if (req.method==='GET' || req.method==='HEAD') {
                try {
                    var fn = path.join(p,req.path);
                    var cf = exports.cacheFile(fn);
                    res.setHeader("Content-Type",express.static.mime.lookup(fn));
                    res.setHeader("ETag",        cf[0]);
                    res.status(200);
                    if (req.method==='GET')
                        res.sendFile(path.resolve(cf[1]));
                    return;
                } catch (e) {
                    if (e.code!=='ENOENT')
                        throw e;
                }
            }
            next();
        };
    };

    exports.installHandlers = function(app,options) {
        options        = options || {};
        options.prefix = options.prefix || '/replication';
        if (audit) {
            app.get(options.prefix+'/hashes',function(req,res) {
                fs.readdir(dir+'/hashes',function(err,files) {
                    if (err) {
                        res.writeHead(500,"can't list hashes directory");
                    } else {
                        res.writeHead(200,{'Content-Type':'application/json'});
                        res.write(JSON.stringify(files));
                    }
                    res.end();
                });
            });
            app.use(options.prefix+'/hash',express.static(path.join(dir,'/hashes')));
        }
        app.use(options.prefix+'/state',express.static(path.join(dir,'/state')));
    };

    exports.addReplicationConnection = function(conn) {
        var st = fs.fstatSync(fd_jrnl);
        replicatees.push(conn);
        conn.write(util.serialise(['open',{journalSize:st.size}]));
        conn.on('close',function() {
            var i = replicatees.indexOf(conn);
            if (i!==-1)
                replicatees.splice(i,1);
        });
    };

    var getFile = function(filename,url,opts,callback) {
        var wstream = fs.createWriteStream(filename);
        var request = http.get(url,function(response) { // +++ opts +++
            response.pipe(wstream);
            wstream.on('finish', function() {
                wstream.close(callback);
            });
        });
    };

    var initReplication = function(dir,url,init,callback) {
        var err = null;
        var gotFile = _.after(2,function() {
            callback(err);
        });
        getFile(path.join(dir,'state','world'),url+'replication/state/world',{},function(e) {
            err = err || e;
            gotFile();
        });
        getFile(path.join(dir,'state','journal'),url+'replication/state/journal',
                {headers:{range:util.format("bytes=0-%d",init.journalSize)},statusCode:[200,206]},
                function(e) {
                    err = err || e;
                    gotFile();
                });
    };

    var replicateHashStore = function(dir,url,callback) {
        var jrnlhash;           // hash of the active journal
        var syshash;            // `previous` hash of active journal
        var businessLogic;      // from active journal
        var hashSourceMap = {}; // `code` of active journal
        var hashes = {};        // <hash> -> <what>
        var fetchHashIfAbsent = function(hash,what,cb) {
            var filename = hash_store.makeFilename(hash);
            try {
                fs.statSync(filename);
                cb(null);
            } catch(e) {
                if (e.code==='ENOENT') {
                    getFile(filename,url+'replication/hash/'+hash,{},cb);
                } else
                    cb(e);
            }
        };
        var doJournalFile = function(hash) {
            walkJournalFile(hash_store.makeFilename(hash),
                            true,
                            function(h,what,x) {
                                if (h!==null)
                                    hashes[h] = what;
                                if (hash===jrnlhash) {
                                    if (what==='journal')
                                        syshash = h;
                                    else if (what==='source code')
                                        hashSourceMap[x] = h;
                                    else if (what==='bl')
                                        businessLogic = x;
                                }
                            },
                            next);
        };
        var next = function() {
            var ks = _.keys(hashes);
            if (ks.length===0) {
                try {
                    checkHashStore(jrnlhash);
                    callback(null,syshash,{bl:businessLogic,map:hashSourceMap}); // successful "exit"
                } catch (e) {
                    callback(e);
                }
            }
            else {
                var hash = ks[0];
                var what = hashes[hash];
                fetchHashIfAbsent(hash,what,function(e) {
                    if (e)
                        callback(e);
                    else {
                        ee.emit('fetch-hash',hash,what);
                        delete hashes[hash];
                        if (what==='journal')
                            doJournalFile(hash);
                        else
                            next(); // +++ make this less recursive +++
                    }
                });
            }
        };
        jrnlhash = hash_store.putFileSync(path.join(dir,'state','journal'));
        hashes[jrnlhash] = 'journal';
        next();
    };

    exports.replicateFrom = function(dir,url) { // `url` is base e.g. http://localhost:3000/
        var  SockJS = require('node-sockjs-client');
        var    sock = new SockJS(url+'replication/journal');
        var started = false;
        var pending = [];
        var     wbl = null;
        var    tidy = false;

        audit        = true;
        master       = false;
        sanity_check = false;

        lock.lockSync(path.join(dir,'lock'));

        hash_store = hash.make_store(path.join(dir,'hashes'));

        rm_rf.sync(path.join(dir,'state'));   // clear out state directory
        fs.mkdirSync(path.join(dir,'state'));

        sock.onmessage = function(e) {
            var js = util.deserialise(e.data);
            if (!started) {
                initReplication(dir,url,js[1],function(err) {
                    if (err) throw err;
                    open(dir,true);
                    ee.emit('replicated','state');
                    if (audit)
                        replicateHashStore(dir,url,function(err,syshash,hsm) {
                            if (err)
                                throw new util.Fail(util.format("failed to replicate hash store: %j",err));
                            else {
                                ee.emit('replicated','hashes');
                                wbl = exports.wrap(dir,hsm.bl); // compilation happens here
                                ee.emit('loaded','code');
                                wbl.load();
                                ee.emit('loaded','state');
                                pending.forEach(function(u){wbl.updateSlave(u);});
                                pending = null;
                                ee.emit('ready',syshash);
                            }
                        });
                    else {
                        pending.forEach(writeJournalSync);
                        pending = null;
                        ee.emit('ready',null);
                    }
                });
                started = true;
            } else if (pending!==null)
                pending.push(js);
            else if (js[1]!=='update')
                sock.close();
            else 
                wbl.updateSlave(js);
        };

        sock.onerror = function(err) {
            console.log("!!! ws socket failed: %s",err);
        };
            
        sock.onclose = function() {
            if (audit) {
                var syshash = hash_store.putFileSync(path.join(dir,'state','journal'));
                console.log("*** ws socket closed %s: %s",(tidy?"nicely":"roughly"),syshash);
                ee.emit('closed',tidy,syshash);
            }
        };
    };

    exports.becomeMaster = function() {
        assert(!master);
        master = true;
    };

    if (util.env==='test')
        exports._private = {wrap:         wrap,
                            getHashStore: function() {return hash_store;},
                            hash:         hash,
                            consts:       consts,
                            init:         init,
                            open:         open,
                            set_syncjrnl: function(f) {sync_journal=f;},
                            close:        close,
                            journalise:   journalise};

    return exports;
};
