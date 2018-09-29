"use strict";

const       VError = require('verror');
const         path = require('path');
const           fs = require('fs');
const           ip = require('ip');
const      express = require('express');
const   browserify = require('browserify');
const     reactify = require('reactify');
const       morgan = require('morgan');
const       recast = require('recast');
const         http = require('http');
const       minify = require('express-minify');
const cookieParser = require('cookie-parser');
const     jmespath = require('jmespath');

const         util = require('./util.js');
const       parser = require('./parser.js');
const     compiler = require('./compiler.js');

const createEmptyApp = exports.createEmptyApp = function(eng) {
    const app = express();
    if (eng.options.logging)
        app.use(morgan('dev'));
    if (eng.options.minify)
        app.use(minify());
    app.use(cookieParser());
    return app;
};

exports.populateApp = function(eng,app) {
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
                transform: [reactify],
                debug:     eng.options.debug
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

    for (const k in eng.options.bundles)
        app.get(k,doBrowserify(eng.options.bundles[k]));

    app.get(/.*\.(?:chrjs|malaya)$/,viaJSCache(function(filename,cb) {
        try {
            const chrjs = fs.readFileSync(filename);
            const    js = recast.print(compiler.compile(parser.parse(chrjs,{attrs:true}))).code;
            const  deps = {};
            deps[filename] = fs.statSync(filename);
            eng.cacheFile(filename);
            cb(null,[js,deps]);
        } catch (e) {
            cb(e);
        }
    }));

    app.get('/*.jsx',function(req,res) {
        return doBrowserify(path.join(webDir,req.path.substr(1)))(req,res);
    });

    // only for use in testing
    if (eng.options.privateTestUrls && util.env!=='prod') {
        // +++ safer to have a POST which dumps to disk then returns
        // +++ the filename
        app.get('/_private/facts',(req,res)=>{
            if (ip.isPrivate(req.ip)) {
                let ans;
                if (req.query.q) {
                    try {
                        ans = jmespath.search(eng.chrjs._private.orderedFacts,req.query.q);
                        res.writeHead(200,{'Content-Type':'application/json'});
                        res.write(util.serialise(ans));
                    } catch (e) {
                        res.writeHead(400,{'Content-Type':'text/plain'});
                        res.write(e.toString());
                    }
                } else {
                    ans = eng.chrjs._private.orderedFacts;
                    res.writeHead(200,{'Content-Type':'application/json'});
                    res.write(util.serialise(ans));
                }
            } else
                res.writeHead(404,{'Content-Type':'text/plain'});
            res.end();
        });
        app.get('/_private/counts',(req,res)=>{
            res.writeHead(200,{'Content-Type':'application/json'});
            res.write(JSON.stringify(eng.getCounts()));
            res.end();
        });
    }

    app.use(function(req,res,next) {
        if (req.method==='GET' || req.method==='HEAD') {
            try {
                const fn = path.join(webDir,req.path);
                if (fs.statSync(fn).isFile()) {
                    eng.cacheFile(fn,function(h) {
                        res.setHeader("Content-Type",express.static.mime.lookup(fn));
                        res.setHeader("ETag",        h);
                        res.status(200);
                        if (req.method==='GET')
                            res.sendFile(eng.hashes.makeFilename(h));
                    });
                } else {
                    res.status(403).end();
                }
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

exports.createServer = function(eng) {
    const  app = eng.options.populateHttpApp(eng,createEmptyApp(eng));
    const srvr = http.createServer(app);

    eng._addToExpressApp(app,srvr);

    return srvr;
};

exports.express = express;
