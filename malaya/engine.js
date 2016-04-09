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
const multistream = require('multistream');
const   basicAuth = require('basic-auth');
const     express = require('express');
const  browserify = require('browserify');
const    reactify = require('reactify');
const      morgan = require('morgan');
const      recast = require('recast');
const        http = require('http');
const      sockjs = require('sockjs');
const          ip = require('ip');
const      minify = require('express-minify');

const      parser = require('./parser.js');
const    compiler = require('./compiler.js');
const     whiskey = require('./whiskey.js');
const        hash = require('./hash.js');
const        lock = require('./lock.js');


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
        get size()    {return Object.keys(this.facts).length;}
    };
    if (util.env==='test')
        obj._private = {
            get facts() {return obj.facts;},   // be compatible with real chrjs
            get orderedFacts() {
                const keys = _.keys(obj.facts).map(function(t){return parseInt(t);});
                return keys.sort(function(p,q){return p-q;}).map(function(t){return obj.facts[t];});
            }
        };
    return obj;
};

let   sources = {};
const compile = exports.compile = function(source) {
    if (source) {
        const children = module.children.slice(0);
        const    chrjs = require(path.resolve(source));
        const    loads = _.difference(module.children,children);
        if (loads.length>1)
            throw new VError("compiling %s added %s modules",source,loads.length);
        for (const i in loads)
            sources[loads[i].filename] = null;
        chrjs.reset();          // because `require` caches values
        return chrjs;
    } else
        return null;
};

const Engine = exports.Engine = function(options) {
    events.EventEmitter.call(this);

    const eng = this;

    options           = options || {};
    options.dir       = options.dir || process.cwd();
    options.webDir    = options.webDir || path.join(options.dir,'www');
    options.tag       = options.tag;
    options.ports     = options.ports || {http:3000};
    options.bundles   = options.bundles || {};
    options.minify    = options.minify===undefined ? util.env!=='test' : options.minify;

    compiler.debug    = options.debug;

    eng.prevalenceDir = options.prevalenceDir || path.join(options.dir,'.prevalence');
    eng.syshash       = null;
    eng.chrjs         = compile(options.businessLogic) || exports.makeInertChrjs();
    eng.hashes        = null;                    // hash store
    eng.options       = options;
    eng.mode          = 'idle';                  // 'master' | 'slave' | 'idle'
    eng.conns         = {};                      // <port> -> {i:<in-stream>,o:<out-stream>,type:<type>}
    eng.connIndex     = {};                      // <type> -> [<port>,...]
    eng.http          = null;                    // express http server
    eng.journal       = null;                    // journal write stream
    eng.timestamp     = options.timestamp || require('monotonic-timestamp');
    eng.magicOutputs  = {};                      // <headTag> -> fn|null
    eng.journalFlush  = function(cb){cb(null);}; // flush journal
    eng.chrjs.tag     = options.tag;
    eng.masterUrl     = eng.options.masterUrl;
    eng.replicateSock = null;
    eng.active        = null;                    // update being processed

    eng.chrjs.on('error',function(err){eng.emit(new VError(err,"chrjs: "));});

    eng.on('mode',function(mode) {
        eng.broadcast(['mode',mode],'admin');
    });
    eng.on('connection',function(portName,type) {
        eng.broadcast(['connection',portName,type,true],'admin');
    });
    eng.on('connectionClose',function(portName,type) {
        eng.broadcast(['connection',portName,type,false],'admin');
    });

    return eng;
};


util.inherits(Engine,events.EventEmitter);

Engine.prototype._saveWorld = function() {
    // +++ prevalence.batch (i.e. we are currently using `state-NEW`) +++
    const  dirCur = path.join(this.prevalenceDir,"state");
    const  dirNew = path.join(this.prevalenceDir,"state-NEW");
    const  dirOld = path.join(this.prevalenceDir,"state-OLD");
    const syshash = this.hashes.putFileSync(path.join(dirCur,"/journal"));
    rmRF.sync(dirNew);
    fs.mkdirSync(dirNew);
    fs.writeFileSync( path.join(dirNew,"world"),  util.serialise(syshash)+'\n');
    fs.appendFileSync(path.join(dirNew,"world"),  util.serialise(this.chrjs.getRoot())+'\n');
    fs.writeFileSync( path.join(dirNew,"journal"),util.serialise([this.timestamp(),'previous',syshash])+'\n');
    rmRF.sync(dirOld);
    fs.renameSync(dirCur,dirOld);
    fs.renameSync(dirNew,dirCur);
    this.emit('saved',syshash);
    return syshash;
};

Engine.prototype.stopPrevalence = function(quick,cb) {
    const eng = this;
    if (eng.journal) {          // not true if opts.readonly set
        const journal = eng.journal;
        eng.journal = null;
        // 'close' event for `fs.WriteStream` is undocumented _but_
        // cannot do dir renames in `_saveWorld` until journal closed.
        journal.on(util.onWindows ? 'close' : 'finish',function() {
            if (!quick)
                eng._saveWorld();
            if (cb) cb();
        });
        journal.end();
    }
};

Engine.prototype.stop = function(unlock,cb) {
    unlock = unlock===undefined ? true : unlock;
    const eng = this;
    if (unlock)
        lock.unlockSync(path.join(eng.prevalenceDir,'lock'));
    if (cb) cb();
};

Engine.prototype._ensureStateDirectory = function() {
    try {
        fs.statSync(path.join(this.prevalenceDir,'state'));
    } catch (err1) {
        try {
            fs.renameSync(path.join(this.prevalenceDir,'state-NEW'),path.join(this.prevalenceDir,'state'));
            return true;
        } catch (err2) {
            try {
                fs.renameSync(path.join(this.prevalenceDir,'state-OLD'),path.join(this.prevalenceDir,'state'));
                return true;
            } catch (err3) {
                this.emit('error',new Error("can't find a state dir to open"));
            }
        }
    }
    return false;
};

Engine.prototype.loadData = function(data,cb) {
    const eng = this;
    if (data==='-') {                      // stdin, stream of [<type>,{<field>:value>,...}]
        process.stdin
            .pipe(whiskey.JSONParseStream())
            .on('end',cb)
            .pipe(eng.createUpdateStream());
    } else if (/.json$/.test(data)) {      // single json array-of-arrays
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
    }
    else
        cb(new VError("can't handle data: %s",data));
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
    this.hashes = hash(util.hashAlgorithm).makeStore(path.join(this.prevalenceDir,'hashes'));
};

Engine.prototype.init = function(data) {
    const      eng = this;
    const jrnlFile = path.join(eng.prevalenceDir,'state','journal');
    eng._init();
    eng._ensureStateDir();
    eng._makeHashes();
    fs.writeFileSync(jrnlFile,util.serialise([eng.timestamp(),'init',eng.options])+'\n');
    eng.syshash = eng._saveWorld();
};

Engine.prototype.start = function(cb) {
    const eng = this;
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
    eng._loadWorld();
    const residue = util.readFileLinesSync(jrnlFile,function(l) { // replay
        const js = util.deserialise(l);
        switch (js[1]) {
        case 'update':
            eng.chrjs.update(js[2]);
            break;
        case 'previous':
            if (js[2]!==eng.syshash)
                throw new VError("syshash  wanted: %s  got: %s",eng.syshash,js[2]);
            break;
        }
        return true;
    });
    if (residue) {
        const jrnlSize = fs.statSync(jrnlFile).size;
        console.log("truncating journal file to lose junk: %j",residue);
        fs.truncateSync(jrnlFile,jrnlSize-residue.length);
    }
    eng.journal = opts.readonly ? null : fs.createWriteStream(jrnlFile,{flags:'a'});
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

Engine.prototype._loadWorld = function() {
    const   eng = this;
    let lineNo = 1;
    util.readFileLinesSync(path.join(eng.prevalenceDir,'state','world'),function(line) {
        switch (lineNo++) {
        case 1:
            eng.syshash = util.deserialise(line);
            return true;
        case 2:
            eng.chrjs.setRoot(util.deserialise(line));
            return false;
        default:
            eng.emit('error',new VError("bad number of lines in world file for: %s",eng.prevalenceDir));
        }
    });
    eng.emit('loaded',eng.syshash);
};

Engine.prototype._logon = null;

Engine.prototype.express = function() {
    return express();
};

Engine.prototype.createExpressApp = function() {
    const     eng = this;
    const     app = eng.express();
    const jscache = {};   // req.path -> [compiled,stat]
    const  webDir = eng.options.webDir;

    const viaJSCache = function(build) {
        return function(req,res) { // +++ eventually use disk cache +++
            const filename = path.join(webDir,req.path.substr(1));
            try {
                const entry = jscache[req.path];
                if (entry) {
                    let clean = true;
                    for (const fn in entry[1]) {
                        const stat1 = fs.statSync(fn);
                        const stat2 = entry[1][fn];
                        if (stat1.size!==stat2.size || stat1.mtime.getTime()!==stat2.mtime.getTime() ) {
                            clean = false;
                            break;
                        }
                    }
                    if (clean) {
                        res.setHeader("Content-Type","application/javascript");
                        res.status(200).send(entry[0]);
                        return;
                    }
                }
            } catch (e) {
                if (e.code==='ENOENT') {
                    delete jscache[req.path];
                    res.status(404).send();
                } else
                    eng.emit('error',new VError(e,"compile of %s failed",filename));
                return;
            }
            build(filename,function(err,en) {
                if (err)
                    res.status(500).send(err);
                else {
                    jscache[req.path] = en;
                    res.setHeader("Content-Type","application/javascript");
                    res.status(200).send(en[0]);
                }
            });
        };
    };

    const doBrowserify = function(files) {
        files = Array.isArray(files) ? files : [files];
        return viaJSCache(function(_fn,cb) {
            let          js = '';
            const filesRead = [];
            const         b = browserify(files,{
                extensions:['.jsx','.chrjs','.malaya'],
                transform: [reactify]
            });
            b.on('file',function(f,id,parent){
                if (!/node_modules/.test(f)) // presume node_module contents are stable
                    filesRead.push(f);
            });
            b.bundle()
                .on('error',function(err) {
                    console.log("!!! bundle fail: %s",err);
                    cb(err);
                })
                .on('data',function(chunk) {
                    js += chunk.toString();
                })
                .on('end',function() {
                    const deps = {};
                    filesRead.forEach(function(f) {
                        deps[f] = fs.statSync(f);
                        eng.cacheFile(f);
                    });
                    cb(null,[js,deps]);
                });
        });
    };

    if (eng.options.logging)
        app.use(morgan('dev'));

    if (eng.options.minify)
        app.use(minify());

    app.get('/replication/hashes',function(req,res) {
        fs.readdir(eng.prevalenceDir+'/hashes',function(err,files) {
            if (err) {
                res.writeHead(500,"can't list hashes directory");
            } else {
                res.writeHead(200,{'Content-Type':'application/json'});
                res.write(JSON.stringify(files));
            }
            res.end();
        });
    });
    app.use('/replication/hash', express.static(path.join(eng.prevalenceDir,'/hashes')));
    app.use('/replication/state',express.static(path.join(eng.prevalenceDir,'/state')));

    if (eng._logon)             // ??? does this work? ???
        app.use('/data',function(req,res,next) {
            const creds = basicAuth(req);
            const  port = eng.makeHttpPortName(req.connection,'/data');
            const  conn = eng.conns[port];
            if (!creds) {
                res.writeHead(401,{'WWW-Authenticate':'Basic realm="example"'});
                res.end();
            } else if (!conn || !conn.logon)
                eng._logon(creds,port,function(err,ok) {
                    if (err) {
                        res.status(500); // !!! check this !!!
                        res.end();
                    } else if (ok) {
                        eng.conns[port].logon = true;
                        next();
                    }
                    else {
                        res.writeHead(401,{'WWW-Authenticate':'Basic realm="example"'});
                        res.end();
                    }
                });
        });

    app.get('/',function(req,res) {
        res.redirect('/index.html');
    });

    for (const k in eng.options.bundles)
        app.get(k,doBrowserify(eng.options.bundles[k]));

    app.get('/*.chrjs',viaJSCache(function(filename,cb) {
        try {
            const chrjs = fs.readFileSync(filename);
            const    js = recast.print(compiler.compile(parser.parse(chrjs,{attrs:true}))).code;
            const  deps = {};
            deps[filename] = fs.statSync(filename);
            eng.cacheFile(filename);
            cb(null,[js,deps]);
        } catch(e) {
            cb(e);
        }
    }));

    app.get('/*.jsx',function(req,res) {
        return doBrowserify(path.join(webDir,req.path.substr(1)))(req,res);
    });

    app.use(function(req,res,next) {
        if (req.method==='GET' || req.method==='HEAD') {
            try {
                const fn = path.join(webDir,req.path);
                eng.cacheFile(fn,function(h) {
                    res.setHeader("Content-Type",express.static.mime.lookup(fn));
                    res.setHeader("ETag",        h);
                    res.status(200);
                    if (req.method==='GET')
                        res.sendFile(eng.hashes.makeFilename(h));
                });
                return;
            } catch (e) {
                if (e.code!=='ENOENT')
                    eng.emit('error',new VError(e,"hash read failed"));
            }
        }
        next();
    });

    return app;
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

Engine.prototype.addConnection = function(portName,io) {
    const eng = this;
    if (eng.conns[portName]!==undefined)
        throw new VError("already have connection for %j",portName);
    if (!this.connIndex[io.type])
        this.connIndex[io.type] = [];
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
    case 'data': {
        let throttled = false;      // use this to ensure fairness
        io = eng.conns[portName];
        io.i.on('readable',function() {
            let js;
            while (!throttled && (js=io.i.read())!==null) {
                if (js instanceof Array && js.length===2) {
                    js.push({port:portName});
                    eng.update(js,function() {
                        throttled = false;
                        setInterval(function() {
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
    eng.emit('connection',portName,io.type);
};

Engine.prototype.makeHttpPortName = function(conn,prefix) { // nodejs http connection here
    prefix = prefix || conn.prefix;
    return util.format("ws://%s:%s%s",conn.remoteAddress,conn.remotePort,prefix);
};

Engine.prototype.listenHttp = function(mode,port,done) {
    const  eng = this;
    const sock = sockjs.createServer({log:function(severity,text) {
        if (['error','info'].indexOf(severity)!==-1)
            util.error(text);
    }});

    eng.http = http.Server(eng.createExpressApp());

    sock.on('connection',function(conn) {
        const portName = eng.makeHttpPortName(conn);
        let         io = {i:null,o:null,type:null};
        switch (conn.prefix) {
        case '/data':
            io.type = 'data';
            io.i    = new whiskey.JSONParseStream();
            io.o    = new whiskey.StringifyJSONStream();
            break;
        case '/replication/journal':
            io.type = 'replication';
            io.i    = new whiskey.LineStream(util.deserialise);
            io.o    = new whiskey.StringifyObjectStream(util.serialise);
            io.host = conn.remoteAddress;
            break;
        case '/admin':
            if (conn.remoteAddress==='127.0.0.1') {
                io.type = 'admin';
                io.i    = new whiskey.JSONParseStream();
                io.o    = new whiskey.StringifyJSONStream();
            }
            else {
                io = null;
                conn.end();
            }
            break;
        default:
            // +++ jump around breaking things +++
        }
        if (eng.mode!=='master' && io && io.type!=='admin')
            io = null;
        if (io) {
            conn.pipe(io.i);
            io.o.pipe(conn);
            io.i.on('error',function() {        // +++ this should be in addConnection
                io.i.end();
            });
            io.i.on('end',function() {
                eng.closeConnection(portName);
            });
            io.o.on('error',function() {
                io.o.end();
            });                                 // +++ to here
            conn.on('close',function() {
                eng.closeConnection(portName);
            });
            eng.addConnection(portName,io);
        } else
            conn.end();
    });

    sock.installHandlers(eng.http,{prefix:'/data'});
    sock.installHandlers(eng.http,{prefix:'/replication/journal'});
    sock.installHandlers(eng.http,{prefix:'/admin'});

    eng.http.listen(port,function() {
        eng.emit('listen','http',eng.http.address().port);
        done();
    });
};

Engine.prototype.journaliseCodeSources = function(type,item2,always,cb) {
    const srcs = sources;
    if (always || _.keys(sources).length>0) {
        sources = {};
        for (const fn in srcs)
            srcs[fn] = this.hashes.putFileSync(fn);
        this.journalise(type,[util.sourceVersion,item2,srcs],cb);
    } else
        if (cb) cb(null);
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
                    eng.journaliseCodeSources('code',eng.options.businessLogic,false,cb);
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
        case 'idle':
            switch (eng.mode) {
            case 'master': {
                const done = _.after(2,function(err) {
                    if (err)
                        cb(err);
                    else
                        eng.stopPrevalence(true,cb);
                });
                eng.closeAllConnections('data',done);
                eng.closeAllConnections('replication',done);
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
        default:
            eng.emit('error',new VError("bad engine mode: %j",mode));
            return;
        }
};

Engine.prototype.become = function(mode) {
    const  eng = this;
    const port = eng.options.ports.http;
    const main = function() {
        if (mode!=='idle' && eng.mode!=='idle') { // change mode via intervening 'idle'
            eng._become('idle',function(err) {
                if (err)
                    eng.emit('error',err);
                else {
                    eng.mode = 'idle';
                    eng.become(mode);
                }
            });
        }
        else
            eng._become(mode,function(err) {
                if (err)
                    eng.emit('error',err);
                else {
                    eng.mode = mode;
                    eng.emit('mode',mode);
                }
            });
    };
    eng.emit('become',mode);
    if (eng.http===null && (port || port===0)) {
        eng.listenHttp(mode,port,function(err) {
            if (err)
                eng.emit('error',err);
            main();
        });
    } else
        main();
};

Engine.prototype.journalise = function(type,data,cb) {
    const eng = this;
    let   err = null;
    if (eng.mode==='idle' && eng.journal===null)
        console.log("discarded idle log item: %j",data);
    else {
        const done = _.after(2,function() {
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

Engine.prototype.addMagicOutput = function(tag) {
    const eng = this;
    // Automatically remove anything called [tag,...] at end of each
    // update, optionally calling `fn` on it
    // This subsumes the `_output` mechanism.
    // +++ it should move to the compiler to avoid exporting
    // +++ store-damaging primitives
    eng.magicOutputs[tag] = true;
};

Engine.prototype.out = function(dest,json) {
    const eng = this;
    if (json===null)
        ;           // discard
    else if (dest==='all')
        eng.broadcast(json,'data');
    else if (dest==='self') {
        const port = eng.active[2].port;
        const io = eng.conns[port];
        if (io)
            io.o.write(json);
        else
            console.log("self gone away: %j",eng.active);
    }
    else {
        const d = eng.conns[dest];
        if (d)
            d.o.write(json);
        else
            console.log("no connection found for: %j",dest);
    }
};

Engine.prototype._callOut = function(d,j) {
    this.out(d,j);
    return true;                // else execution will stop
};

Engine.prototype.update = function(data,fn,cb) {
    const   eng = this;
    let     res;
    const done2 = _.after(2,function() {
        res.adds.forEach(function(t) {
            const add = res.refs[t];
            if (Object.keys(eng.magicOutputs).length>0) {
                if (eng.magicOutputs[add[0]]) {
                    eng.chrjs._del(t);
                    if (fn)
                        fn(add);
                }
            } else if (add[0]==='_output') {
                if (add.length!==3)
                    eng.emit('error',util.format("bad _output: %j",add));
                else
                    eng.out(add[1],add[2]);
            }
        });
        eng.active = null;
        if (cb) cb(null,res);
    });
    if (Object.keys(eng.magicOutputs).length===0) // trad style only has two args
        cb = fn;
    eng.journalise('update',data,done2);
    eng.active = data;
    GLOBAL.out = eng._callOut.bind(eng);
    res        = eng.chrjs.update(data);
    GLOBAL.out = undefined;
    done2();
};

Engine.prototype.createUpdateStream = function() {
    const eng = this;
    return through2({objectMode:true},function(js,encoding,cb) {
        eng.update(js,cb);
    });
};

Engine.prototype.buildHistoryStream = function(cb) {
    const eng = this;
    eng.journalChain(function(err,hs) {
        if (err) throw cb(err);
        cb(null,multistream(hs.map(function(h) {
            if (h==='journal')
                return fs.createReadStream(path.join(eng.prevalenceDir,'state','journal'));
            else
                return function(h1){return fs.createReadStream(eng.hashes.makeFilename(h1));}(h);
        })));
    });
};

Engine.prototype.createWorldReadStream = function() {
    return fs.createReadStream(path.join(this.prevalenceDir,'state','world'))
        .pipe(new whiskey.JSONParseStream());
};

Engine.prototype.walkJournalFile = function(filename,deepCheck,cb,done) {
    let i = 0;
    util.readFileLinesSync(filename,function(line) {
        const js = util.deserialise(line);
        if (i++===0) {
            switch (js[1]) {
            case 'init':
                break;
            case 'previous':
                cb(null,js[2],"journal");
                break;
            default:
                cb(new VError("bad log file hash: %s",hash));
            }
        } else if (deepCheck) {
            switch (js[1]) {
            case 'code':
                if (js[2][2][js[2][1]]) // hash from the bl src code filename
                    cb(null,js[2][2][js[2][1]],'bl',js[2][1]);
                for (const k in js[2][2])
                    cb(null,js[2][2][k],"source code",k);
                break;
            case 'transform':
                if (js[2][2][js[2][1]]) // hash from the transform src code filename
                    cb(null,js[2][2][js[2][1]],'transform',js[2][1]);
                for (const k in js[2][2])
                    cb(null,js[2][2][k],"source code",k);
                break;
            case 'http':
                cb(null,js[2][1],"http");
                break;
            }
        }
        return deepCheck; // only read whole file if checking `code` items
    });
    if (done!==undefined)
        done();
};

Engine.prototype.walkHashes = function(hash0,deepCheck,cb,done) {
    const eng = this;
    // the structure of the hash store is a linear chain of journal files with
    // other items hanging off them to a depth of one.  A recursive transversal
    // is not needed to scan this exhaustively.
    for (let h=hash0;h;) {
        /* eslint no-loop-func:0 */
        const fn = eng.hashes.makeFilename(h);
        cb(null,h,"journal");
        h = null;
        eng.walkJournalFile(fn,deepCheck,function(err,hash1,what) {
            if (err)
                cb(new VError("walkJournalFile fails: %s",h));
            else if (what==='journal') {
                if (h!==null)
                    cb(new VError("multiple journal backlinks in: %s",hash1));
                else
                    h = hash1;
            }
        });
    }
    if (done!==undefined)
        done();
};

Engine.prototype.checkHashes = function(hash0,cb) {
    const       eng = this;
    const deepCheck = true;
    eng.hashes.sanityCheck(cb);
    eng.walkHashes(hash0,deepCheck,function(err,h,what) {
        if (err)
            cb(new VError(err,"walkHashes(%s) fails: ",hash0));
        else if (!eng.hashes.contains(h))
            cb(new VError("can't find %s for %s",what,h));
    },
                   cb);
};

Engine.prototype.journalChain = function(cb) { // delivers list of journal files in chronological order
    const eng = this;
    const  hs = [];
    eng.walkJournalFile(path.join(eng.prevalenceDir,'state','journal'),
                        false,
                        function(err,x,what) {
                            if (err)
                                cb(err);
                            else if (what==='journal')
                                eng.walkHashes(x,
                                               false,
                                               function(err1,h,what1) {
                                                   if (what1==='journal')
                                                       hs.push(h);
                                               },
                                               function(err1) {
                                                   if (err1)
                                                       cb(err1);
                                                   else {
                                                       hs.reverse();
                                                       hs.push('journal');
                                                       cb(null,hs);
                                                   } } );
                        } );
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
        } catch(e) {
            if (e.code==='ENOENT') {
                eng.replicateFile(filename,url+'replication/hash/'+hash0,{},cb);
            } else
                cb(e);
        }
    };
    let              next;
    const   doJournalFile = function(hash0) {
        eng.walkJournalFile(eng.hashes.makeFilename(hash0),
                        true,
                        function(err,h,what,x) {
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
    next = function() {
        const ks = _.keys(hashes);
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
    const    SockJS = require('node-sockjs-client');
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
            console.log("*** admin: %j",js);
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
                }
            } catch (e) {
                console.log(e);
                eng.closeConnection(port);
            }
        }
    });
};


exports.Engine  = Engine;
exports.express = express;
