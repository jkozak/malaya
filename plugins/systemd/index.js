"use strict";

const  notify = require('sd-notify');

exports.init = malaya=>{
    malaya.plugin.add('systemd',class extends malaya.Plugin {
        static init(opts){
            opts.addSubcommand('systemd',{addHelp:true});
            opts.subcommands.systemd.addArgument(
                ['what'],
                {
                    action:       'store',
                    help:         "'service' or ..."
                }
            );
            opts.subcommands.systemd.exec = ()=>{
                switch (opts.args.what) {
                case 'install':
                    throw new Error('NYI');
                case 'service':
                    console.log("+++ service file to come +++");
                    break;
                default:
                    throw new Error(`unknown systemd action: ${opts.args.what}`);
                }
            };
        }
        out([op,args],name,addr) {
            switch (op) {
            case 'ready':
                notify.read();
                break;
            case 'watchdog':
                notify.watchdog();
                break;
            case 'startWatchdogMode': // why use this?
                notify.startWatchdogMode(args.interval);
                break;
            case 'log':
                notify.sendStatus(args.message);
                break;
            default:
                throw new Error(`bad systemd notification: ${JSON.stringify([op,args])}`);
            }
        }
    });
};
