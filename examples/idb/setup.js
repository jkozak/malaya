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
                  if (isNaN(ans))
                      throw new util.Fail(util.format("invalid port: %j",s));
                  return ans;
              } ]
};

function doInit(server,init,listen) {
    // +++ do this via the `transform` mechanism that doesn't exist yet [b8cb5936e7df0244] +++
    var           fs = require('fs');
    var          IDB = {add:function(js) {server.command(js);}};
    var exitIfNoFile = function(filename) {
        if (!fs.existsSync(filename)) 
            throw new util.Fail(util.format("init file %j not found",filename));
    };
    var      addJSON = function(arr) {for (var i in arr) IDB.add(arr[i]);};
    if (init.match(/\.json$/)) {
        exitIfNoFile(init);
        addJSON(JSON.parse(fs.readFileSync(init)));
        listen();
    } else if (init.match(/\.py$/)) {
        exitIfNoFile(init);
        var  exec = require('child_process').exec;
        var  prog = path.join(__dirname,"import_init_db.py");
        var child = exec(util.format("python %j --malaya-serialised %s",prog,init),
                         {
                             maxBuffer: 10*1024*1024
                         },
                         function(err,stdout,stderr) {
                             if (err) throw err;
                             addJSON(util.deserialise(stdout));
                         } );
        child.on('exit',function(code,signal) {
            if (code!==0)
                console.log("failed: %j",code);
        });
        child.on('close',function() {
            listen();
        });
    } else if (init.match(/[a-zA-Z0-9]+@[a-zA-Z0-9-]+\/[a-z0-9]+:.*/)) 
        throw new util.Fail("NYI - ODBC loading");
    else
        throw new util.Fail(util.format("can't init from: %j",init));
}

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
        onCompile:     null},
                    opts);

    if (opts.init==='')
        throw new util.Fail("specify something to init from!");

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
        server.command(['_take-outputs',{}],{port:'server:'}); // !!! improve this !!!
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
        if (opts.init==='' || !!opts.init)
            try {
                doInit(server,opts.init,listen);
            } catch (e) {
                server.uninit();
                throw e;
            }
        else
            listen();
    };

    server.fe3 = fe3srv;

    if (opts.debug) {
        server.on('queue-rule',function(ruleName,bindings) {
            console.log("fire rule: %s",ruleName);
            for (var i in bindings)
                if (bindings[i]!==null)
                    console.log("   %d %s %j",i,bindings[i],server.getFact(bindings[i]));
        });
        server.on('add',function(t,fact) {
            console.log("add fact: %s %j",t,fact);
        });
        server.on('command',function(cmd) {
            console.log("command: %j",cmd);
        });
    }
    
    return server;
};
