"use strict";

const  plugin = require('../plugin.js');

const   dgram = require('dgram');
const  stream = require('stream');

plugin.add('udp',class extends plugin.Plugin {
    constructor({port   = 0,
                 type   = 'udp4',
                 Reader = class extends stream.Transform {
                     constructor() {
                         super({objectMode:true});
                     }
                     _transform(msg,env,cb) {
                         this.push(JSON.parse(msg.toString('utf8')));
                         cb();
                     }
                 },
                 Writer = class extends stream.Transform {
                     constructor() {
                         super({objectMode:true});
                     }
                     _transform(js,env,cb) {
                         this.push(Buffer.from(JSON.stringify(js)));
                         cb();
                     }
                 } }) {
        super();
        const pl = this;
        pl.port0       = port;    // IP port requested
        pl.type        = type;
        pl.socket      = null;
        pl.interface   = null;
        pl.Reader      = Reader;
        pl.Writer      = Writer;
        pl.port        = null;    // IP port allocated
    }
    start(cb) {
        const pl = this;
        pl.socket = dgram.createSocket({type:pl.type});
        pl.writer = plugin.instantiateWriteStream(pl.Writer);
        pl.reader = plugin.instantiateReadStream( pl.Reader);
        pl.socket.on('listening',()=>{
            pl.port = pl.socket.address().port;
            super.start(cb);
        });
        pl.socket.bind(pl.port0,pl.interface);
    }
    ready() {
        const pl = this;
        pl.socket.on('error',err=>{
            pl.update(['error',{err}]);
        });
        pl.server.on('message',(msg,remoteAddress)=>{
            pl.reader.once('data',data=>{
                pl.update(data,[remoteAddress.address,remoteAddress.port]);
            });
            pl.reader.write(msg);
        });
    }
    stop(cb) {
        const pl = this;
        pl.socket.once('close',()=>{
            pl.socket = null;
            pl.port   = null;
            super.stop(cb);
        });
        pl.socket.close();
    }
    out(js,name,addr) {
        const pl = this;
        pl.writer.once('data',data=>{
            pl.socket.send(data,0,data.length,addr[1],addr[0],err=>{
                pl.update(['error',{err,addr}]);
            });
        });
        pl.writer.write(js);
    }
});
