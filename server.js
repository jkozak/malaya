#!/usr/bin/env node

"use strict";

var argv = require('minimist')(process.argv.slice(2));

var util = require('./util.js');

var  app = require('express')();
var http = require('http').Server(app);
var   fs = require('fs');
var sock = require('sockjs').createServer();
var prvl = require('./prevalence.js');
var port;
var fe3p = 5110;
var opts = {audit:true};

var PREVALENCE_DIR = argv.d || '.prevalence';

if (argv.p) {
    port = parseInt(argv.p);
} else {
    port = 3000;
}

// +++ require charjes here or earlier +++

var bl;
if (argv.init) {
    try {
	fs.statSync(PREVALENCE_DIR);
	util.error("prevalence state dir already exists, won't init");
	process.exit();
    } catch (err) {}
    fs.mkdirSync(PREVALENCE_DIR);
    bl = prvl.wrap(PREVALENCE_DIR,argv.bl,opts);
    bl.init();
    bl.open();
    bl.save();
    bl.close();
} else {
    bl = prvl.wrap(PREVALENCE_DIR,argv.bl,opts);
}
bl.open(PREVALENCE_DIR);
bl.load(bl.set_root,bl.update);

if (bl.transform!==undefined) {
    bl.transform();
    bl.save()
    process.exit(0);
}

process.on('SIGINT',function() {
    bl.save();
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

app.get('/',function(req,res) {
    res.sendfile('index.html');
});

var conns = [];
function MalayaConnection(conn,options) {
    var passwd = options.passwd;
    var mc     = this;
    var events = {
	data: function(js) {},
	cmd:  function(js) {util.error("!!! one day, I'll handle %s",js);}
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

    conn.on('data',function(data) {
	var js;
	try {
	    js = JSON.parse(data);
	} catch (err) {}
	if (js===undefined) {
	    end("junk");
	}
	events['cmd'](['EXEC',js,{user:this.name}]);
    });
    conn.on('close',function() {
	util.debug('farewell, %s',this.name);
	conns.remove(mc);
    });
}
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

sock.on('connection',function(conn) {
    util.debug("connection from: %s:%s",conn.remoteAddress,conn.remotePort);
    // +++ pass a `cmd` arg through in `options` below +++
    // +++ this to invoke a prevalent handler +++
    // +++ which in turn invokes the core business logic +++
    new MalayaConnection(conn,{passwd:{jk:[''],
				       di:[''] } });
});

function do_cmd(cmd) {
    // +++ detect if query or update and maybe skip journalisation +++
    return bl.update(cmd);
}

setInterval(function() {
    do_cmd(['EXEC',[],{user:'%ticker'}]);
},1000);

sock.installHandlers(http,{prefix:'/data'});

http.listen(port,function() {
    util.debug('http listening on *:%s',port);
});

if (fe3p) {
    var fe3 = require('./fe3.js').createServer({});
    fe3.on('connect',function(mc) {
	util.debug("new FE3");
	conns.add(mc);
	mc.on('close',function() {
	    util.debug("farewell FE3");
	    conns.remove(mc);
	});
    });
    fe3.on('listening',function() {
	util.debug('fe3  listening on *:%s',fe3p);
    });
    fe3.listen(fe3p);
}
