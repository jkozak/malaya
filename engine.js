// streaming engine for chrjs store, implements prevalence

// use thus:

//  const eng = new Engine(<dir>,<chrjs>,<opts>)
//  eng.start()
//  eng.become('master'|'slave'|'idle')
//     ... 'mode' event fires with new mode when done
//     ... happy server time
//  eng.stop()

// constructor <opts>:
//        init: <initter>                 to init the prevalence dir
//       ports: {<protocol>:<int>,...}    (for master)
//   masterUrl: <url>                     (for slave)

// modes control whether:
//  * the prevalence layer is running (master,slave)
//  * the standard (http) listener is taking data and replication connections (master)
//  * the replication component is listening to a master (slave)
//  * the standard (http) listener is taking admin connections (all)
//
// if the prevalence layer is running (`startPrevalence` has
// successfully run) connections of any type can be added "manually"
// with `addConnection` in any mode.  This is only used for testing at
// the moment.

"use strict";

const           _ = require('underscore');
const      events = require('events');
const      VError = require('verror');
const        util = require('./util.js');
const        path = require('path');
const          fs = require('fs');
const        rmRF = require('rimraf');
const    through2 = require('through2');
const     express = require('express');
const        http = require('http');
const          ip = require('ip');
const          vm = require('vm');
const       shell = require('shelljs');
const      random = require('random-js');
const   expressWS = require('express-ws');
const       pkgUp = require('pkg-up');

const    compiler = require('./compiler.js');
const         www = require('./www.js');
const     whiskey = require('./whiskey.js');
const        hash = require('./hash.js');
const        lock = require('./lock.js');
const      plugin = require('./plugin.js');
const     history = require('./history.js');

const ourHash                 = hash(util.hashAlgorithm);
const hashFileSync            = ourHash.hashFileSync;
const hashFirstLineOfFileSync = ourHash.hashFirstLineOfFileSync;

exports.makeInertChrjs = function(opts) {
    opts = opts || {tag:null};
    const obj = {              // behaves like `store {}`;
        t:        1,
        facts:    {},
        get: function(t) {
            return this.facts[t];
        },
        getRoot: function() {
            return {
                t:    this.t,
                facts:this.facts
            };
        },
        setRoot: function(r) {
            this.t     = r.t;
            this.facts = r.facts;
        },
        reset:    function() {
            this.t     = 1;
            this.facts = {};
        },
        add:   function(f) {
            const ans = {err:null,adds:[this.t],dels:[],refs:[]};
            this.facts[this.t++] = f;
            return ans;
        },
        _del: function(t) {
            delete this.facts[t];
        },
        update:   function(f) {
            const ans = this.add(f);
            ans.refs[this.t-1] = f;
            return ans;
        },
        on: function(w,h) {},   // it's inert
        get size()    {return Object.keys(this.facts).length;},
        get orderedFacts() {
            const keys = Object.keys(obj.facts).map(function(t){return parseInt(t);});
            return keys.sort(function(p,q){return p-q;}).map(function(t){return obj.facts[t];});
        }
    };
    if (util.env!=='prod')
        obj._private = {
            get facts() {return obj.facts;},   // be compatible with real chrjs
            get orderedFacts() {
                return obj.orderedFacts;
            }
        };
    return obj;
};

const Engine = exports.Engine = function(options) {
    events.EventEmitter.call(this);

    const eng = this;

    options                  = options || {};
    options.dir              = options.dir || process.cwd();
    options.webDir           = options.webDir || path.join(options.dir,'www');
    options.ports            = options.ports || {http:3000};
    options.bundles          = options.bundles || {};
    options.minify           = options.minify===undefined ? util.env!=='test' : options.minify;
    options.endpoints        = options.endpoints || ['data'];
    options.createHttpServer = options.createHttpServer || www.createServer;
    options.populateHttpApp  = options.populateHttpApp || www.populateApp;

    compiler.debug     = options.debug;

    eng.prevalenceDir  = options.prevalenceDir || path.join(options.dir,'.prevalence');
    eng.syshash        = null;
    eng.sources        = {};
    eng.sandbox        = null;
    eng.chrjs          = options.chrjs || eng.compile(options.businessLogic) || exports.makeInertChrjs();
    eng.hashes         = null;                   // hash store
    eng.wsOptions      = options.wsOptions;
    eng.options        = options;
    eng.mode           = 'idle';                 // 'master' | 'slave' | 'idle'
    eng.conns          = {};                     // <port> -> {i:<in-stream>,o:<out-stream>,type:<type>}
    eng.connIndex      = {};                     // <type> -> [<port>,...]
    eng.http           = null;                   // express http server
    eng.journal        = null;                   // journal write stream
    eng._timestamp     = options.timestamp || require('monotonic-timestamp');
    eng._nextTimestamp = null;                   // to force next timestamp to known value
    eng.journalFlush   = (cb)=>cb(null);         // flush journal
    eng.journalFd      = null;
    eng.chrjs.tag      = options.tag;
    eng.masterUrl      = eng.options.masterUrl;
    eng.replicateSock  = null;
    eng.active         = null;                   // update being processed
    eng.git            = options.git==='none' ? null : options.git;
    eng._rng           = {
        engine: random.engines.mt19937(),
        dist:   random.real(0,1,false),
        seed:   null
    };

    try {
        eng.sources[pkgUp.sync().replace('package.json','package-lock.json')] = null;
    } catch (e) {
        console.warn(`can't find package-lock file for code log: ${e}`);
    }

    eng.chrjs.on('error',(err)=>eng.emit('error',new VError(err,"chrjs: ")));

    if (options.endpoints.includes('admin') || options.endpoints.includes('replication/journal'))
        throw new VError("reserved endpoint used");
    eng.on('connection',function(portName,type) {
        eng.broadcast(['connection',portName,type,true],'admin');
    });
    eng.on('connectionClose',function(portName,type) {
        eng.broadcast(['connection',portName,type,false],'admin');
    });

    plugin.registerEngine(eng);

    return eng;
};

util.inherits(Engine,events.EventEmitter);

Engine.prototype.sanityCheck = function() { // performed just before starting
    const eng = this;
    if (eng.git) {
        const branch = shell.exec(`git branch`,{cwd:eng.prevalenceDir,silent:true});
        let       ok = false;
        if (branch.code!==0)
            throw new VError("prevalence dir %s is not in a repo",eng.prevalenceDir);
        branch.stdout.split('\n').forEach((l)=>{
            if (l==="* prevalence")
                ok = true;
        });
        if (!ok)
            throw new VError("git repo not in prevalence branch");
    }
};

Engine.prototype.compile = function(source) {
    const eng = this;
    if (eng.sandbox===null) {
        eng.sandbox = _.extend({},global,{require:require});
        vm.createContext(eng.sandbox);
    }
    if (source) {
        const children = module.children.slice(0);
        const   asreqd = require(path.resolve(source)); // eslint-disable-line security/detect-non-literal-require
        const    chrjs = asreqd.main || asreqd;
        const    loads = _.difference(module.children,children);
        if (loads.length>1)
            throw new VError("compiling %s added %s modules",source,loads.length);
        for (const i in loads)
            eng.sources[loads[i].filename] = null;
        chrjs.reset();          // because `require` caches values
        return chrjs;
    } else
        return null;
};

Engine.prototype.timestamp = function() {
    const eng = this;
    return eng._nextTimestamp || eng._timestamp();
};

Engine.prototype._saveWorld = function() {
    const eng = this;
    // +++ prevalence.batch (i.e. we are currently using `state-NEW`) +++
    const  dirCur = path.join(eng.prevalenceDir,"state");
    const  dirNew = path.join(eng.prevalenceDir,"state-NEW");
    const  dirOld = path.join(eng.prevalenceDir,"state-OLD");
    const syshash = eng.hashes.putFileSync(path.join(dirCur,"/journal"));
    const    root = {chrjs: eng.chrjs.getRoot(),
                     git:   eng.git,
                     rng:   {seed:eng._rng.seed,useCount:eng._rng.engine.getUseCount()} };
    const  wLine1 = util.serialise(syshash)+'\n';
    const  wLine2 = util.serialise(root)+'\n';
    const      ts = eng.timestamp();
    rmRF.sync(dirNew);
    fs.mkdirSync(dirNew);
    fs.writeFileSync( path.join(dirNew,"world"),wLine1);
    fs.appendFileSync(path.join(dirNew,"world"),wLine2);
    const    hasher = ourHash.makeHasher();
    hasher.write(wLine1);
    hasher.write(wLine2);
    const worldHash = hasher.digest('hex');
    const   journal = util.serialise([ts,'previous',syshash,worldHash]);
    fs.writeFileSync( path.join(dirNew,"journal"),journal+'\n');
    const journalHash = ourHash.hash(journal);
    rmRF.sync(dirOld);
    fs.renameSync(dirCur,dirOld);
    fs.renameSync(dirNew,dirCur);
    if (eng.git) {
        shell.exec("git add .",{cwd:eng.prevalenceDir});
        shell.exec(`git commit -m "prevalence world save: ${journalHash}"`,{cwd:eng.prevalenceDir});
        shell.exec(`git tag JOURNAL-${journalHash}`,{cwd:eng.prevalenceDir}); // +++ optionally signed +++
        if (eng.git==='push')
            try {
                shell.exec(`git push origin prevalence`,{cwd:eng.prevalenceDir});
            } catch (err) {
                console.log("failed to push changes",err);
            }
    }
    eng.emit('saved',syshash,worldHash,journalHash);
    return syshash;
};

Engine.prototype.stopPrevalence = function(quick,cb) {
    const eng = this;
    if (eng.journal) {          // not true if opts.readonly set
        const journal = eng.journal;
        eng.journal = null;
        // 'close' event for `fs.WriteStream` is undocumented _but_
        // cannot do dir renames in `_saveWorld` until journal closed.
        journal.on('finish',()=>{
            fs.fdatasyncSync(eng.journalFd);
            fs.closeSync(eng.journalFd);
            eng.journalFd = null;
            if (quick) {
                // +++ better to use digest-stream? +++
                const h = hashFileSync(path.join(eng.prevalenceDir,'state','journal'));
                eng.emit('saved',null,null,h);
            } else
                eng._saveWorld();
            eng.chrjs.out = ()=>{};
            if (cb) cb();
        });
        journal.end();
    }
};

Engine.prototype.stop = function(unlock,cb) {
    const eng = this;
    if (eng.mode!=='idle')
        eng.become('idle',err=>{
            if (err)
                throw err;
            eng.stop(unlock,cb);
        });
    else {
        unlock = unlock===undefined ? true : unlock;
        if (unlock)
            lock.unlockSync(path.join(eng.prevalenceDir,'lock'));
        eng.emit('stop');
        if (cb) cb();
    }
};

Engine.prototype.loadData = function(data,cb) {
    const eng = this;
    eng.journaliseCodeSources('code',eng.options.businessLogic,false,err=>{
        if (err)
            cb(err);
        else if (/.json$/.test(data)) {      // single json array-of-arrays
            const  arr = JSON.parse(fs.readFileSync(data));
            const take = function() {
                if (arr.length===0)
                    cb(null);
                else
                    eng.update(arr.shift(),take);
            };
            if (!(arr instanceof Array))
                cb(new VError("bad format, expected an Array"));
            else
                take();
        } else if (/.jsonl$/.test(data) || data==='-') {
            const  istream = data==='-' ? process.stdin : fs.createReadStream(data);
            const jpstream = whiskey.JSONParseStream();
            const upstream = eng.createUpdateStream();
            upstream.on('finish',(err)=>{
                cb(err);
            });
            istream.pipe(jpstream);
            jpstream.on('data',(js)=>{
                eng.update(js);
            });
            jpstream.on('end',cb);
        } else
            cb(new VError("can't handle data: %s",data));
    });
};

Engine.prototype._init = function() {
    const eng = this;
    try {
        fs.statSync(eng.prevalenceDir);
        throw new VError("prevalence dir %s already exists, won't init",eng.prevalenceDir);
    } catch (err) {
        if (err.code==='ENOENT') {
            try {
                const    h = hash(util.hashAlgorithm);
                const hdir = path.join(eng.prevalenceDir,'hashes');
                fs.mkdirSync(eng.prevalenceDir);
                fs.mkdirSync(path.join(eng.prevalenceDir,'state'));
                h.init(hdir);
            } catch (err1) {
                try {
                    rmRF.sync(eng.prevalenceDir);
                } catch (e) {/* eslint no-empty:0 */}
                throw new VError(err1,"failed to init");
            }
        } else if (err.code)
            throw new VError(err,"prevalence dir %s odd, won't init",eng.prevalenceDir);
        else
            throw err;
    }
    if (eng.git) {
        const exec = (cmd)=>shell.exec(cmd,{cwd:eng.prevalenceDir});
        if (exec(`git rev-parse`).code===0)
            throw new VError("prevalence dir %s is already in a repo",eng.prevalenceDir);
        if (exec(`git init`).code!==0)
            throw new VError("can't make prevalence dir %s a repo",eng.prevalenceDir);
        if (exec(`git checkout -b prevalence`).code!==0)
            throw new VError("can't make prevalence dir %s branch",eng.prevalenceDir);
    }
    eng.emit('init');
};

Engine.prototype._ensureStateDir = function() { // after calling successfully, `state` might be loadable
    const eng = this;
    try {
        fs.statSync(path.join(eng.prevalenceDir,'state'));
    } catch (err) {
        if (err.code==='ENOENT') {
            try {
                fs.renameSync(path.join(eng.prevalenceDir,'state-NEW'),path.join(eng.prevalenceDir,'state'));
            } catch (err1) {
                try {
                    fs.renameSync(path.join(eng.prevalenceDir,'state-OLD'),path.join(eng.prevalenceDir,'state'));
                } catch (err2) {
                    throw new VError(err2,"can't find a state dir to open");
                }
            }
        } else
            throw new VError(err,"trouble with state dir");
    }
};

Engine.prototype._makeHashes = function() {
    this.hashes = history.makeHashes(this.prevalenceDir);
};

Engine.prototype._overwriteExisting = function() {
    const eng = this;
    if (eng.options.overwrite) {
        try {
            fs.statSync(eng.prevalenceDir);
        } catch (err) {
            if (err.code!=='ENOENT')
                throw new VError(err,"trouble with prevalence dir");
            return false;
        }
        // +++ allow for prevDir existing but not stateDir +++
        //     which happens after `malaya term` cmd
        const jrnlFile = path.join(eng.prevalenceDir,'state','journal');
        try {
            eng._ensureStateDir();
            eng._makeHashes();
            fs.appendFileSync(jrnlFile,util.serialise([eng.timestamp(),'term',{}])+'\n');
            eng.hashes.putFileSync(jrnlFile);
        } catch (err) {
            if (err.code!=='ENOENT')
                throw new VError(err,"trouble with state dir");
        }
        try {
            rmRF.sync(path.join(eng.prevalenceDir,'state-OLD'));
        } catch (e) {/* eslint no-empty:0 */}
        try {
            rmRF.sync(path.join(eng.prevalenceDir,'state-NEW'));
        } catch (e) {/* eslint no-empty:0 */}
        try {
            rmRF.sync(path.join(eng.prevalenceDir,'state'));
        } catch (e) {/* eslint no-empty:0 */}
        fs.mkdirSync(path.join(eng.prevalenceDir,'state'));
        return true;
    }
    return false;
};

Engine.prototype.init = function(data) {
    const      eng = this;
    const jrnlFile = path.join(eng.prevalenceDir,'state','journal');
    if (!eng._overwriteExisting())
        eng._init();
    eng._ensureStateDir();
    eng._makeHashes();
    eng._rng.seed = eng.options.rngSeed || 0;
    eng._rng.engine.seed(eng._rng.seed);
    fs.writeFileSync(jrnlFile,util.serialise([eng.timestamp(),'init',eng.options])+'\n');
    eng.syshash = eng._saveWorld();
};

Engine.prototype.initFromRepo = function(repo) {
    const eng = this;
    try {
        fs.statSync(eng.prevalenceDir);
        throw new VError("prevalence dir %s already exists, won't init",eng.prevalenceDir);
    } catch (err) {
        if (err.code!=='ENOENT') {
            if (err.code!==undefined)
                throw new VError(err,"prevalence dir %s odd, won't init",eng.prevalenceDir);
            else
                throw err;
        }
    }
    const pbr = shell.exec("git rev-parse --quiet --verify prevalence",{silent:true});
    if (pbr.code!==0)
        throw new Error("can't find a prevalence branch");
    fs.mkdirSync(eng.prevalenceDir);
    if (shell.exec("git rev-parse",{cwd:eng.prevalenceDir,silent:true}).code===0)
        throw new Error("prevalence dir %s already in a repo",eng.prevalenceDir);
    const commit = pbr.stdout.trim();
    console.log("initting from prevalence commit: %s",commit);
    const    res = shell.exec("git clone "+
                              "--branch prevalence "+
                              "--single-branch "+
                              `${repo} ${eng.prevalenceDir}`);
    if (res.code!==0)
        throw new VError("!!! failed:\n%s%s",res.stdout,res.stderr);
};

Engine.prototype.start = function(cb) {
    const eng = this;
    eng.sanityCheck();
    lock.lockSync(path.join(eng.prevalenceDir,'lock'),eng.options);
    eng._makeHashes();
    if (cb) cb();
};

Engine.prototype.startPrevalence = function(opts,cb) {
    if ((typeof opts)==='function' && cb===undefined) {
        cb   = opts;
        opts = {};
    } else if (opts===undefined)
        opts = {};
    const eng = this;
    eng._ensureStateDir();
    const jrnlFile = path.join(eng.prevalenceDir,'state','journal');
    const wrldFile = path.join(eng.prevalenceDir,'state','world');
    const jrnlHash = hashFirstLineOfFileSync(jrnlFile);
    const wrldHash = hashFileSync(wrldFile);
    if (eng.git) {
        // +++ check jrnlHash against git if used +++
    }
    // +++ witness plugins +++
    eng._loadWorld(wrldHash,jrnlHash);
    const residue = util.readFileLinesSync(jrnlFile,function(l) { // replay
        const js = util.deserialise(l);
        switch (js[1]) {
        case 'update':
            eng._nextTimestamp = js[0];
            eng.chrjs.update(js[2]);
            eng._nextTimestamp = null;
            break;
        case 'previous':
            if (js[2]!==eng.syshash)
                throw new VError("syshash  wanted: %s  got: %s",eng.syshash,js[2]);
            if (js[3]!==wrldHash)
                throw new VError("world file hash: %s  expected: %s",wrldHash,js[3]);
            break;
        }
        return true;
    });
    if (residue) {
        const jrnlSize = fs.statSync(jrnlFile).size;
        console.log("truncating journal file to lose junk: %j",residue);
        fs.truncateSync(jrnlFile,jrnlSize-residue.length);
    }
    if (opts.readonly)
        eng.journal   = null;
    else {
        eng.journalFd = fs.openSync(jrnlFile,'a');
        eng.journal   = fs.createWriteStream(null,{fd:eng.journalFd,autoClose:false});
    }
    eng.chrjs.out = function(d,j) {return eng.out(d,j);};
    if (cb) cb();
};

Engine.prototype.cacheFile = function(fn,cb) {
    const     eng = this;
    const    seen = {};
    const encache = function(url,filename,entry) {
        const ws = eng.hashes.createWriteStream();
        ws.on('error',function(err){eng.emit('error',new VError(err,"cacheFile failed"));});
        ws.on('stored',function(h) {
            eng.journalise('http',[url,h]);
            seen[url] = entry;
            if (cb)
                cb(h);
        });
        fs.createReadStream(filename).pipe(ws);
    };
    const    sn = seen[fn];
    const    st = fs.statSync(fn);
    const    en = {mtime:st.mtime,size:st.size};
    if (sn) {
        if (st.size!==sn.size || st.mtime.getTime()!==sn.mtime.getTime()) // has base file changed?
            encache(fn,fn,en);
    } else
        encache(fn,fn,en);
};

Engine.prototype._loadWorld = function(wrldHash,jrnlHash) {
    const  eng = this;
    let lineNo = 1;
    util.readFileLinesSync(path.join(eng.prevalenceDir,'state','world'),function(line) {
        switch (lineNo++) {
        case 1:
            eng.syshash = util.deserialise(line);
            return true;
        case 2: {
            const root = util.deserialise(line);
            eng.chrjs.setRoot(root.chrjs);
            eng.git = root.git;
            eng._rng.seed = root.rng.seed;
            eng._rng.engine.seed(root.rng.seed);
            eng._rng.engine.discard(root.rng.useCount);
            return false;
        }
        default:
            eng.emit('error',new VError("bad number of lines in world file for: %s",eng.prevalenceDir));
            return false;
        }
    });
    eng.emit('loaded',eng.syshash,wrldHash,jrnlHash);
};

Engine.prototype.closeConnection = function(portName) {
    const eng = this;
    const  io = eng.conns[portName];
    if (io && !io.closing) { // can be called more than once, allow for that
        io.closing = true;
        io.o.end(function() {
            eng.forgetConnection(portName);
        });
    }
};

Engine.prototype.forgetConnection = function(portName) {
    const io = this.conns[portName];
    this.connIndex[io.type] = _.without(this.connIndex[io.type],portName);
    delete this.conns[portName];
    this.emit('connectionClose',portName,io.type);
};

Engine.prototype.closeAllConnections = function(type,cb) {
    const   eng = this;
    const ports = eng.connIndex[type] || [];
    let       n = ports.length;
    if (n===0)
        cb();
    else {
        eng.on('connectionClose',function(port,type1) {
            if (type===type1)
                n--;
            if (n===0)
                cb();
        });
        ports.forEach(function(port) {
            eng.closeConnection(port);
        });
    }
};

Engine.prototype.connectionSummary = function() {
    const eng = this;
    const ans = {data:0,replication:0};
    for (const k in eng.conns) {
        const type = eng.conns[k].type;
        if (ans[type])
            ans[type]++;
        else
            ans[type] = 1;
    }
    return ans;
};

Engine.prototype.addConnection = function(portName,io,cookies) {
    const eng = this;
    if (!cookies)
        cookies = {};
    if (eng.conns[portName]!==undefined)
        throw new VError("already have connection for %j",portName);
    if (!this.connIndex[io.type])
        this.connIndex[io.type] = [];
    if (!io.headers)
        io.headers = {port:portName}; // can happen if using `createIO`
    eng.conns[portName] = io;
    eng.connIndex[io.type].push(portName);
    switch (io.type) {
    case 'admin':
        eng.administer(portName);
        break;
    case 'replication': {
        const st = fs.statSync(path.join(eng.prevalenceDir,'state','journal'));
        io = eng.conns[portName];
        io.o.write(['open',{journalSize:st.size}]);
        io.i.on('readable',function() {
            let js;
            while ((js=io.i.read())!==null) {
                if (js instanceof Array && js.length===2) {
                    if (js[0]==='sync') {
                        const src = js[1];
                        if (!src.host)
                            src.host = io.host;
                        eng.emit('slave',src);
                    }
                } else
                    eng.closeConnection(portName);
                break;
            }
        });
        io.o.on('finish',function() {
            eng.emit('slave',null);
        });
        break;
    }
    default: {
        let throttled = false;      // use this to ensure fairness
        io = eng.conns[portName];
        io.i.on('readable',function() {
            let js;
            while (!throttled && (js=io.i.read())!==null) {
                if (js instanceof Array && js.length===2 &&
                    (typeof js[0])==='string' && (typeof js[1])==='object') {
                    js.push(io.headers);
                    eng.update(js,function() {
                        throttled = false;
                        setImmediate(()=>{
                            io.i.emit('readable');
                        });
                    });
                    throttled = true;
                } else
                    eng.closeConnection(portName);
                break;
            }
        });
    }
    }
    eng.emit('connection',portName,io.type,cookies);
};

Engine.prototype._importConnection = function(portName,req) {
    if (req.path==='/admin' && !ip.isPrivate(req.socket.remoteAddress))
        return null;
    else
        return {port:portName};
};

Engine.prototype._addToExpressApp = function(app,server) {
    const      eng = this;
    const createIO = (ws,req,setup)=>{
        const portName = util.makeHttpPortName(req);
        const  headers = eng._importConnection(portName,req);
        let         io = {
            i:       null,
            o:       null,
            type:    null,
            headers: headers && _.omit(headers,_.isUndefined)
        };
        setup(io);
        if (io.headers===null)
            io = null;
        else if (typeof io.headers!=='object')
            throw new VError("bad headers object: %j",io.headers);
        if (io!==null) {
            io.i.on('error',()=>{
                io.i.end();
            });
            ws.on('message',msg=>{
                io.i.write(msg);
            });
            io.i.on('end',()=>{
                eng.closeConnection(portName);
            });
            io.o.on('error',()=>{
                io.o.end();
            });
            io.o.on('end',()=>{
                ws.close();
            });
            io.o.on('data',chunk=>{
                ws.send(chunk,err=>{
                    if (err) {
                        if (err.code==='EPIPE')
                            io.o.end();
                        else if (err.message==='This socket is closed') // Yuk.  Thanks, node.
                            console.log("write after close: %s",portName);
                        else if (eng.conns[portName] && eng.conns[portName].closing)
                            console.log("write during close: %s",portName);
                        else
                            throw err;
                    }
                });
            });
            ws.on('error',err=>{
                console.log("ws error: %j",err);
                ws.close();
            });
            ws.on('close',()=>{
                eng.closeConnection(portName);
            });
            eng.addConnection(portName,io,req.cookies);
        } else
            ws.close();
        return io;
    };
    expressWS(app,server,{wsOptions:eng.wsOptions});
    app.ws('/admin',(ws,req)=>{
        createIO(ws,req,io=>{
            io.type = 'admin';
            io.i    = new whiskey.JSONParseStream(); // ??? should this be util.serialise ???
            io.o    = new whiskey.StringifyJSONStream();
        });
    });
    app.ws('/replication/journal',(ws,req)=>{
        createIO(ws,req,io=>{
            io.type = 'replication';
            io.i    = new whiskey.LineStream(util.deserialise);
            io.o    = new whiskey.StringifyObjectStream(util.serialise);
            io.host = req.remoteAddress;
        });
    });
    eng.options.endpoints.forEach(ep=>{
        app.ws('/'+ep,(ws,req)=>{
            createIO(ws,req,io=>{
                io.type = ep;
                io.i    = new whiskey.JSONParseStream();
                io.o    = new whiskey.StringifyJSONStream();
            });
        });
    });
};

Engine.prototype.listenHttp = function(mode,port,done) {
    const  eng = this;

    eng.http = eng.options.createHttpServer(eng);

    eng.http.listen(port,eng.options.httpIsLocal && '127.0.0.1',()=>{
        eng.emit('listen','http',eng.http.address().port);
        done();
    });

    eng.http.once('close',()=>{
        eng.emit('unlisten','http',eng.options.ports.http);
    });
};

Engine.prototype.journaliseCodeSources = function(type,item2,always,cb) {
    const  eng = this;
    const srcs = eng.sources;
    cb = cb || (()=>{});
    if (always || Object.keys(eng.sources).length>0) {
        eng.sources = {};
        for (const fn in srcs)
            srcs[fn] = this.hashes.putFileSync(fn);
        this.journalise(type,[util.sourceVersion,item2,srcs],cb);
    } else
        cb(null);
};

Engine.prototype._allowUnsafe = function(op) {
    const eng = this;
    if (op.type==='www/private')
        return util.env!=='prod' && eng.options.privateTestUrls && ip.isPrivate(op.request.ip);
    return false;
};

Engine.prototype._become = function(mode,cb) {
    const eng = this;
    if (mode===eng.mode)
        cb();
    else switch (mode) {
        case 'master': {
            eng.startPrevalence(function(err) {
                if (err)
                    cb(err);
                else
                    eng.journaliseCodeSources('code',eng.options.businessLogic,false,err2=>{
                        if (err2)
                            cb(err2);
                        else
                            plugin.start(cb);
                    });
            });
            break;
        }
        case 'slave': {
            if (eng.masterUrl) {
                eng.on('ready',function(err) {
                    cb(err);
                });
                eng.replicateFrom(eng.masterUrl); // `startPrevalence` done in here
            } else
                cb(new VError("no replication URL specified"));
            break;
        }
        case 'idle': {
            switch (eng.mode) {
            case 'master': {
                const done = _.after(1+1+eng.options.endpoints.length,err=>{
                    if (err)
                        cb(err);
                    else
                        eng.stopPrevalence(false,cb);
                });
                if (eng.http)
                    eng.http.close();
                eng.closeAllConnections('replication',done);
                eng.options.endpoints.forEach(ep=>eng.closeAllConnections(ep,done));
                plugin.stop(done);
                break;
            }
            case 'slave':
                // `stopPrevalence` is done in replication code
                if (eng.replicateSock) {
                    eng.replicateSock.close();
                    eng.replicateSock = null;
                }
                cb();
                break;
            }
            break;
        }
        case 'broken': {
            cb();
            break;
        }
        default: {
            eng.emit('error',new VError("bad engine mode: %j",mode));
            return;
        }
    }
};

Engine.prototype.become = function(mode,cb) {
    const  eng = this;
    const port = eng.options.ports.http;
    const main = function() {
        if (mode!=='idle' && eng.mode!=='idle') { // change mode via intervening 'idle'
            eng._become('idle',function(err) {
                if (err) {
                    eng.emit('error',err);
                    cb(err);
                } else {
                    eng.mode = 'idle';
                    eng.become(mode);
                }
            });
        }
        else
            eng._become(mode,function(err) {
                if (err) {
                    eng.emit('error',err);
                    cb(err);
                } else {
                    eng.mode = mode;
                    eng.emit('mode',mode);
                    cb();
                }
            });
    };
    cb = cb || (()=>{});
    if (eng.mode==='broken') {
        const err = new Error("can't do anything, broken");
        eng.emit('error',err);
        cb(err);
    } else {
        eng.emit('become',mode);
        if (eng.http===null && (port || port===0)) {
            eng.listenHttp(mode,port,function(err) {
                if (err)
                    eng.emit('error',err);
                main();
            });
        } else
            main();
    }
};

Engine.prototype.breaks = function(err) {
    const eng = this;
    console.log(err);
    eng.become('broken');
};

Engine.prototype.journalise = function(type,data,cb) {
    const eng = this;
    let   err = null;
    if (eng.mode==='idle' && eng.journal===null)
        console.log("discarded idle log item: %j",data);
    else {
        const done = _.after(2,function() {
            if (err)
                eng.breaks(new VError(err,"journal write fails: "));
            if (cb) cb(err);
        });
        const  jit = [eng.timestamp(),type,data];
        const  str = util.serialise(jit)+'\n';
        eng.journal.write(str,'utf8',function(e) {
            err = err || e;
            if (err)
                done();
            else
                eng.journalFlush(done);
        });
        eng.broadcast(jit,'replication',done);
    }
};

Engine.prototype.broadcast = function(js,type,cb) {
    type = type || 'data';
    cb   = cb || function(){};
    const   eng = this;
    const ports = eng.connIndex[type] || [];
    const  done = _.after(1+ports.length,cb);
    ports.forEach(function(port) {
        eng.conns[port].o.write(js,done);
    });
    done();                     // for when ports.length===0 as _.after won't callback then
};

Engine.prototype.out = function(dest,json) {
    const eng = this;
    let     d;
    if (eng.options.debug)
        eng.emit('out',dest,json);
    if (json===null)
        ;           // discard
    else if (dest==='all') {
        eng.broadcast(json,'data');
    } else if (dest==='self') {
        const port = eng.active[2].port;
        const   io = eng.conns[port];
        if (io)
            io.o.write(json);
        else
            console.log("self gone away: %j",eng.active);
    } else if (dest==='server:') {
        if (Array.isArray(json) && json.length===2)
            switch (json[0]) {
            case '_disconnect':
                eng.closeConnection(json[1].port);
                break;
            default:
                console.log("bad server _msg: %j",json);
            }
        else
            console.log("bad server _msg: %j",json);
    } else if ((d=eng.conns[dest])) {
        if (d && d.o.readyState===d.o.OPEN)
            d.o.write(json);
        else if (d)
            console.log("connection not open for: %j",dest);
        else
            console.log("no connection found for: %j",dest);
    } else if (Array.isArray(dest)){
        const name = dest[0];
        const   pl = plugin.get(name);
        if (!pl)
            eng.emit('error',`unknown plugin: ${name}`);
        else
            pl.out(json,name,dest.slice(1));
    } else {
        const parts = dest.split(':');
        const name  = parts[0];
        const   pl  = plugin.get(name);
        if (!pl)
            eng.emit('error',`unknown plugin: ${name}`);
        else
            pl.out(json,parts[0],parts.slice(1).join(':'));
    }
};

Engine.prototype.update = function(data,cb) {
    const   eng = this;
    let     res;
    const done2 = _.after(2,function() {
        eng._nextTimestamp = null;
        eng.active         = null;
        if (cb) cb(null,res);
    });
    eng._nextTimestamp = eng._timestamp();
    eng.journalise('update',data,done2);
    eng.active = data;
    res        = eng.chrjs.update(data);
    // +++ we don't need to journalise if no changes!
    // +++ i.e. only one deletion, the incoming item
    // +++ extend `res` to track non-deterministic calls
    done2();
};

Engine.prototype.createUpdateStream = function() {
    const eng = this;
    return through2({objectMode:true},function(js,encoding,cb) {
        eng.update(js,cb);
    });
};


Engine.prototype.walkHashes = function(hash0,deepCheck,cb,done) {
    const eng = this;
    history.walkHashes(eng.hashes,hash0,deepCheck,cb,done);
};

Engine.prototype.checkHashes = function(hash0,cb) {
    const       eng = this;
    const deepCheck = true;
    eng.hashes.sanityCheck(cb);
    history.walkHashes(eng.hashes,hash0,deepCheck,function(err,h,what) {
        if (err)
            cb(new VError(err,"walkHashes(%s) fails: ",hash0));
        else if (!eng.hashes.contains(h))
            cb(new VError("can't find %s for %s",what,h));
    },
                   cb);
};

Engine.prototype.journalChain = function(cb) {
    // delivers list of journal files in chronological order
    const eng = this;
    history.getIndex(eng.prevalenceDir,{fix:true}); // +++ don't need whole history, just current
    history.journalChain(eng.prevalenceDir,null,cb);
};

Engine.prototype.buildHistoryStream = function(cb) {
    const eng = this;
    history.getIndex(eng.prevalenceDir,{fix:true}); // +++ don't need whole history, just current
    history.buildHistoryStream(eng.prevalenceDir,null,cb);
};

const createWorldReadStream = exports.createWorldReadStream = prevalenceDir=>{
    return fs.createReadStream(path.join(prevalenceDir,'state','world'))
        .pipe(new whiskey.JSONParseStream());
};

Engine.prototype.createWorldReadStream = function() {
    return createWorldReadStream(this.prevalenceDir);
};

Engine.prototype.replicateFile = function(filename,url,opts,callback) {
    const wstream = fs.createWriteStream(filename);
    http.get(url,function(response) { // +++ opts +++
        response.pipe(wstream);
        wstream.on('finish',callback);
    });
};

Engine.prototype.initReplication = function(url,init,callback) {
    const     eng = this;
    let       err = null;
    const gotFile = _.after(2,function() {
        callback(err);
    });
    eng.replicateFile(path.join(eng.prevalenceDir,'state','world'),url+'replication/state/world',{},function(e) {
        err = err || e;
        gotFile();
    });
    eng.replicateFile(path.join(eng.prevalenceDir,'state','journal'),url+'replication/state/journal',
            {headers:{range:util.format("bytes=0-%d",init.journalSize)},statusCode:[200,206]},
            function(e) {
                err = err || e;
                gotFile();
            });
};

Engine.prototype.replicateHashes = function(url,callback) {
    const               eng = this;
    let            jrnlhash;       // hash of the active journal
    let             syshash;       // `previous` hash of active journal
    let       businessLogic;       // from active journal
    const     hashSourceMap = {};  // `code` of active journal
    const            hashes = {};  // <hash> -> <what>
    const fetchHashIfAbsent = function(hash0,what,cb) {
        const filename = eng.hashes.makeFilename(hash0);
        try {
            fs.statSync(filename);
            cb(null);
        } catch (e) {
            if (e.code==='ENOENT') {
                eng.replicateFile(filename,url+'replication/hash/'+hash0,{},cb);
            } else
                cb(e);
        }
    };
    let              next;
    const   doJournalFile = hash0=>{
        history.walkJournalFile(eng.hashes.makeFilename(hash0),
                                true,
                                (err,h,what,x)=>{
                                    if (h!==null)
                                        hashes[h] = what;
                                    if (h===jrnlhash) { // !!! review this
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
    next = function() {
        const ks = Object.keys(hashes);
        if (ks.length===0) {
            eng.checkHashes(jrnlhash,
                            function(err) {
                                if (err)
                                    callback(err);
                                else
                                    callback(null,syshash,{bl:businessLogic,map:hashSourceMap});
                            });
        } else {
            const    h = ks[0];
            const what = hashes[h];
            fetchHashIfAbsent(h,what,function(e) {
                if (e)
                    callback(e);
                else {
                    eng.emit('fetch-hash',h,what);
                    delete hashes[h];
                    if (what==='journal')
                        doJournalFile(h);
                    else
                        next(); // +++ make this less recursive +++
                }
            });
        }
    };
    jrnlhash = eng.hashes.putFileSync(path.join(eng.prevalenceDir,'state','journal'));
    hashes[jrnlhash] = 'journal';
    next();
};

Engine.prototype._replicationSource = function() {
    return {ports:{http:this.options.ports.http}};
};

Engine.prototype.replicateFrom = function(url) { // `url` is base e.g. http://localhost:3000/
    const       eng = this;
    const    SockJS = require('ws');
    const      sock = new SockJS(url+'replication/journal');
    let     started = false;
    let     pending = [];
    const      tidy = false;
    const doJournal = function(js,cb) {
        const str = util.serialise(js)+'\n';
        eng.journal.write(str,'utf8',cb);
        if (js[1]==='update')
            eng.chrjs.update(js[2]);
    };

    eng.replicateSock = sock;

    sock.onopen = function() {
        const journalFile = path.join(eng.prevalenceDir,'state','journal');
        if (fs.existsSync(journalFile)) {
            const syshash = eng.hashes.putFileSync(journalFile);
            console.log("saving old journal as: %s",syshash);
        }
        if (fs.existsSync(path.join(eng.prevalenceDir,'state')))
            rmRF.sync(path.join(eng.prevalenceDir,'state'));
        fs.mkdirSync(path.join(eng.prevalenceDir,'state'));
    };

    sock.onmessage = function(e) {
        const js = util.deserialise(e.data);
        if (!started) {
            eng.initReplication(url,js[1],function(err) {
                if (err)
                    eng.emit('error',new VError(err,"initReplication failed: "));
                else {
                    eng.emit('replicated','state');
                    eng.replicateHashes(url,function(err1,syshash,hsm) {
                        if (err1)
                            eng.emit('error',new VError(err1,"failed to replicate hash store:"));
                        else {
                            eng.emit('replicated','hashes');
                            eng.emit('loaded','code');
                            eng.start();
                            eng.startPrevalence(function(err2) {
                                if (err2)
                                    eng.emit('error',err2);
                                else {
                                    eng.emit('loaded','state');
                                    const doPending = function() {
                                        if (pending.length!==0) {
                                            doJournal(pending.pop());
                                            doPending();
                                        }
                                    };
                                    doPending();
                                    pending     = null;
                                    eng.syshash = syshash;
                                    sock.send(util.serialise(['sync',eng._replicationSource()])+'\n');
                                    eng.emit('ready',syshash);
                                }
                            });
                        }
                    });
                }
            });
            started = true;
        } else if (pending!==null)
            pending.push(js);
        else
            doJournal(js);
    };

    sock.onerror = function(err) {
        util.error("!!! ws socket failed: %s",err);
    };

    sock.onclose = function(err) {
        eng.stopPrevalence(false,function(err1) {
            if (err1)
                eng.emit('error',err1);
            else {
                const syshash = eng.hashes.putFileSync(path.join(eng.prevalenceDir,'state','journal'));
                util.debug("replication socket closed %s: %s",(tidy?"nicely":"roughly"),syshash);
                eng.replicateSock = null;
                eng.become('idle',function() {
                    eng.emit('closed',tidy,syshash);
                });
            }
        });
    };
};

Engine.prototype.administer = function(port) {
    const eng = this;
    const  io = eng.conns[port];
    io.o.write(['engine',{syshash:   eng.syshash,
                          mode:      eng.mode,
                          masterUrl: eng.masterUrl,
                          connects:  eng.connectionSummary(),
                          ip:        ip.address(),
                          tag:       eng.tag}]);
    io.i.on('readable',function() {
        let js;
        while ((js=io.i.read())!==null) {
            try {
                switch (js[0]){
                case 'mode':
                    eng.become(js[1]);
                    break;
                case 'engine':
                    for (const k in js[1]) {
                        switch (k) {
                        case 'mode':
                            eng.become(js[1][k]);
                            break;
                        case 'masterUrl':
                            eng.masterUrl = js[1][k];
                            break;
                        }
                    }
                    break;
                case 'facts': {
                    const   evalFn = (code,args)=>{
                        if (code.indexOf('=>')===-1 && !code.startsWith('function'))
                            code = `(${args})=>${code}`;
                        return util.eval(code);
                    }
                    let      accum = js[1].accum===undefined ? [] : js[1].accum;
                    const   reduce = js[1].reduce ? evalFn(js[1].reduce,'a,j') : (a,j)=>a.concat([j]);
                    const pipeline = (stages=>{
                        stages = stages.map(([t,c])=>[t,evalFn(c,'j')]);
                        return j=>{
                            for (let i=0;i<stages.length;i++) {
                                const st = stages[i];
                                switch (st[0]) {
                                case 'map':    j = st[1](j);          break;
                                case 'filter': if (!st[1](j)) return; break;
                                default: throw new Error(`SNO`);
                                }
                            }
                            accum = reduce(accum,j);
                        }
                    })(js[1].pipeline||[]);
                    eng.chrjs._private.orderedFacts.forEach(f=>{
                        pipeline(f);
                    });
                    io.o.write(accum);
                    break;
                } }
            } catch (e) {
                console.log(e);
                eng.closeConnection(port);
            }
        }
    });
};

Engine.prototype.addPlugin = function(name,eps) { // back compatibility with 0.7.x for MCI
    plugin.add(name,plugin.makeOldPlugin(eps));
    plugin.instantiate(name);
};

Engine.prototype.getCounts = function() {
    const eng = this;
    return {
        facts:       eng.chrjs._private.orderedFacts.length,
        connections: eng.connectionSummary()
    };
};

Engine.prototype._bindGlobals = function() { // !!! CBB
    const eng = this;
    global.MalayaDate.now    = ()=>eng._nextTimestamp;
    global.MalayaMath.random = ()=>eng._rng.dist(eng._rng.engine);
};

exports.Engine  = Engine;
exports.express = express;
