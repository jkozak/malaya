#!/usr/bin/env node

"use strict";

var   argv = require('minimist')(process.argv.slice(2),{string:['init']});
var   util = require('../../util.js');
var   path = require('path');

var FE3_PORT = 5110;
var  WS_PORT = argv.port ? parseInt(argv.port) : 3000;

var malaya = require('../../malaya.js').createServer({
    prevalenceDir: argv.d || path.join(__dirname,'.prevalence'),
    webDir:        'www',
    audit:         true,
    logging:       true,
    init:          !!argv.init,
    tag:           'idb',
    businessLogic: argv.bl ? path.resolve(argv.bl) : path.join(__dirname,'bl.chrjs'),
    auto_output:   true
});

var fe3 = require('./fe3.js').createServer({malaya:malaya});
fe3.on('connect',function(mc) {
    malaya.addConnection(mc);
});
fe3.on('listening',function() {
    util.debug('fe3  listening on *:%s',FE3_PORT);
});

var timer = setInterval(function() {
    malaya.command(['tick',{date:new Date()}],{port:'server:'});
},1000);

malaya.on('loaded',function(hash) {
    util.debug("opening hash is: %s",hash);
});
malaya.on('closed',function(hash) {
    util.debug("closing hash is: %s",hash);
});
malaya.on('makeConnection',function(mc) {
    util.debug("hello, %j",mc);
});
malaya.on('loseConnection',function(mc) {
    util.debug("farewell, %j",mc);
});
malaya.on('closed',function() {
    if (timer)
	clearInterval(timer);
    fe3.close();
    fe3 = null;
});

process.on('SIGINT',function() {
    malaya.close();
    process.exit(1);
});
process.on('SIGQUIT',function() {
    process.exit(1);
});
process.on('SIGHUP',function() {
    malaya.save();
});
process.on('exit',function(code) {
});

var listen = function() {
    malaya.command(['restart',{}],{port:'server:'});
    malaya.listen(WS_PORT,function() {
	fe3.listen(FE3_PORT);
    });
};

malaya.start();

if (argv.init) {
    // +++ do this via the `transform` mechanism that doesn't exist yet [b8cb5936e7df0244] +++
    var IDB = {add:function(js) {malaya.command(js,{port:'init'});}};
    if (argv.init.match(/\.json$/)) {
	var json = JSON.parse(fs.readFileSync(argv.init));
	for (var i in json) {
	    IDB.add(json[i]);
	}
	listen();
    } else if (argv.init.match(/\.py$/)) {
	var  exec = require('child_process').exec;
	var child = exec("python import_init_db.py "+argv.init,{
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
	    //var resp = IDB.add(['logon',{user:"John Kozak",password:"JK"},{port:'test'}])
	    //console.log("*** logon resp: %j",resp);
	    //console.log("*** logon resp.adds: %j",_.map(resp.adds,function(t){return IDB.get(t);}));
	    //console.log("*** JK: %j",IDB.queries.user(51));
	    //console.log("users: %j",IDB.queries.users());
	    // console.log("staticdata(): %j",IDB.queries.staticdata());
	    // console.log("instruments(): %j",IDB.queries.instruments());
	    // console.log("subclasses(): %j",IDB.queries.subclasses());
	    // console.log("cookie(51,0): %j",IDB.queries.cookie(51,0));
	    //console.log("feCookies(): %j",IDB.queries.feCookies());
	
	    //fs.writeFileSync('/tmp/idb.chr.json',JSON.stringify(_.map(Object.keys(IDB._private.facts),
	    //							  function(k){return IDB._private.facts[k];} )));
	    listen();
	});
    } else if (argv.init.match(/[a-zA-Z0-9]+@[a-zA-Z0-9-]+\/[a-z0-9]+:.*/)) {
	throw new Error("NYI - ODBC loading");
    } else if (argv.init==='none') {
	listen();
    } else {
	console.error("can't init from: %j",argv.init);
	process.exit(100);
    }
} else {
    listen();
}




