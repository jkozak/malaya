"use strict";

var       _ = require('underscore');
var     net = require('net');
var  stream = require('stream');
var  assert = require('assert');
var     x2j = require('./x2j.js');
var    util = require('../../util.js');
var  Engine = require('../../engine.js').Engine;

var FE3_HDR_LENGTH = 24;
var AP_HEARTBEAT   = 909;
var AP_XML2        = 893;
var AP_XML2A       = 918;
var NUL            = new Buffer('\x00');

util.inherits(FE3,stream.Duplex);

function FE3(sock,eng) {
    var recved = new Buffer(0);
    var    fe3 = this;
    stream.Duplex.call(fe3,{objectMode:true});
    fe3.eng  = eng;
    fe3.sock = sock;
    sock.on('data',function(data) {
        recved = Buffer.concat([recved,data]);
        while (recved.length>=FE3_HDR_LENGTH) {
            var   type = recved.readInt32LE( 0);
            var cbData = recved.readInt32LE(12);
            if (recved.length>=FE3_HDR_LENGTH+cbData) {
                switch (type) {
                case AP_XML2A: {
                    var xml = recved.toString('ascii',FE3_HDR_LENGTH+4,FE3_HDR_LENGTH+cbData-1);
                    var jsx = x2j.parse(xml);
                    assert.equal(Object.keys(jsx).length,1);
                    var tag = Object.keys(jsx)[0];
                    fe3.push([tag,jsx[tag]]);
                    break;
                }
                case AP_HEARTBEAT:
                    break;
                default:
                    util.error("unknown FE3 pkt type: "+type);
                    // +++ maybe drop connection? +++
                }
                recved = recved.slice(FE3_HDR_LENGTH+cbData); // processed, forget
            }
        }
    });
}

FE3.prototype._read = function() {
    // all done in constructor
};

FE3.prototype._write = function(chunk,encoding,cb) {
    var xml = x2j.build(chunk);
    var hdr = new Buffer(FE3_HDR_LENGTH);
    hdr.writeInt32LE(AP_XML2,      0); // type
    hdr.writeInt32LE(0,            4); // drain
    hdr.writeInt32LE(0,            8); // ticks
    hdr.writeInt32LE(xml.length+1,12); // cbData (inc trailing NUL)
    hdr.writeInt32LE(0,           16); // seqNo
    hdr.writeInt32LE(0,           20); // dummy
    this.sock.write(hdr);
    this.sock.write(xml,'ascii');
    this.sock.write(NUL);
    cb();
};

var createFE3Server = function(eng) {
    return net.createServer(function(sock) {
        var  fe3 = new FE3(sock,eng,{});
        var name = util.format("fe3://%s:%d/",sock.remoteAddress,sock.remotePort);
        eng.addConnection(name,{i:fe3,o:fe3,type:'data'});
        sock.on('error',function(){sock.end();});
        sock.on('close',function(){eng.forgetConnection(name);});
    });
};

function IDBEngine(options) {
    var eng = this;
    Engine.call(eng,options);
    eng.on('connectionClose',function(port) {
        eng.update(['logoff',{},{port:port}]);
    });
    eng.fe3Server = null;
    return eng;
}

util.inherits(IDBEngine,Engine);

IDBEngine.prototype._become = function(mode,cb) {
    var  eng = this;
    var done = _.after(2,function(){cb();});
    Engine.prototype._become.call(eng,mode,done);
    if (eng.fe3Server && eng.mode==='master' && mode==='idle') {
        eng.fe3Server.close(function(err){
            eng.fe3Server = null;
            done(err);
        });
    } else if (eng.options.ports.fe3 && eng.mode==='idle' && mode==='master') {
        eng.fe3Server = createFE3Server(eng);
        eng.on('slave',function(where) {
            var sp = where===null ? {} : {port:where.ports.fe3,server:where.host};
            for (var port in eng.conns) 
                if (util.startsWith(port,'fe3:')) 
                    eng.conns[port].o.write({spare:sp});
        });
        eng.fe3Server.on('listening',function() {
            eng.emit('listen','fe3',eng.options.ports.fe3);
            done();
        });
        eng.fe3Server.listen(eng.options.ports.fe3);
    } else
        done();
};

IDBEngine.prototype._replicationSource = function() {
    var eng = this;
    var ans = Engine.prototype._replicationSource.call(eng);
    if (eng.options.ports.fe3)
        ans.ports.fe3 = eng.options.ports.fe3;
    return ans;
};

exports.Engine = IDBEngine;
