"use strict";

const       _ = require('underscore');

const cmdline = require('./cmdline.js');

const classes = {};

class Plugin {
    constructor(opts) {
        const pl = this;
        pl.addSubcommand = cmdline.addSubcommand;
        pl.subcommands   = cmdline.subcommands;
        pl.engine        = null;
        pl.update        = ()=>{throw new Error("engine not active yet");};
        pl.name          = null;
        pl.chrjs         = null;              // updated when added to a store
        pl.opts          = opts;
    }
    connect(chrjs) {
        this.chrjs = chrjs;
    }
    start(opts,cb) {
        const pl = this;
        if (!pl.chrjs)
            cb(new Error(`plugin ${pl.name} started while not connected`));
        else
            cb(null);
    }
    stop(opts,cb)  {cb(null);}
    out(js,addr)   {}
}
exports.Plugin = Plugin;

exports.makeOldPlugin = eps=>{        // back compat with 0.7.x
    return class extends Plugin {
        constructor() {
            super();
            const pl = this;
            pl.name    = eps.name;
            pl.init    = eps.init;
            pl.start   = eps.start;
            pl.stop    = eps.stop;
            pl.out     = eps.out;
            pl.eps     = eps;
            eps.update = pl.update;
        }
    };
};

const plugins = [];

exports.registerEngine = eng=>{
    plugins.forEach(pl=>{
        pl.engine = eng;
        pl.update = (js,addr)=>{
            if (js.length!==2 && typeof js[0]!=='string' & typeof js[1]!=='object')
                throw new Error(`bad update record type: ${JSON.stringify(js)}`);
            let port = pl.name;
            if (addr)
                port += ':'+addr;
            const js2 = js.concat([{port:`plugin:${port}`}]);
            if (pl.chrjs===eng.chrjs)
                eng.update(js2);
            else if (pl.chrjs)
                pl.chrjs.update(js2);
            else
                throw new Error(`plugin ${pl.name} trying to send while not connected`);
        };
        if (pl.eps)             // back compat with 0.7.x
            pl.eps.update = pl.update;
    });
    eng.on('become',mode=>{
        switch (mode) {
        case 'master':
            exports.start();
            break;
        default:
            exports.stop();
            break;
        }
    });
};

exports.get = name=>{
    let ans;
    plugins.filter(pl=>(pl.name===name)).forEach(pl=>{ans=pl;});
    return ans;
};

const add = exports.add = (name,cl)=>{
    classes[name] = cl;
};

exports.require = name=>{
    /* eslint-disable security/detect-non-literal-require */
    let cl = classes[name];
    if (!cl) {
        try {
            cl = require(`./plugins/${name}.js`);
        } catch (e1) {
            try {
                cl = require(`malaya-plugin-${name}`);
            } catch (e2) {
                // empty
            }
        }
    }
    if (!cl)
        throw new Error(`can't find plugin ${name}`);
    add(name,cl);
    return classes[name];
};

exports.instantiate = (name,opts={})=>{
    const pl = new classes[name](opts);
    pl.name = opts.name || name;
    if (plugins.filter(pl1=>(pl1.name===pl.name)).length>0)
        throw new Error(`plugin named ${pl.name} twice`);
    plugins.push(pl);
    return pl;
};

exports.start = (opts={},cb=()=>{})=>{
    const done = _.after(plugins.length,cb);
    plugins.forEach(pl=>pl.start(opts,done));
};
exports.stop = (opts={},cb=()=>{})=>{
    const done = _.after(plugins.length,cb);
    plugins.forEach(pl=>pl.stop(opts,done));
};

classes.timer = class extends Plugin {
    constructor(opts) {
        super();
        this.timer = null;
    }
    start(opts,cb) {
        const pl = this;
        if (pl.timer)
            cb(new Error(`timer started when active`));
        else {
            pl.timer = setInterval(()=>{
                pl.update(['tick',{t:Date.now()}]);
            },opts.interval);
            super.start(opts,cb);
        }
    }
    stop(opts,cb) {
        const pl = this;
        if (!pl.timer)
            cb(new Error(`timer stopped when inactive`));
        else {
            clearInterval(pl.timer);
            pl.timer = null;
            super.stop(opts,cb);
        }
    }
};

classes.restart = class extends Plugin {
    constructor(opts={}) {
        super();
        const pl = this;
        pl.running = false;
        pl.initted = false;
        pl.getData = opts.getData || (()=>{return {};});
    }
    start(opts,cb) {
        const pl = this;
        if (!pl.initted) {
            pl.engine.on('mode',mode=>{
                if (!pl.running)
                    throw new Error(`engine started before plugins initialised`);
                else
                    pl.update(['restart',pl.getData()]);
            });
            pl.initted = true;
        }
        pl.running = true;
        super.start(opts,cb);
    }
    stop(opts,cb) {
        this.running = false;
        super.stop(opts,cb);
    }
};

// +++ more small plugins +++

exports._private = {
    forgetAll: ()=>{
        Object.values(classes).forEach(cl=>{delete classes[cl];});
        plugins.length=0;
    }
};