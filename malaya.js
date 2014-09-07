"use strict";

var    argv = require('minimist')(process.argv.slice(2));

var    util = require('./util.js');

var      fs = require('fs');
var    prvl = require('./prevalence.js');

var   chrjs = require("./chrjs.js");  // adds support for .chrjs files

function MalayaConnection(conn,options) {
    var passwd = options.passwd;
    var mc     = this;
    var events = {
	data:  function(js) {},
	cmd:   function(js) {util.error("!!! one day, I'll handle %s",js);},
	close: function() {}
    };

    this.name = null;
    function write(js) {
	conn.write(JSON.stringify(js));
    };
    function end(msg) {
	write(['ERR',msg]);
	conn.end();
    };

    this.write = write;
    this.on    = function(what,handler) {events[what] = handler;};
    this.end   = function() {throw new Error("WriteMe - close connection");}

    conn.on('data',function(data) {
	var js;
	try {
	    js = JSON.parse(data);
	} catch (err) {}
	if (js===undefined) {
	    end("junk");
	}
	events.cmd(['EXEC',js,{user:this.name}]);
    });
    conn.on('close',function() {
	events.close();
	conns.remove(mc);
    });
}

exports.createServer = function(opts) {
    var port    = opts.port;
    var fe3p    = opts.fe3Port;
    var opts    = opts;
    var http    = null;
    var fe3     = null;
    var bl      = null;		// business logic
    var syshash = null;		// at startup
    var conns   = [];
    var events  = {
	makeConnection: function(mc)   {},
	loseConnection: function(mc)   {},
	loaded:         function(hash) {},
	closed:         function(hash) {}
    };

    var server = {
	on: function(name,fn) {events[name] = fn;},
	run: function() {
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
	    events.loaded(syshash);

	    if (bl.transform!==undefined) {
		bl.transform();
		bl.save()
		process.exit(0);
	    }

	    process.on('SIGINT',function() {
		server.close();
		process.exit(1);
	    });
	    process.on('SIGQUIT',function() {
		process.exit(1);
	    });
	    process.on('SIGHUP',function() {
		bl.save();
	    });
	    process.on('exit',function(code) {
	    });

	    conns.add = function(conn) {
		conns.push(conn);
		conn.on('cmd',function(js) {
		    util.debug("*** malaya cmd: %j",js);
		    conn.write(do_cmd(js))
		    // +++
		});
	    }
	    conns.remove = function(x) {
		for (var i=0;i<this.length;i++)
		    if (this[i]===x) {
			this.splice(i,1);
			return;
		    }
		util.debug("*** couldn't remove %j",x);
	    }
	    conns.broadcast = function(js) {
		for (var i=0;i<this.length;i++) {
		    this[i].write(js);
		}
	    }

	    function do_cmd(cmd) {
		// +++ detect if query or update and maybe skip journalisation +++
		return bl.update(cmd);
	    }

	    setInterval(function() {
		do_cmd(['EXEC',[],{user:'%ticker'}]);
	    },1000);

	    if (port) {
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
			// +++ pass a `cmd` arg through in `options` below +++
			// +++ this to invoke a prevalent handler +++
			// +++ which in turn invokes the core business logic +++
			var mc = new MalayaConnection(conn,{passwd:{jk:[''],
								    di:[''] } });
			events.makeConnection(mc); // +++ should loseConnection somewhere +++
			mc.on('close',function() {
			    events.loseConnection(mc);
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
		});
	    }
	    if (fe3p) {
		fe3 = require('./fe3.js').createServer({});
		fe3.on('connect',function(mc) {
		    conns.add(mc);
		    events.makeConnection(mc);
		    mc.on('close',function() {
			events.loseConnection(mc);
			conns.remove(mc);
		    });
		});
		fe3.on('listening',function() {
		    util.debug('fe3  listening on *:%s',fe3p);
		});
		fe3.listen(fe3p);
	    }
	},
	close: function() {
	    if (http)
		http.close();
	    if (fe3)
		fe3.close();
	    var conns_ = conns.slice();  // copy list, original will be updated
	    for (var i in conns_)
		conns_[i].end();
	    var syshash = bl.save();
	    http = fe3 = null;
	    events.closed(syshash);
	}
    };
    return server;
};

exports.close = function() {
    // +++ close all servers
    
};
