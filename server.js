"use strict";

var argv = require('minimist')(process.argv.slice(2));

var  app = require('express')();
var http = require('http').Server(app);
var   fs = require('fs');
var sock = require('sockjs').createServer();
var prvl = require('./prevalence.js');
var   bl;
var port;

var PREVALENCE_DIR = 'prevalence';

if (argv.bl) { 			// business logic plugin
    bl = require(argv.bl);
} else {
    bl = require('./bl.js');	// toy version
}

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
    prvl.init(PREVALENCE_DIR);
    bl.init();
    prvl.open(PREVALENCE_DIR);
    prvl.save(bl.get_root());
    prvl.close();
}
prvl.open(PREVALENCE_DIR);
prvl.load(bl.set_root,bl.process);

process.on('SIGINT',function() {
    prvl.save(bl.get_root());
    process.exit(1);
});
process.on('SIGHUP',function() {
    prvl.save(bl.get_root());
});
process.on('exit',function(code) {
});

app.get('/',function(req,res) {
    res.sendfile('index.html');
});

var users = {};
function MalayaConnection(conn,options) {
    var name   = null;
    var passwd = options.passwd;
    var cmd    = options.cmd || function(js) {console.log("!!! one day, I'll handle "+JSON.stringify(js));};
    var mc     = this;
    
    function write(js) {
	conn.write(JSON.stringify(js));
    };
    function end(msg) {
	write(['ERR',msg]);
	conn.end();
    };

    this.write = write;

    conn.on('data',function(data) {
	var js;
	try {
	    js = JSON.parse(data);
	} catch (err) {}
	if (js===undefined) {
	    end("junk");
	}
	else if (name===null) {
	    if (js.length!=3 || js[0]!='I_AM') {
		end("ill-formed");
	    } else {
		var userinfo = passwd[js[1]]; // +++ replace with a QUERY +++
		if (userinfo && userinfo[0]==js[2]) {
		    name        = js[1];
		    users[name] = mc;
		    console.log("hello, "+name);
		    write(['HI',name]);
		}
		else 
		    end("bad user/pwd");
	    }
	} else {
	    cmd(['EXEC',js,{user:name}]);
	}
    });
    conn.on('close',function() {
	if (name) {
	    console.log('farewell, '+name);
	    delete users[name];
	}
    });
}
function broadcast(js) {
    for (var u in users) {
	users[u].write(js);
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

setInterval(function() {
    var cmd = ['EXEC',[],{user:'ticker'}];
    prvl.journalise(cmd);
    var n = bl.process(cmd);
    broadcast(['TICK',n]);
},1000);

sock.installHandlers(http,{prefix:'/data'});

http.listen(port,function() {
    console.log('listening on *:3000');
});

