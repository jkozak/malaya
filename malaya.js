"use strict";

var    argv = require('minimist')(process.argv.slice(2));

var       _ = require('underscore');
var  events = require('events');
var  assert = require('assert');
var      fs = require('fs');

var    util = require('./util.js');

var    prvl = require('./prevalence.js');


require("./compiler.js");  // adds support for .chrjs files

function WsConnection(conn,server) {
    var mc = this;
    var ee = new events.EventEmitter();
 
    this.name = null;
    function write(js) {
	conn.write(JSON.stringify(js));
    };
    function end(msg) {
	write(['ERR',msg]);
	conn.end();
    };

    this.port  = util.format('websocket://%s:%d/',conn.remoteAddress,conn.remotePort);
    this.write = write;
    this.on    = function(what,handler) {ee.on(what,handler);};
    this.end   = function() {conn.end();}

    conn.on('data',function(data) {
	var js;
	try {
	    js = JSON.parse(data);
	} catch (err) {}
	if (js===undefined) {
	    end("junk");
	}
	server.command(js,conn);
    });
    conn.on('close',function() {
	ee.emit('close');
    });
    return this;
}

exports.createServer = function(opts) {
    var http    = null;
    var bl      = null;		// business logic
    var syshash = null;		// at startup
    var conns   = {};
    var ee      = new events.EventEmitter();

    var server = {
	on:  function(what,handler) {ee.on(what,handler);},
	
	start: function(done) {
	    if (opts.init) {
		try {
		    fs.statSync(opts.prevalenceDir);
		    util.error("prevalence state dir already exists, won't init");
		    process.exit();
		} catch (err) {}
		fs.mkdirSync(opts.prevalenceDir);
		bl = prvl.wrap(opts.prevalenceDir,opts.businessLogic,opts);
		bl.init();
		bl.open();
		bl.save();
		bl.close();
	    } else {
		bl = prvl.wrap(opts.prevalenceDir,opts.businessLogic,opts);
	    }
	    bl.open(opts.prevalenceDir);
	    syshash = bl.load(bl.set_root,bl.update);
	    ee.emit('loaded',syshash);

	    if (bl.transform!==undefined) {
		bl.transform();
		bl.save()
		process.exit(0);
	    }
	},

	transform: function(blt) { // `blt` implements bl transform protocol (transform, no update/query)
	    throw new Error('NYI');
	    // !!! this is a sketch of [b8cb5936e7df0244] !!!
	    //     needs a target store to save into
	    //     how does prevalence wrapping work here?
	    //     (must stash the transform code)
	},

	listen: function (port,done) {
	    var express = require('express');
	    var     app = express();
	    var    sock = require('sockjs').createServer();
	    
	    http = require('http').Server(app);
	    
	    if (opts.logging)
		app.use(require('morgan')(":remote-addr - :remote-user [:date] \":method :url HTTP/:http-version\" :status :res[content-length] \":referrer\" \":user-agent\" :res[etag]"));
	    
		sock.on('connection',function(conn) {
		    switch (conn.prefix) {
		    case '/data':
			util.debug("client connection from: %s:%s to %s",conn.remoteAddress,conn.remotePort,conn.prefix);
			var mc = new WsConnection(conn,server);
			ee.emit('makeConnection',mc);
			server.addConnection(mc);
			mc.on('close',function() {
			    ee.emit('loseConnection',mc);
			});
			break;
		    };
		});
	    
	    sock.installHandlers(http,{prefix:'/data'});
	    
	    prvl.installHandlers(app, {prefix:'/replication'});
	    
	    app.get('/',function(req,res) {
		res.redirect('/index.html');
	    });
	    if (opts.audit)
		app.use(prvl.createExpressMiddleware(opts.webDir));
	    app.use(express.static(opts.webDir));
	    
	    http.listen(port,function() {
		util.debug('http listening on *:%s',port);
		done();
	    });
	},
	
	addConnection: function(conn) {
	    assert.equal(conns[conn.port],undefined);
	    conns[conn.port] = conn;
	    conn.on('close',function() {
		delete conns[conn.port];
	    });
	},
	
	close: function() {
	    if (http)
		http.close();
	    var conns_ = Object.keys(conns);
	    for (var p in conns_)
		conns_[p].end();
	    var syshash = bl.save();
	    http = null;
	    bl.close();
	    ee.emit('closed',syshash);
	},
	
	broadcast: function(js,filter) {
	    _.keys(conns).forEach(function(port) {
		var conn = conns[port];
		if (!filter || filter(conn))
		    conn.write(js);
	    });
	},
	
	command: function(js,conn) {
	    assert(js instanceof Array);
	    assert.equal(js.length,2);
	    assert.equal(typeof js[0],'string');
	    var command = [js[0],js[1],{port:conn.port}];
	    ee.emit('command',command);
	    var res = bl.update(command);
	    if (opts['auto_output'] && _.any(res.adds,function(add){return add[0]==='_output';})) {
		bl.update(['_take-outputs']).dels.forEach(function(output) {
		    assert.equal(output.length,3);
		    if (output[2]===null)
			;	// discard
		    else if (output[1]==='all')
			server.broadcast(output[2]);
		    else if (output[1]=='self')
			conn.write(output[2]);
		    else
			conns[output[1]].write(output[2]);
		});
	    }
	    return res;
	},
	
	query: function(js,conn) {
	    assert(js instanceof Array);
	    assert(js.length>0);
	    assert.equal(typeof js[0],'string');
	    ee.emit('query',js)
	    return bl.query(js);
	},
	
	queries: function(js,conn) { // batch of queries, executed simultaneously
	    var   t = null;
	    var ans = [];
	    assert(js instanceof Array);
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
	}
    };
    if (util.env==='test')
	server._private = {
	    get bl()    {return bl;},
	    get facts() {return bl._private.bl._private.facts;}
	};
    return server;
};

exports.close = function() {
    // +++ close all servers
};
