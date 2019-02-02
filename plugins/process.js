"use strict";

const    util = require('../util.js');
const  plugin = require('../plugin.js');
const whiskey = require('../whiskey.js');

const      cp = require('child_process'); // eslint-disable-line security/detect-child-process

plugin.add('process',class extends plugin.Plugin {
    constructor({raw=false}) {
        super();
        const pl = this;
        pl.raw       = raw;
        pl.processes = null;
        pl.exitWait  = 1000;
        if (pl.raw)
            throw new Error("NYI: plugin process raw mode");
    }
    start(cb) {
        const pl = this;
        pl.processes = {};
        cb();
    }
    stop(cb) {
        const pl = this;
        if (Object.keys(pl.processes).length===0)
            cb();
        else {
            Object.values(pl.processes).forEach(sp=>{
                sp.on('exit',()=>{
                    if (Object.keys(pl.processes).length===0)
                        cb();
                });
                sp.kill();
            });
            setTimeout(()=>{    // bayonet any survivors after exitWait ms
                Object.values(pl.processes).forEach(sp=>{
                    sp.on('exit',()=>{
                        if (Object.keys(pl.processes).length===0)
                            cb();
                    });
                    sp.kill('SIGKILL');
                });
            },pl.exitWait);
        }
    }
    pipeTo(port,what,data) {
        const pl = this;
        const ws = new whiskey.LineStream();
        ws.on('data',data=>pl.update([what,{data}],port));
        return ws;
    }
    out(js,addr) {
        const pl = this;
        switch (js[0]) {
        case 'spawn': {
            const opts = util.deepClone(js[1].options || {});
            opts.stdio = ['pipe','pipe','pipe'];
            const   sp = cp.spawn(js[1].command,js[1].args,opts);
            const port = `${sp.pid}`;
            sp._malaya = js[1];
            pl.processes[port] = sp;
            sp.on('error',err=>{
                pl.update(['error',{pid:sp.pid,err}],port);
                // +++ maybe delete pl.sp[sp.pid] ? +++
            });
            sp.on('exit', (code,signal)=>{
                pl.update(['exit',{pid:sp.pid,code,signal}],port);
                delete pl.processes[sp.pid];
            });
            sp.stdout.pipe(pl.pipeTo(port,'stdout'));
            sp.stderr.pipe(pl.pipeTo(port,'stderr'));
            setImmediate(()=>   // setImmediate to avoid recursion in store.add
                         pl.update(['start',{pid:sp.pid,cookie:js[1].cookie}],port) );
            break;
        }
        case 'kill':
            pl.processes[addr].kill();
            break;
        case 'signal':
            pl.processes[addr].signal(js[1].signal);
            break;
        case 'stdin':
            // +++ addr contains pid +++
            pl.processes[addr].stdin.write(js[1].data);
            break;
        default:
            throw new Error(`unknown process plugin operation: ${js[0]}`);
        }
    }
});
