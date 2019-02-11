"use strict";

const {RTMClient,WebClient} = require('@slack/client');

const pass = require('password-store');

exports.init = malaya=>{
    malaya.plugin.add('slack',class extends malaya.Plugin {
        constructor({token,pass}) {
            super();
            const pl = this;
            pl.token = token;
            pl.pass  = pass;
            pl.rtm   = null;
        }
        _start(cb) {
            const pl = this;
            const wc = new WebClient(pl.token);

            wc   .users.list().then(us=>pl.update(['users',   {entries:us}]));
            wc.channels.list().then(cs=>pl.update(['channels',{entries:cs}]));

            pl.rtm = new RTMClient(pl.token);

            pl.rtm.on('authenticated',connectData=>{
                pl.update(['authenticated',{id:connectData.self.id}]);
            });

            pl.rtm.on('connected',()=>{
                pl.update(['connected',{}]);
                super.start(cb);
            });

            pl.rtm.on('message',msg=>{
                pl.update(['message',msg]);
            });

            // +++ errors

            pl.rtm.start();
        }
        start(cb) {
            const pl = this;
            if (!pl.token) {
                pass.show(pl.pass).then(token=>{
                    pl.token = token.trim();
                    pl._start(cb);
                });
            } else
                pl._start(cb);
        }
        stop(cb) {
            const pl = this;
            pl.rtm.close();         // ???
            pl.rtm = null;
            super.stop(cb);
        }
        out(js,name,addr) {
            const pl = this;
            pl.rtm.sendMessage(js,addr); // !!! ish
        }
    });
};
