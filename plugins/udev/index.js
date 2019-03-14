"use strict";

const  udev = require('udev');

exports.init = malaya=>{
    malaya.plugin.add('udev',class extends malaya.Plugin {
        constructor(opts) {
            super();
            this.monitor = null;
            this.isReady = false;
        }
        _event(type,dev) {
            if (this.isReady)
                this.update([type,dev]);
        }
        start(cb) {
            this.monitor = udev.monitor();
            ['add','change','remove']
                .forEach(e=>this.monitor.on(e,dev=>this._event(e,dev)));
            super.start(cb);
        }
        ready() {
            this.isReady = true;
            udev.list().forEach(dev=>this.update(['init',dev]));
            super.ready();
        }
        stop(cb) {
            this.isReady = false;
            this.monitor.close();
            super.stop(cb);
        }
    });
};
