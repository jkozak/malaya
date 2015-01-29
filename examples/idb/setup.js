"use strict";

// +++ this should move up to the base directory
// +++ apps should specialise this to add their own comms &c

var      _ = require('underscore');
var   util = require('../../util.js');
var   path = require('path');
var malaya = require('../../malaya.js');
var    fe3 = require('./fe3.js');

exports.extraOpts = {
    fe3Port: ["FE3 port",
	      5110,
	      function(s) {
		  var ans = parseInt(s);
		  if (ans===NaN)
		      throw new Error("invalid port");
		  return ans;
	      } ]
};

exports.build = function(opts) {
    opts = _.extend({
	prevalenceDir: path.join(__dirname,'.prevalence'),
	webDir:        path.join(__dirname,'www'),
	audit:         true,
	logging:       true,
	init:          false,
	tag:           'idb',
	businessLogic: path.join(__dirname,'bl.chrjs'),
	debug:         false,
	onCompile:     null,
	auto_output:   true},
		    opts);

    var  server = malaya.createServer(opts);
    var  fe3srv = fe3.createServer({malaya:server});
    var fe3port = opts.fe3port || 5110;
    var  wsport = opts.wsport  || 3000;
    
    fe3srv.on('listening',function() {
	util.debug('fe3  listening on *:%s',fe3port);
	server.ready();
    });
    var timer = setInterval(function() {
	server.command(['tick',{date:new Date()}],{port:'server:'});
    },1000);

    server.on('loaded',function(hash) {
	util.debug("opening hash is: %s",hash);
    });
    server.on('closed',function(hash) {
	util.debug("closing hash is: %s",hash);
    });
    server.on('closed',function() {
	if (timer)
	    clearInterval(timer);
	fe3srv.close();
	fe3srv = null;
    });
    if (opts.onCompile)
	server.on('compile',opts.onCompile);

    if (opts.init==='')
	throw new Error("specify a source of init data");

    server.start();
    
    server.on('makeConnection',function(mc) {
	util.debug("hello, %j",mc);
    });
    server.on('loseConnection',function(mc) {
	util.debug("farewell, %j",mc);
    });
    
    server.run = function() {
	var listen = function() {
	    server.command(['restart',{}],{port:'server:'});
	    server.listen(wsport,function() {
		fe3srv.listen(fe3port);
	    });
	};
	if (!!opts.init)
	    init(server,opts.init,listen);
	else
	    listen();
    };

    server.fe3 = fe3srv;
    
    return server;
};

function init(server,init,listen) {
    // +++ do this via the `transform` mechanism that doesn't exist yet [b8cb5936e7df0244] +++
    var IDB = {add:function(js) {server.command(js,{port:'init'});}};
    if (init.match(/\.json$/)) {
	var json = JSON.parse(fs.readFileSync(init));
	for (var i in json) {
	    IDB.add(json[i]);
	}
	listen();
    } else if (init.match(/\.py$/)) {
	var  exec = require('child_process').exec;
	var child = exec("python import_init_db.py "+init,{
	    maxBuffer: 10*1024*1024
	}, function(err,stdout,stderr) {
	    var json = JSON.parse(stdout);
	    for (var i in json)
		IDB.add(json[i]);
	});
	child.on('exit',function(code,signal) {
	    if (code!==0)
		console.log("failed: %j",code);
	});
	child.on('close',function() {
	    listen();
	});
    } else if (init.match(/[a-zA-Z0-9]+@[a-zA-Z0-9-]+\/[a-z0-9]+:.*/)) {
	throw new Error("NYI - ODBC loading");
    } else {
	console.error("can't init from: %j",init);
	process.exit(100);
    }
}




