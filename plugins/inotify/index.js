"use strict";

const inotify = require('inotify');
const Inotify = inotify.Inotify;

Object.keys(Inotify).forEach(k=>{
    if (k.startsWith('IN_'))
        exports[k.slice(3)] = Inotify[k];
});

exports.init = malaya=>{
    malaya.plugin.add('inotify',class extends malaya.Plugin {
        constructor({path,watch}) {
            super();
            const pl   = this;
            pl.path    = path;
            pl.watch   = watch || Inotify.IN_ALL_EVENTS;
            pl.ntfy    = null;
            pl.watches = {};
        }
        _addWatch(path,watch) {
            const pl   = this;
            const id = pl.ntfy.addWatch({
                path:      path,
                watch_for: watch,
                callback: ev=>{
                    const opts = {mask:ev.mask};
                    if (ev.name)
                        opts.filename = ev.name;
                    pl.update(['event',opts]);
                }
            });
            pl.watches[id] = {path,watch};
            return id;
        }
        start(cb) {
            const pl = this;
            pl.ntfy = new Inotify();
            if (pl.path)
                pl._addWatch(pl.path,pl.watch);
            super.start(cb);
        }
        stop(cb) {
            const pl = this;
            pl.ntfy.close();
            pl.ntfy = null;
            super.stop(cb);
        }
        out(js,name,addr) {
            setImmediate(()=>{
                const pl = this;
                switch (js[0]) {
                case 'add': {
                    const id = pl._addWatch(js[1].path,js[1].watch);
                    pl.update(['watch',{id,path:js[1].path}]);
                    break;
                }
                case 'remove':
                case 'delete': {
                    const pl   = this;
                    pl.ntfy.removeWatch(js[1].id);
                    delete pl.watches[js[1].id];
                    break;
                }
                default:
                    throw new Error(`unknown inotify action: ${js[1]}`);
                }
            });
        }
    });
};
