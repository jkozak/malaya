"use strict";

const  plugin = require('../plugin.js');
const request = require('superagent');

plugin.add('fetch',class extends plugin.Plugin {
    out([op,args],name,addr) {
        const pl = this;
        let   rq = request(op.toUpperCase() || 'GET',args.url).ok(()=>true);
        if (args.auth)
            rq = rq.auth(args.auth.user,args.auth.pass);
        rq.end((err,resp)=>{
            if (resp)
                pl.update(['response',{
                    id:         args.id,
                    statusCode: resp.status,
                    body:       resp.body
                }],addr);
            else
                setImmediate(()=>
                    pl.update(['error',{id:args.id,error:(err||new Error('no response')).toString()}],addr) );
        });
    }
});
