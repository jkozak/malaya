// One day, FE3 will be implemented in _all_ programming languages.

"use strict";

var   util = require('../../util.js');
var    net = require('net');
var    x2j = require('xml2js');
var events = require('events');
var assert = require('assert');

var FE3_HDR_LENGTH = 24;
var AP_HEARTBEAT   = 909;
var AP_XML2        = 893;
var AP_XML2A       = 918;

function FE3Connection(sock,server) {
    var mc          = this;
    var ee          = new events.EventEmitter();
    var xml_builder = new x2j.Builder({headless:true});
    var recved      = new Buffer(0);
    var NUL         = new Buffer('\0');
    var inLogon     = false;
    var appId       = null;
    var appName     = null;
    var appRole     = null;

    var write = function(jsx) {
	var xml = xml_builder.buildObject(jsx);
	var hdr = new Buffer(FE3_HDR_LENGTH);
	hdr.writeInt32LE(AP_XML2,      0); // type
	hdr.writeInt32LE(0,            4); // drain
	hdr.writeInt32LE(0,            8); // ticks
	hdr.writeInt32LE(xml.length+1,12); // cbData (inc trailing NUL)
	hdr.writeInt32LE(0,           16); // seqNo
	hdr.writeInt32LE(0,           20); // dummy
	sock.write(hdr);
	sock.write(xml,'ascii');
	sock.write(NUL);
    };

    var command = function(cmd) {
	var res = server.command(cmd,mc);
	res.adds.forEach(function(add) {
	    if (add[0]==='msg') {
		if (add[1]===null)
		    server.broadcast(add);
		else
		    mc.write(add);
	    }
	});
	return res;
    };

    var handleJsx = function(jsx) {
	assert.equal(Object.keys(jsx).length,1);
	var tag = Object.keys(jsx)[0];
	if (Object.keys(jsx[tag]).length==1) {
	    var res = command([tag,jsx[tag].$]);
	    switch (tag) {
	    case 'logon':
		switch (res.adds[0][0]) {
		case 'Permissions':
		    assert.equal(res.adds[0][1].LoggedOn,1);
		    appId   = res.adds[0][1].ApplicationID;
		    appName = res.adds[0][1].ApplicationName;
		    appRole = res.adds[0][1].AppRole;
		    write({logon:{$:{OK:1,session_key:0}}});
		    break;
		case 'msg':
		    break;
		default:
		    throw new Error("NYI "+res.adds[0][0]);
		}
	    }
	} else
	    throw new Error("NYI: "+JSON.stringify(jsx));
    };
    
    this.port  = util.format("fe3:%d",sock.address().port);
    this.on    = function(what,handler) {ee.on(what,handler);};
    this.close = function() {
	sock.end();
    }
    this.write = function(js) {
	if (js instanceof Array)
	    switch (js[0]) {
	    case 'msg':
		write({error:{$:{code:999,text:js[2]}}});
		return;
	    }
	throw new Error('NYI');
    }
    sock.on('data',function(data) {
	recved = Buffer.concat([recved,data]);
	if (recved.length>=FE3_HDR_LENGTH) {
	    var   type = recved.readInt32LE( 0);
	    var  drain;
	    var  ticks;
	    var cbData = recved.readInt32LE(12);
	    var  seqNo;
	    var  dummy;
	    if (recved.length>=FE3_HDR_LENGTH+cbData) {
		switch (type) {
		case AP_XML2A: {
		    var xml = recved.toString('ascii',FE3_HDR_LENGTH+4,FE3_HDR_LENGTH+cbData-1);
		    x2j.parseString(xml,function(err,jsx) {
			if (err===null) 
			    handleJsx(jsx);
			else {
			    console.log(err);
			    // +++ error handling for broken XML? +++
			    sock.destroy();
			}
		    });
		    break;
		}
		case AP_HEARTBEAT:
		    util.debug("heartbeat");
		    break;
		default:
		    util.error("unknown FE3 pkt type: "+type);
		    // +++ maybe drop connection? +++
		}
		recved = recved.slice(FE3_HDR_LENGTH+cbData); // processed, forget
	    }
	}
    });
    sock.on('error',function(err) {
	util.error("socket error: "+err);
	sock.destroy();		// ???
    });
    sock.on('close',function() {
	ee.emit('close');
    });
    
    if (util.env==='test') {
	this._private = {
	    handleJsx: handleJsx
	};
    }
}

exports.createServer = function(options) {
    var ee     = new events.EventEmitter();
    var server = net.createServer(function(sock) {
	var conn = new FE3Connection(sock,options.malaya);
	ee.emit('connect',conn);
    });
    this.listen = function(p,h) {
	server.listen(p,h);
	server.on('listening',function(){ee.emit('listening');});
    };
    this.on     = function(what,handler) {
	ee.on(what,handler);
    };
    this.close  = function() {
	server.close();
    };
    return this;
};

if (util.env==='test')
    exports._private = {FE3Connection: FE3Connection,
			FE3_HDR_LENGTH:FE3_HDR_LENGTH,
			AP_HEARTBEAT:  AP_HEARTBEAT,
			AP_XML2:       AP_XML2,
			AP_XML2A:      AP_XML2A
		       };

