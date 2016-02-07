"use strict";

const     net = require('net');
const    path = require('path');
const  stream = require('stream');
const  assert = require('assert');
const     x2j = require('./x2j.js');
const  malaya = require('malaya');

const    util = malaya.util;
const  Engine = malaya.engine.Engine;

const FE3_HDR_LENGTH = 24;
const AP_HEARTBEAT   = 909;
const AP_XML2        = 893;
const AP_XML2A       = 918;
const NUL            = new Buffer('\x00');

function fixXmlTypes(fact) {                // replace some type information lost to XML
    switch (fact[0]) {
    case 'market-status':
        fact[1].ID         = parseInt(fact[1].ID);
        fact[1].status     = parseInt(fact[1].status);
        break;
    case 'cookie':
    case 'store-cookie':
        fact[1].id         = parseInt(fact[1].id);
        break;
    case 'price':
        fact[1].ID         = parseInt(fact[1].ID);
        fact[1].seqNo      = parseInt(fact[1].seqNo);
        fact[1].instrument = parseInt(fact[1].instrument);
        fact[1].volume     = parseInt(fact[1].volume);
        fact[1].owner      = parseInt(fact[1].owner);
        fact[1].marketID   = parseInt(fact[1].marketID);
        fact[1].minLotSize = (typeof fact[1].minLotSize)==='string' ? parseInt(fact[1].minLotSize) : 1000;
        fact[1].isBuy      = !!parseInt(fact[1].isBuy);
        fact[1].x          = parseFloat(fact[1].x);
        break;
    case 'trade':
        fact[1].ID         = parseInt(fact[1].ID);
        fact[1].seqNo      = parseInt(fact[1].seqNo);
        fact[1].volume     = parseInt(fact[1].volume);
        fact[1].priceID    = parseInt(fact[1].priceID);
        fact[1].priceSeqNo = parseInt(fact[1].priceSeqNo);
        fact[1].hitter     = parseInt(fact[1].hitter);
        fact[1].marketID   = parseInt(fact[1].marketID);
        break;
    case 'AuctionTemplate':
        fact[1].id = parseInt(fact[1].id);
        break;
    case 'PrepareAuction':
        fact[1].id                   = parseInt(fact[1].id);
        fact[1].instance             = parseInt(fact[1].instance);
        fact[1].AuctionDuration      = parseInt(fact[1].AuctionDuration);
        fact[1].MatchingDuration     = parseInt(fact[1].MatchingDuration);
        fact[1].SecondChanceDuration = parseInt(fact[1].SecondChanceDuration);
        fact[1]._children.forEach(function(c) {
            c.AInst.InstID       = parseInt(c.AInst.InstID);
            c.AInst.Midprice     = parseFloat(c.AInst.Midprice);
            c.AInst.Tolerance    = parseFloat(c.AInst.Tolerance);
            c.AInst.AddTolerance = parseFloat(c.AInst.Tolerance);
        });
        break;
    case 'StartPreparedAuction':
        fact[1].id = parseInt(fact[1].id);
        break;
    case 'AuctionPrice':
        fact[1].value  = parseFloat(fact[1].value);
        fact[1].volume = parseInt(fact[1].volume);
        break;
    case 'AuctionSecondChance':
    case 'AuctionMatch':
        fact[1].AuctionID = parseInt(fact[1].AuctionID);
        fact[1].InstID    = parseInt(fact[1].InstID);
        fact[1].Volume    = parseFloat(fact[1].Volume);
        fact[1].IsBuy     = !!parseInt(fact[1].IsBuy);
        break;
    case 'AuctionPriceBlock':
        fact[1].auction    = parseInt(fact[1].auction);
        fact[1].instrument = parseInt(fact[1].instrument);
        fact[1]._children.forEach(function(c) {
            c.AuctionPrice.value  = parseFloat(c.AuctionPrice.value);
            c.AuctionPrice.volume = parseInt(c.AuctionPrice.volume);
        });
        break;
    case 'BigFigBlock':
        fact[1]._children.forEach(function(c) {
            c.BigFig.stock = parseInt(c.BigFig.stock);
            c.BigFig.bid   = parseInt(c.BigFig.bid);
        });
        break;
    case 'InstHighlight':
        fact[1].InstID      = parseInt(fact[1].InstID);
        fact[1].HighlightOn = !!parseInt(fact[1].HighlightOn);
        break;
    }
    return fact;
}

function FE3(sock) {
    const  fe3 = this;
    let recved = new Buffer(0);
    stream.Duplex.call(fe3,{objectMode:true});
    fe3.sock = sock;
    fe3.nq   = 0;
    fe3.qMax = 4;
    sock.on('data',function(data) {
        // +++ rewrite to use new streams +++
        // +++ use pause/resume for the time being +++
        recved = Buffer.concat([recved,data]);
        while (recved.length>=FE3_HDR_LENGTH) {
            const   type = recved.readInt32LE( 0);
            const cbData = recved.readInt32LE(12);
            if (recved.length>=FE3_HDR_LENGTH+cbData) {
                switch (type) {
                case AP_XML2A: {
                    const xml = recved.toString('ascii',FE3_HDR_LENGTH+4,FE3_HDR_LENGTH+cbData-1);
                    const jsx = x2j.parse(xml);
                    assert.equal(Object.keys(jsx).length,1);
                    const tag = Object.keys(jsx)[0];
                    fe3.push(fixXmlTypes([tag,jsx[tag]]));
                    break;
                }
                case AP_HEARTBEAT:
                    break;
                default:
                    util.error("unknown FE3 pkt type: "+type);
                    // +++ maybe drop connection? +++
                }
                recved = recved.slice(FE3_HDR_LENGTH+cbData); // processed, forget
            } else
                break;          // leave fragment for next event
        }
    });
}

util.inherits(FE3,stream.Duplex);

FE3.prototype._read = function() {
    // all done in constructor
};

FE3.prototype._write = function(chunk,encoding,cb) {
    const xml = x2j.build(chunk);
    const hdr = new Buffer(FE3_HDR_LENGTH);
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

FE3.prototype.push = function(x) {
    //    if (++this.nq>=this.qMax)
    //        this.pause();
    return stream.Duplex.prototype.push.call(this,x);
};
FE3.prototype.read = function(x) {
    const ans = stream.Duplex.prototype.read.call(this,x);
    if (ans!==null) {
        //if (--this.nq<this.qMax)
        //    this.resume();
    }
    return ans;
};

const createFE3Server = function(eng) {
    return net.createServer(function(sock) {
        const  fe3 = new FE3(sock);
        const name = util.format("fe3://%s:%d/",sock.remoteAddress,sock.remotePort);
        eng.addConnection(name,{i:fe3,o:fe3,type:'data'});
        sock.on('error',function(){sock.end();});
        sock.on('close',function(){eng.closeConnection(name);});
    });
};

function IDBEngine(options) {
    const eng = this;
    options.bundles = {
        "/bundle.js":[path.join(process.cwd(),'www/index.jsx')]
    };
    options.logging = true;
    Engine.call(eng,options);
    eng.fe3Server = null;
    return eng;
}

util.inherits(IDBEngine,Engine);

IDBEngine.prototype.closeConnection = function(portName) {
    const eng = this;
    const  io = eng.conns[portName];
    if (io && !io.closing) { // can be called more than once, allow for that
        eng.update(['logoff',{},{port:portName}],function() {
            Engine.prototype.closeConnection.call(eng,portName);
        });
    }
};

IDBEngine.prototype._become = function(mode,cb) {
    const  eng = this;
    const done = function(e) {
        if (e)
            cb(e);
        else
            Engine.prototype._become.call(eng,mode,cb);
    };
    if (eng.fe3Server && eng.mode==='master' && mode==='idle') {
        eng.fe3Server.close(function(err) {
            eng.fe3Server = null;
            done(err);
        });
    } else if (eng.options.ports.fe3 && eng.mode==='idle' && mode==='master') {
        eng.fe3Server = createFE3Server(eng);
        eng.on('slave',function(where) {
            const sp = where===null ? {} : {port:where.ports.fe3,server:where.host};
            for (const port in eng.conns)
                if (util.startsWith(port,'fe3:'))
                    eng.conns[port].o.write({_spareFE3:sp});
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
    const eng = this;
    const ans = Engine.prototype._replicationSource.call(eng);
    if (eng.options.ports.fe3)
        ans.ports.fe3 = eng.options.ports.fe3;
    return ans;
};

IDBEngine.prototype._logon = function(creds,port,cb) {
    const eng = this;
    eng.conns[port] = {type:'data',
                       i:   null,
                       o:   new stream.PassThrough({objectMode:true})
                      };
    eng.conns[port].o
        .on('data',
            function(js) {
                if (js.logon) {
                    cb(null,!!js.logon.OK);
                    eng.conns[port].o.end();
                }
            })
        .on('finish',function() {
            //delete eng.conns[port];
        });
    eng.update(['logon',{user:creds.name,pw:creds.pass},{port:port}],
               function(err) {
                   if (err)
                       cb(err);
               });
};
IDBEngine.prototype._logon = null; // !!! disable pro tem

exports.Engine = IDBEngine;

exports.FE3 = FE3;

exports.FE3_HDR_LENGTH = FE3_HDR_LENGTH;
exports.AP_XML2        = AP_XML2;
exports.AP_XML2A       = AP_XML2A;
