"use strict";

var    fe3 = require('../fe3.js');
 
var assert = require('assert');
var events = require('events');
var   path = require('path');
var   temp = require('temp');
var     fs = require('fs');
var      _ = require('underscore');

temp.track();			// auto-cleanup at exit


var FE3_HDR_LENGTH = fe3._private.FE3_HDR_LENGTH;
var AP_XML2        = fe3._private.AP_XML2;
var AP_XML2A       = fe3._private.AP_XML2A;

var json = JSON.parse(fs.readFileSync(path.join(__dirname,'../data/idb.json')));

var mkFE3 = function(s,ap_type) {
    ap_type = ap_type || AP_XML2A;
    var hdr = new Buffer(FE3_HDR_LENGTH+4);
    hdr.writeInt32LE(ap_type,      0); // type
    hdr.writeInt32LE(0,            4); // drain
    hdr.writeInt32LE(0,            8); // ticks
    hdr.writeInt32LE(s.length+4+1,12); // cbData (inc trailing NUL)
    hdr.writeInt32LE(0,           16); // seqNo
    hdr.writeInt32LE(0,           20); // dummy
    hdr.writeInt32LE(0,           24); // dummy2
    return Buffer.concat([hdr,new Buffer(s),new Buffer('\0')]);
};

var mkServer = function(opts) {
    var srvr =  require('../../../malaya.js').createServer(_.extend({
	prevalenceDir: path.join(temp.mkdirSync(),'prevalence'),
	audit:         true,
	logging:       false,
	init:          true,
	tag:           'idb-test',
	businessLogic: path.join(__dirname,'../bl.chrjs'),
	sync_journal:  'none'
    },opts));
    srvr.start();
    for (var i in json) 
	srvr.command(json[i],{port:'bench:'});
    return srvr;
};

function mkSock(id) {
    var sock = new events.EventEmitter();
    sock.remoteAccess = 'testie';
    sock.remotePort   = id||1234;
    sock.end          = function(){throw new Error('NYI');};
    sock.write        = function(x){};
    return sock;
}


suite('IDB',function() {
    var sock,fe3c,srvr;
    before(function() { 
	srvr = mkServer();
    });
    bench("logon and logoff",function() {
	sock = mkSock();
	fe3c = new fe3._private.FE3Connection(sock,srvr);
	sock.emit('data',mkFE3("<logon user='John Kozak' pw='JK'/>"));
	sock.emit('data',mkFE3("<start/>"));
	sock.emit('close');
    });
});
