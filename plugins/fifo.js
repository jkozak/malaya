"use strict";

const  plugin = require('../plugin.js');
const whiskey = require('../whiskey.js');

const      cp = require('child_process'); // eslint-disable-line security/detect-child-process
const      fs = require('fs');

plugin.add('fifo',class extends plugin.StreamPlugin {
    constructor({path='fifo',mode='ug=rw',
                 Reader=whiskey.StringifyJSONStream,Writer=whiskey.JSONParseStream}) {
        super({Reader,Writer});
        const pl = this;
        pl.path = path;
        pl.fifo = null;
        pl.mode = mode;
        pl.fd   = null;
    }
    start(cb) {
        const pl = this;
        fs.unlink(pl.path,err=>{
            cp.spawn('mkfifo',['-m',pl.mode,pl.path],{stdio:'inherit'})
                .on('error',err=>console.log(err))
                .once('exit',rc=>{
                    if (rc!==0) {
                        cb(new Error(`spawn mkfifo failed: ${rc}`));
                    } else {
                        fs.open(pl.path,'r+',(err,fd)=>{
                            pl.fd   = fd;
                            pl.fifo = fs.createWriteStream(null,{fd,autoClose:false});
                            super.start(cb);
                        });
                    }
                });
        });
    }
    ready() {
        const pl = this;
        pl.fifo = fs.createReadStream(pl.path,{encoding:'utf8',flag:'r+'});
        pl.fifo.pipe(pl.writer);
        super.ready();
    }
    stop(cb) {
        const pl = this;
        if (pl.fifo) {
            pl.fifo.unpipe();
            fs.closeSync(pl.fd);
            pl.fd   = null;
            pl.fifo = null;
        }
        fs.unlink(pl.path,()=>super.stop(cb));
    }
});
