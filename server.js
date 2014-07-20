#!/usr/bin/env node

"use strict";

var argv = require('minimist')(process.argv.slice(2));

var  app = require('express')();
var http = require('http').Server(app);
var   fs = require('fs');
var sock = require('sockjs').createServer();
var prvl = require('./prevalence.js');
var   bl;
var port;
var fe3p = 5110;

var PREVALENCE_DIR = argv.d || '.prevalence';

if (argv.bl) { 			// business logic plugin
    bl = require(argv.bl);
} else {
    bl = require('./bl.js');	// toy version
}
bl = prvl.wrap(PREVALENCE_DIR,bl);

if (argv.p) {
    port = parseInt(argv.p);
} else {
    port = 3000;
}

if (argv.init) {
    try {
	fs.statSync(PREVALENCE_DIR);
	console.log("prevalence dir already exists, won't init");
	process.exit();
    } catch (err) {}
    fs.mkdirSync(PREVALENCE_DIR);
    bl.init();
    bl.open();
    bl.save();
    bl.close();
}
bl.open(PREVALENCE_DIR);
bl.load(bl.set_root,bl.update);

process.on('SIGINT',function() {
    bl.save();
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
	cmd:  function(js) {console.log("!!! one day, I'll handle "+JSON.stringify(js));}
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
	console.log('farewell, '+this.name);
	conns.remove(mc);
    });
}
conns.add = function(conn) {
    conns.push(conn);
    conn.on('cmd',function(js) {
	console.log("*** malaya cmd: "+JSON.stringify(js));
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
    console.log("*** couldn't remove "+x);
}
conns.broadcast = function(js) {
    for (var i=0;i<this.length;i++) {
	this[i].write(js);
    }
}

sock.on('connection',function(conn) {
    console.log("connection from: "+conn.remoteAddress+":"+conn.remotePort);
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
    console.log('http listening on *:'+port);
});

if (fe3p) {
    var fe3 = require('./fe3.js').createServer({});
    fe3.on('connect',function(mc) {
	console.log("new FE3");
	conns.add(mc);
	mc.on('close',function() {
	    console.log("farewell FE3");
	    conns.remove(mc);
	});
    });
    fe3.on('listening',function() {
	console.log('fe3  listening on *:'+fe3p);
    });
    fe3.listen(fe3p);
}
