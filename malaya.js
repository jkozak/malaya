"use strict";
/*eslint-disable no-process-exit*/

var          _ = require('underscore');
var     events = require('events');
var     assert = require('assert');
var         fs = require('fs');
var       rmRF = require("rimraf");
var       temp = require('temp');
var       path = require('path');
var     recast = require('recast');

var       util = require('./util.js');
var prevalence = require('./prevalence.js');
var     parser = require("./parser.js");
var   compiler = require("./compiler.js");  // adds support for .chrjs files

temp.track();

function WsConnection(conn,server) {
    var ee = new events.EventEmitter();

    this.name = null;
    var write = function(js) {
        conn.write(JSON.stringify(js));
    };
    var end = function(msg) {
        conn.end();
    };

    this.port  = util.format('websocket://%s:%d/',conn.remoteAddress,conn.remotePort);
    this.write = write;
    this.on    = function(what,handler) {ee.on(what,handler);};
    this.end   = function() {conn.end();};

    conn.on('data',function(data) {
        var js;
        try {
            js = JSON.parse(data);
        } catch (err) {}
        if (js===undefined)
            end("junk");
        server.command(js,conn);
    });

    conn.on('close',function() {
        ee.emit('close');
    });

    return this;
}

exports.createServer = function(opts) {
    var http      = null;
    var bl        = null;         // business logic
    var syshash   = null;         // at startup
    var conns     = {};
    var ee        = new events.EventEmitter();
    var prvl      = opts.prevalence || prevalence();
    var tempDir   = temp.mkdirSync();
    var adminConn = null;

    if (opts.debug)
        compiler.debug = true;

    var server = {
        on:  function(what,handler) {
            if (['fire','queue-rule','query-done','add','del'].indexOf(what)!==-1)
                bl.on(what,handler);
            else if (what==='compile')
                compiler.on(what,handler);
            else
                ee.on(what,handler);
        },

        get size() {
            return bl.size;
        },

        getFact: function(t) {
            return bl.getFact(t);
        },
        
        start: function() {
            if (opts.prevalence) {
                bl = opts.prevalence.wrapper;
            } else if (opts.slave) {
                /* eslint no-empty:0 */
            } else {
                if (opts.init)
                    try {
                        fs.statSync(opts.prevalenceDir);
                        throw new util.Fail(util.format("prevalence state dir %s already exists, won't init",
                                                        opts.prevalenceDir ));
                    } catch (err) {
                        if (err instanceof util.Fail)
                            throw err;
                    }
                try {
                    if (opts.init) {
                        fs.mkdirSync(opts.prevalenceDir);
                        bl = prvl.wrap(opts.prevalenceDir,opts.businessLogic,opts);
                        bl.init();
                        bl.open();
                        bl.save();
                        bl.close();
                    } else
                        bl = prvl.wrap(opts.prevalenceDir,opts.businessLogic,opts);
                    bl.open(opts.prevalenceDir);
                    syshash = bl.load(bl.setRoot,bl.update);
                    ee.emit('loaded',syshash);
                } catch(e) {
                    if (opts.init)
                        this.uninit();
                    throw e;
                }

                if (bl.transform!==undefined) { // !!! moribund !!!
                    bl.transform();
                    bl.save();
                    process.exit(0);
                }
            }
        },

        startReplication: function() {
            prvl.replicateFrom(opts.prevalenceDir,opts.slave);
        },

        transform: function(blt) { // `blt` implements bl transform protocol (transform, no update/query)
            throw new Error('NYI');
            // !!! this is a sketch of [b8cb5936e7df0244] !!!
            //     needs a target store to save into
            //     how does prevalence wrapping work here?
            //     (must stash the transform code)
        },

        uninit: function() {
            if (!opts.init)
                throw new util.Fail("not initialising, won't uninit");
            if (bl)
                bl.close();
            bl = null;
            rmRF.sync(opts.prevalenceDir);
        },

        makeExpressApp: function() {
            var express = require('express');
            var     app = express();
            var jscache = {};   // req.path -> [compiled,stat]

            if (opts.logging)
                app.use(require('morgan')(":remote-addr - :remote-user [:date] \":method :url HTTP/:http-version\" :status :res[content-length] \":referrer\" \":user-agent\" :res[etag]"));
            
            prvl.installHandlers(app, {prefix:'/replication'});
            
            app.get('/',function(req,res) {
                res.redirect('/index.html');
            });
            app.use('/temp',express.static(tempDir));
            if (opts.bowerDir)
                app.use('/bower',express.static(opts.bowerDir));

            if (opts.webDir) {
                app.get('/*.chrjs',function(req,res) { // +++ eventually use disk cache +++
                    try {
                        var filename = path.join(opts.webDir,req.path.substr(1));
                        var     stat = fs.statSync(filename);
                        var    entry = jscache[req.path];
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
                        if (opts.audit)
                            prvl.cacheFile(filename); // ensure chrjs source gets journalised+cached
                        return;
                    } catch (e) {
                        if (e.code==='ENOENT') {
                            delete jscache[req.path];
                            res.status(404).send();
                            return;
                        } else
                            throw e;
                    }
                });
                if (opts.audit)
                    app.use(prvl.createExpressMiddleware(opts.webDir));
                app.use(express.static(opts.webDir));
            }

            return app;
        },

        addAdminConnection: function(conn) {
            var port = util.format('websocket://%s:%d/',conn.remoteAddress,conn.remotePort);
            if (conn.remoteAddress!=='127.0.0.1' || adminConn!==null)
                conn.close();
            else {
                ee.emit('makeAdminConnection',port);
                adminConn = conn;
                conn.on('data',function(data) {
                    server.adminCommand(data);
                });
                conn.on('close',function() {
                    adminConn = null;
                    ee.emit('loseAdminConnection',port);
                });
            }
        },
        adminCommand: function(cmd) {
            console.log("*** adminCommand: %j",cmd);
        },

        port: null,
        app:  null,
        listen: function (port,done) {
            var sock = require('sockjs').createServer({log:function(severity,text) {
                if (['error','info'].indexOf(severity)!==-1)
                    console.log(text);
            }});

            server.app = server.makeExpressApp();
            
            http = require('http').Server(server.app);

            sock.on('connection',function(conn) {
                switch (conn.prefix) {
                case '/data':
                    util.debug("client connection from: %s:%s to %s",conn.remoteAddress,conn.remotePort,conn.prefix);
                    server.addConnection(new WsConnection(conn,server));
                    break;
                case '/replication/journal':
                    util.debug("replication connection from: %s:%s",conn.remoteAddress,conn.remotePort);
                    prvl.addReplicationConnection(conn);
                    break;
                case '/admin':
                    util.debug("admin connection from: %s:%s",conn.remoteAddress,conn.remotePort);
                    server.addAdminConnection(conn);
                    break;
                }
            });
            
            sock.installHandlers(http,{prefix:'/data'});
            sock.installHandlers(http,{prefix:'/replication/journal'});
            sock.installHandlers(http,{prefix:'/admin'});

            ee.emit('listen',port,sock);

            http.listen(port,function() {
                server.port = http.address().port;
                util.debug('http listening on *:%s',server.port);
                done();
            });
        },
        
        addConnection: function(conn) {
            assert.equal(conns[conn.port],undefined);
            conns[conn.port] = conn;
            ee.emit('makeConnection',conn);
            conn.on('close',function() {
                delete conns[conn.port];
                ee.emit('loseConnection',conn);
            });
        },
        
        close: function() {
            var conns_ = Object.keys(conns);
            conns_.forEach(function(p) {
                conns[p].end();
            });
            if (http)
                http.close();
            var syshash1 = bl.save();
            http = null;
            bl.close();
            ee.emit('closed',syshash1);
        },
        
        broadcast: function(js,filter) {
            _.keys(conns).forEach(function(port) {
                var conn = conns[port];
                if (!filter || filter(conn))
                    conn.write(js);
            });
        },
        
        command: function(js,conn) { // `conn` can be omitted, probably init-time only though
            assert(_.isArray(js));
            assert.equal(js.length,2);
            assert.equal(typeof js[0],'string');
            var command;
            if (conn===undefined)
                command = [js[0],js[1]];
            else
                command = [js[0],js[1],{port:conn.port}];
            ee.emit('command',command);
            var res = bl.update(command);
            if (conn!==undefined)
                res.adds.forEach(function(t) {
                    var add = res.refs[t];
                    if (add[0]==='_output') {
                        assert.equal(add.length,3);
                        if (add[2]===null)
                            ; // discard
                        else if (add[1]==='all')
                            server.broadcast(add[2]);
                        else if (add[1]==='self')
                            conn.write(add[2]);
                        else
                            conns[add[1]].write(add[2]);
                    }
                });
            return res;
        },

        query: function(js,conn) {
            assert(_.isArray(js));
            assert(js.length>0);
            assert.equal(typeof js[0],'string');
            ee.emit('query',js);
            return bl.query(js);
        },
        
        queries: function(js,conn) { // batch of queries, executed simultaneously
            var   t = null;
            var ans = [];
            assert(_.isArray(js));
            assert(js.length>0);
            js.forEach(function(js1) {
                var res = server.query(js1,conn);
                if (t===null)
                    t = res.t;
                else
                    assert.equal(t,res.t);
                ans.push(res.result);
            });
            return [ans,{t:t}];
        },

        ready: function() {
            ee.emit('ready');
        }
    };
    if (util.env==='test')
        server._private = {
            get bl()      {return bl;},
            get facts()   {return bl._private.bl._private.facts;},
            get tempDir() {return tempDir;}
        };
    return server;
};

exports.close = function() {
    // +++ close all servers
};
