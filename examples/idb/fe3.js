// One day, FE3 will be implemented in _all_ programming languages.

"use strict";

var   util = require('../../util.js');
var    net = require('net');
var    x2j = require('./x2j.js');
var events = require('events');
var assert = require('assert');

var FE3_HDR_LENGTH = 24;
var AP_HEARTBEAT   = 909;
var AP_XML2        = 893;
var AP_XML2A       = 918;

function FE3Connection(sock,server) {
    var mc          = this;
    var ee          = new events.EventEmitter();
    var recved      = new Buffer(0);
    var NUL         = new Buffer('\x00');
    var appId       = null;

    var write = function(jsx) {
        var xml = x2j.build(jsx);
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
        return server.command(cmd,mc);
    };

    var handleJsx = function(jsx) {
        assert.equal(Object.keys(jsx).length,1);
        var tag = Object.keys(jsx)[0];
        switch (tag) {
        case 'logon': {
            var  res = command([tag,jsx[tag]]);
            var add0 = res.refs[res.adds[0]];
            var tag1 = add0[0];
            switch (tag1) {
            case 'Permissions':
                assert.equal(add0[1].LoggedOn,1);
                appId   = add0[1].ApplicationID;
                break;
            case '_output':
                break;
            default:
                throw new Error("NYI "+tag1);
            }
            break;
        }
        default:
            command([tag,jsx[tag]]);
        }
    };

    this.port  = util.format("fe3://%s:%d/",sock.remoteAddress,sock.remotePort);
    this.on    = function(what,handler) {ee.on(what,handler);};
    this.close = function() {
        sock.end();
    };
    this.end = function() {
        sock.end();
    };
    this.write = function(js) {
        write(js);
    };
    sock.on('data',function(data) {
        recved = Buffer.concat([recved,data]);
        while (recved.length>=FE3_HDR_LENGTH) {
            var   type = recved.readInt32LE( 0);
            var cbData = recved.readInt32LE(12);
            if (recved.length>=FE3_HDR_LENGTH+cbData) {
                switch (type) {
                case AP_XML2A: {
                    var xml = recved.toString('ascii',FE3_HDR_LENGTH+4,FE3_HDR_LENGTH+cbData-1);
                    handleJsx(x2j.parse(xml));
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
        sock.destroy();         // ???
    });
    sock.on('close',function() {
        try {
            command(['logoff',{appId:appId}]);
        } catch (e) {
            console.log("couldn't logoff: "+e); // this happens if server is shutdown
        }
        ee.emit('close');
    });
    
    if (util.env==='test') 
        this._private = {
            handleJsx: handleJsx
        };
    return this;
}

exports.createServer = function(options) {
    var ee     = new events.EventEmitter();
    var server = net.createServer(function(sock) {
        options.malaya.addConnection(new FE3Connection(sock,options.malaya));
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

exports.consts = {
    FE3_HDR_LENGTH:FE3_HDR_LENGTH,
    AP_HEARTBEAT:  AP_HEARTBEAT,
    AP_XML2:       AP_XML2,
    AP_XML2A:      AP_XML2A
};

exports.FE3Connection = FE3Connection;
