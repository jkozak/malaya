// streaming engine for chrjs store, implements prevalence

// use thus:

//  var eng = new Engine(<dir>,<chrjs>,<opts>)
//  eng.start()
//  eng.become('master'|'slave')
//     ... happy server time
//  eng.stop()

// constructor <opts>:
//        init: <initter>                 to init the prevalence dir
//       ports: {<protocol>:<int>,...}    (for master)
//   masterUrl: <url>                     (for slave)

"use strict";

//var    assert = require('assert');
var         _ = require('underscore');
var    events = require('events');
var    VError = require('verror');
var      util = require('./util.js');
var      path = require('path');
var        fs = require('fs');
var      rmRF = require('rimraf');
var timestamp = require('monotonic-timestamp');
var   express = require('express');
var    morgan = require('morgan');
var    recast = require('recast');
var      http = require('http');
var    sockjs = require('sockjs');

var    parser = require('./parser.js');
var  compiler = require('./compiler.js');
var   whiskey = require('./whiskey.js');
var      hash = require('./hash.js');
var      lock = require('./lock.js');

exports.makeInertChrjs = function(opts) {
    opts = opts || {tag:null};
    return {              // behaves like `store {}`;
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
            var ans = {err:null,adds:[this.t],dels:[],refs:[]};
            this.facts[this.t++] = f;
            return ans;
        },
        update:   function(f) {
            var ans = this.add(f);
            ans.refs[this.t-1] = f;
            return ans;
        },
        get size()    {return Object.keys(this.facts).length;}
    };
};

var Engine = exports.Engine = function(options) {
    events.EventEmitter.call(this);

    var eng = this;

    options           = options || {};
    options.dir       = options.dir || process.cwd();
    options.webDir    = options.webDir || path.join(options.dir,'www');
    options.tag       = options.tag;
    options.ports     = options.ports || {http:3000};
    
    eng.prevalenceDir = options.prevalenceDir || path.join(options.dir,'.prevalence');
    eng.syshash       = null;
    eng.chrjs         = options.chrjs || exports.makeInertChrjs();
    eng.hashes        = null;                    // hash store
    eng.options       = _.omit(options,'chrjs'); // avoid persisting chrjs object later
    eng.mode          = null;                    // 'master' | 'slave' 
    eng.conns         = {};                      // <port> -> {i:<in-stream>,o:<out-stream>}
    eng.http          = null;                    // express http server
    eng.journal       = null;                    // journal write stream
    eng.replicatees   = [];                      // portNames to replicate to

    eng.journalFlush  = function(cb){cb(null);}; // flush journal

    eng.chrjs.tag     = options.tag;
  
    return eng;
};

util.inherits(Engine,events.EventEmitter);

Engine.prototype._saveWorld = function() {
    var dirCur = path.join(this.prevalenceDir,"state");
    var dirNew = path.join(this.prevalenceDir,"state-NEW");
    var dirOld = path.join(this.prevalenceDir,"state-OLD");
    var syshash = null;
    syshash = this.hashes.putFileSync(path.join(dirCur,"/journal"));
    rmRF.sync(dirNew);
    fs.mkdirSync(dirNew);
    fs.writeFileSync( path.join(dirNew,"world"),  util.serialise(syshash)+'\n');
    fs.appendFileSync(path.join(dirNew,"world"),  util.serialise(this.chrjs.getRoot())+'\n');
    fs.writeFileSync( path.join(dirNew,"journal"),util.serialise([timestamp(),'previous',syshash])+'\n');
    rmRF.sync(dirOld);
    fs.renameSync(dirCur,dirOld);
    fs.renameSync(dirNew,dirCur);
    this.emit('saved',syshash);
    return syshash;
};

Engine.prototype.stop = function(quick) {
    var   eng = this;
    var done2 = _.after(2,function(){eng.emit('stopped');});

    eng.journal.on('finish',function() {
        done2();
    });
    
    eng.journal.end();
    eng.journal = null;
    if (!quick) 
        eng._saveWorld();

    done2();
    
    lock.unlockSync(path.join(this.prevalenceDir,'lock'));
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

Engine.prototype._init = function(data) {
    var eng = this;
    try {
        fs.statSync(eng.prevalenceDir);
        throw new VError("prevalence dir %s already exists, won't init",eng.prevalenceDir);
    } catch (err) {
        if (err.code==='ENOENT') {
            try {
                var    h = hash(util.hashAlgorithm);
                var hdir = path.join(eng.prevalenceDir,'hashes');
                fs.mkdirSync(eng.prevalenceDir);
                fs.mkdirSync(path.join(eng.prevalenceDir,'state'));
                h.init(hdir);
            } catch (err1) {
                try {
                    rmRF.sync(eng.prevalenceDir);
                } catch (e) {}
                throw new VError(err1,"failed to init");
            }
        } else if (err.code)
            throw new VError(err,"prevalence dir %s odd, won't init",eng.prevalenceDir);
        else
            throw err;
    }
};

Engine.prototype._ensureStateDir = function() { // after calling successfully, `state` might be loadable
    var eng = this;
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

Engine.prototype.save = function() {
    var     eng = this;
    var syshash = eng._saveWorld();
    eng._loadWorld();
    return syshash;
};

Engine.prototype.init = function(data) {
    var      eng = this;
    var jrnlFile = path.join(eng.prevalenceDir,'state','journal');
    eng._init(data);
    eng._ensureStateDir();
    eng._makeHashes();
    fs.writeFileSync(jrnlFile,util.serialise([timestamp(),'init',eng.options])+'\n');
    eng.syshash = eng.save();
};

Engine.prototype.start = function() { //N.B. does not update the prevalence dir or its contents (except `lock`)
    var      eng = this;
    var jrnlFile = path.join(eng.prevalenceDir,'state','journal');
    lock.lockSync(path.join(eng.prevalenceDir,'lock'),eng.options);
    eng._ensureStateDir();
    eng._makeHashes();
    eng._loadWorld();
    util.readFileLinesSync(jrnlFile,function(l) { // replay 
        var js = util.deserialise(l);
        switch (js[1]) {
        case 'update':
            eng.chrjs.update(js);
            break;
        case 'previous':
            if (js[2]!==eng.syshash)
                throw new VError("syshash  wanted: %s  got: %s",eng.syshash,js[2]);
            break;
        }
    });
    eng.journal = fs.createWriteStream(jrnlFile,{flags:'a'});
};

Engine.prototype.cacheFile = function(fn,cb) {
    var     eng = this;
    var    seen = {};
    var encache = function(url,filename,entry) {
        var ws = eng.hashes.createWriteStream();
        ws.on('error',function(err){eng.emit('error',new VError(err,"cacheFile failed"));});
        ws.on('stored',function(h) {
            eng.journalise('http',[url,h]);
            seen[url] = entry;
            cb(h);
        });
        fs.createReadStream(filename).pipe(ws);
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
    return [sn.hash,eng.hashes.makeFilename(sn.hash)];
};

Engine.prototype._loadWorld = function() {
    var    eng = this;
    var lineNo = 1;
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

Engine.prototype.createExpressApp = function() {
    var     eng = this;
    var     app = express();
    var jscache = {};   // req.path -> [compiled,stat]
    var  webDir = eng.options.webDir;

    if (eng.options.logging)
        app.use(morgan(":remote-addr - :remote-user [:date] \":method :url HTTP/:http-version\" :status :res[content-length] \":referrer\" \":user-agent\" :res[etag]"));
    
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
    
    app.get('/',function(req,res) {
        res.redirect('/index.html');
    });
    
    if (eng.options.bowerDir)
        app.use('/bower',express.static(eng.options.bowerDir));

    app.get('/*.chrjs',function(req,res) { // +++ eventually use disk cache +++
        var filename = path.join(webDir,req.path.substr(1));
        try {
            var  stat = fs.statSync(filename);
            var entry = jscache[req.path];
            if (entry) {
                if (stat.size===entry[1].size ||
                    stat.mtime.getTime()===entry[1].mtime.getTime() ) {
                    res.setHeader("Content-Type","application/javascript");
                    res.status(200).send(entry[0]);
                    return;
                }
            }
            var chrjs = fs.readFileSync(filename);
            var    js = recast.print(compiler.compile(parser.parse(chrjs,{attrs:true}))).code;
            jscache[req.path] = [js,stat];
            res.setHeader("Content-Type","application/javascript");
            res.status(200).send(js);
            eng.cacheFile(filename); // ensure chrjs source gets journalised+cached
            return;
        } catch (e) {
            if (e.code==='ENOENT') {
                delete jscache[req.path];
                res.status(404).send();
                return;
            } else
                eng.emit('error',new VError(e,"compile of %s failed",filename));
        }
    });
    
    app.use(function(req,res,next) {
        if (req.method==='GET' || req.method==='HEAD') {
            try {
                var fn = path.join(webDir,req.path);
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
        
    app.use(express.static(webDir));

    return app;
};

Engine.prototype.closeConnection = function(portName) {
    var eng = this;
    var  io = eng.conns[portName];
    io[1].end(function() {
        eng.forgetConnection(portName);
    });
};

Engine.prototype.forgetConnection = function(portName) {
    delete this.conns[portName];
    this.emit('connectionClose',portName);
};

Engine.prototype.addConnection = function(portName,io) {
    var eng = this;
    if (eng.conns[portName]!==undefined)
        throw new VError("already have connection for %j",portName);
    eng.conns[portName] = io;
    // +++ move code from below to here +++
    throw new Error("NYI");
};

Engine.prototype.masterListen = function(done) {
    var  eng = this;
    var port = eng.options.ports.http;
    var sock = sockjs.createServer({log:function(severity,text) {
        if (['error','info'].indexOf(severity)!==-1)
            console.log(text);
    }});

    eng.http = http.Server(eng.createExpressApp());

    sock.on('connection',function(conn) {
        var portName = util.format("ws://%s:%s%s",conn.remoteAddress,conn.remotePort,conn.prefix);
        var  istream = new whiskey.JSONParseStream();
        var  ostream = new whiskey.StringifyJSONStream();
        conn.pipe(istream);
        ostream.pipe(conn);
        var io = [istream,ostream];
        eng.conns[portName] = io;
        io[0].on('error',function() {
            eng.closeConnection(portName);
        });
        io[0].on('end',function() {
            eng.closeConnection(portName);
        });
        io[1].on('error',function() {
            eng.closeConnection(portName);
        });
        switch (conn.prefix) {
        case '/data':
            io[0].on('readable',function() {
                for (;;) {
                    var js = io[0].read();
                    if (js!==null) {
                        if (js instanceof Array && js.length===2) {
                            js.push({port:portName});
                            eng.update(js);
                        } else {
                            eng.closeConnection(portName);
                        }
                    } else
                        break;
                }
            });
            break;
        case '/replication/journal':
            eng.addReplicationConnection(conn);
            break;
        case '/admin':
            eng.addAdminConnection(conn);
            break;
        }
        eng.emit('connection',portName);
    });
    
    sock.installHandlers(eng.http,{prefix:'/data'});
    sock.installHandlers(eng.http,{prefix:'/replication/journal'});
    sock.installHandlers(eng.http,{prefix:'/admin'});

    eng.http.listen(port,function() {
        eng.emit('listen','http',port,sock);
        done();
    });
};

Engine.prototype.startComms = function(mode,done) {
    if (mode==='master')
        this.masterListen(done);
    else
        throw new VError("NYI");
};

Engine.prototype.become = function(mode) {
    var eng = this;
    switch (mode) {
    case 'master': {
        if (!eng.journal)
            throw new VError("can't become master, journal not started");
        break;
    }
    case 'slave': {
        // +++ replicate world, hashes from master +++
        // +++ eng._loadWorld when done +++
        // +++ subscribe to journal stream +++
        break;
    }
    default:
        this.emit('error',new VError("bad engine mode: %j",mode));
        return;
    }
    eng.chrjs.on('error',function(err){eng.emit(new VError(err,"chrjs error: "));});
    eng.startComms(mode,function(){
        eng.emit('mode',mode);
        eng.mode = mode;
    });
};

Engine.prototype.createJournalReadStream = function(options) {
    return fs.createReadStream(path.join(this.prevalenceDir,'state','journal'))
        .pipe(new whiskey.JSONParseStream());
};

Engine.prototype.journalise = function(type,data,cb) {
    var  eng = this;
    var  err = null;
    var done = _.after(1+eng.replicatees.length,function() {
        if (cb) cb(err);
    });
    var  str = util.serialise([timestamp(),type,data])+'\n';
    cb = cb || function(){};
    eng.journal.write(str,'utf8',function(e) {
        err = err || e;
        if (err)
            done();
        else 
            eng.journalFlush(done);
    });
    eng.replicatees.forEach(function(r) {
        r.write(str,done);
    });
};

Engine.prototype.broadcast = function(js,prefix) {
    prefix = prefix || '/data';
    var engine = this;
    _.keys(engine.conns).forEach(function(port) {
        if (util.endsWith(port,prefix))
            engine.conns[port][1].write(js);
    });
};

Engine.prototype.update = function(data,cb) {
    var   eng = this;
    var   res;
    var done2 = _.after(2,function() {
        res.adds.forEach(function(t) {
            var add = res.refs[t];
            if (add[0]==='_output') {
                if (add.length!==3)
                    eng.emit('error',util.format("bad _output: %j",add));
                else if (add[2]===null)
                    ;           // discard
                else if (add[1]==='all')
                    eng.broadcast(add[2]);
                else if (add[1]==='self')
                    eng.conns[data[2].port][1].write(add[2]);
                else
                    eng.conns[add[1]][1].write(add[2]);
            }
        });
        if (cb) cb(null,res);
    });
    eng.journalise('update',data,done2);
    res = eng.chrjs.update(data);
    done2();
};

Engine.prototype.createFullJournalReadStream = function() {
    //var engine = this;
    // +++ build map
    throw new VError('NYI');
};

Engine.prototype.createWorldReadStream = function() {
    return fs.createReadStream(path.join(this.prevalenceDir,'state','world'))
        .pipe(new whiskey.JSONParseStream());
};

Engine.prototype.walkJournalFile = function(filename,deepCheck,cb,done) {
    var   i = 0;
    util.readFileLinesSync(filename,function(line) {
        var js = util.deserialise(line);
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
                for (var k in js[2][2]) 
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
    var eng = this;
    // the structure of the hash store is a linear chain of journal files with
    // other items hanging off them to a depth of one.  A recursive transversal
    // is not needed to scan this exhaustively.
    for (var h=hash0;h;) {
        /* eslint no-loop-func:0 */
        var fn = eng.hashes.makeFilename(h);
        cb(hash,"journal");
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
            cb(null,hash1,what);
        });
    }
    if (done!==undefined)
        done();
};

Engine.prototype.checkHashes = function(hash0,cb,done) {
    var       eng = this;
    var deepCheck = true;
    eng.hashes.sanityCheck(cb);
    eng.walkHashes(hash0,deepCheck,function(err,h,what) {
        if (err)
            cb(new VError(err,"walkHashes(%s) fails: ",hash0));
        else if (!eng.hashes.contains(h))
            cb(new VError("can't find %s for %s",what,h));
    },
                  done);
};

exports.Engine = Engine;
