"use strict";

var    idb = require('../idb.js');

var malaya = require('malaya');
 
var assert = require('assert');
var events = require('events');
var   path = require('path');
var   util = require('util');
var   temp = require('temp');
var     fs = require('fs');
var      _ = require('underscore');

temp.track();                   // auto-cleanup at exit

var FE3_HDR_LENGTH = idb.FE3_HDR_LENGTH;
var AP_XML2        = idb.AP_XML2;
var AP_XML2A       = idb.AP_XML2A;

var jsonFile = path.join(__dirname,'../data/idb.json');

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

var mkServer = function(opts,cb) {
    var srvr =  new idb.Engine(_.extend({
        prevalenceDir: path.join(temp.mkdirSync(),'prevalence'),
        audit:         true,
        logging:       false,
        tag:           'idb-test',
        businessLogic: path.join(__dirname,'../bl.chrjs'),
        sync_journal:  'none'
    },opts));
    srvr.init();
    srvr.start();
    srvr.startPrevalence(function(err1) {
        if (err1)
            cb(err1);
        else
            srvr.loadData(jsonFile,function(err2) {
                if (err2) 
                    cb(err2,null);
                else
                    cb(null,srvr);
            });
    });
};

function mkSock(id) {
    var sock = new events.EventEmitter();
    sock.remoteAddress = 'benchie';
    sock.remotePort    = id||1234;
    sock.end           = function(){throw new Error('NYI');};
    sock.write         = function(x){};
    return sock;
}


suite('IDB',function() {
    var sock,fe3c,srvr;
    before(function(next) { 
        srvr = mkServer({},function(err,eng) {
            if (err)
                throw err;
            srvr = eng;
            next();
        });
    });
    bench("logon and logoff",function(next) {
        srvr.once('connectionClose',function(){next(null);});
        sock = mkSock();
        var  fe3 = new idb.FE3(sock);
        var name = util.format("fe3://%s:%d/",sock.remoteAddress,sock.remotePort);
        srvr.addConnection(name,{i:fe3,o:fe3,type:'data'});
        sock.write = function(b) {
            var s = b.toString();
            setImmediate(function() {
                if (/<logon /.test(s)) {
                    sock.emit('data',mkFE3("<start/>"));
                } else if (/<initiali/.test(s)) {
                    srvr.closeConnection(name);
                }
            });
        };
        sock.emit('data',mkFE3("<logon user='John Kozak' pw='JK'/>"));
    });
});
