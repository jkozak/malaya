"use strict";

const request = require('request');

exports.init = malaya=>{
    malaya.plugin.add('fetch',class extends malaya.Plugin {
        out([op,args],name,addr) {
            const   pl = this;
            const auth = args.auth ? {
                user: args.auth.user,
                pass: args.auth.pass} : undefined;
            request({
                method: op.toUpperCase(),
                url:    args.url,
                auth,
            },
                    (err,resp,body)=>{
                        if (err)
                            setImmediate(()=>
                                pl.update(['error',{id:args.id,error:err.toString()}]) );
                        else
                            pl.update(['response',{
                                id:         args.id,
                                statusCode: resp.statusCode,
                                body:       JSON.parse(body)
                            }]);
                    });
        }
    });
};
