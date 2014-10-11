// One day, FE3 will be implemented in _all_ programming languages.

"use strict";

var   util = require('./util.js');
var    net = require('net');
var    x2j = require('xml2js');
var events = require('events');

var FE3_HDR_LENGTH = 24;
var AP_HEARTBEAT   = 909;
var AP_XML2        = 893;
var AP_XML2A       = 918;

function FE3Connection(sock,options) {
    var mc          = this;
    var ee          = new events.EventEmitter();
    var xml_builder = new x2j.Builder({headless:true});
    var recved      = new Buffer(0);
    var NUL         = new Buffer('\0');

    // these are potentially stateful
    var toMalaya = function(js) {	// from FE3 XML-ish json
	if (js.root!==undefined)
	    throw new Error("ill-formed FE3 packet: "+JSON.stringify(js));
	else if (js.logon!==undefined) 
	    return ['I_AM',js.logon.$.user,js.logon.$.pw];
	else if (js.start!==undefined)
	    return ['REQUEST_CONTEXT'];
	else
	    throw new Error("unknown FE3 packet: "+JSON.stringify(js));
    }
    var fromMalaya = function(js) {	// to FE3 XML-ish json
	if (js[0]==='ERR') {
	    if (mc.name===null) 	// not logged on
		return {logon:{$:{OK:0,error_code:999,text:js[1]}}};
	    else
		throw new Error("unknown error to FE3ify: "+JSON.stringify(js));
	} else if (js[0]==='HI')
	    return {logon:{$:{OK:1,session_key:0}}};
	else
	    throw new Error("can't FE3ify: "+JSON.stringify(js));
    }
    
    this.name  = null;
    this.on    = function(what,handler) {ee.on(what,handler);};
    this.write = function(js) {
	var xml = xml_builder.buildObject(fromMalaya(js));
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
    this.close = function() {
	sock.end();
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
		    x2j.parseString(xml,function(err,js) {
			if (err===null)
			    ee.emit('data',js); 
			else {
			    // +++ error handling for broken XML? +++
			    socket.destroy();
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
        //console.log('DATA '+sock.remoteAddress+': '+data.toString('hex'));
    });
    sock.on('error',function(err) {
	util.error("socket error: "+err);
	sock.destroy();		// ???
    });
    sock.on('close',function() {
	ee.emit('close');
    });
}

exports.createServer = function(options) {
    var ee          = new events.EventEmitter();
    var server      = net.createServer(function(sock) {
	var conn = new FE3Connection(sock,{});
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
}
