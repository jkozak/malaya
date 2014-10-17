var    fe3 = require('../fe3.js');

var   path = require('path');
var events = require('events');
var assert = require('assert');
var   temp = require('temp');

var FE3_HDR_LENGTH = fe3._private.FE3_HDR_LENGTH;
var AP_XML2        = fe3._private.AP_XML2;
var AP_XML2A       = fe3._private.AP_XML2A;

temp.track();			// auto-cleanup at exit

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

var mkServer = function() {
    var srvr =  require('../../../malaya.js').createServer({
	prevalenceDir: temp.mkdirSync(),
	audit:         true,
	logging:       false,
	init:          true,
	tag:           'idb-test',
	businessLogic: path.join(__dirname,'../bl.chrjs') });
    // +++ load test fixture +++
    return srvr;
};

describe("server",function() {
});
