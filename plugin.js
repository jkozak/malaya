"use strict";

const        _ = require('underscore');
const       fs = require('fs');
const   stream = require('stream');
const through2 = require('through2');

const    util = require('./util.js');
const cmdline = require('./cmdline.js');
const whiskey = require('./whiskey.js');

const classes = {};
const plugins = [];
let overrides = [];

class Plugin {
    static init(opts) {}
    constructor(opts) {
        const pl = this;
        pl.engine   = null;
        pl.update   = ()=>{throw new Error("engine not ready yet");};
        pl.name     = null;
        pl.chrjs    = null;              // updated when added to a store
        pl.opts     = opts;
        pl._depends = [];
    }
    depends(name) {
        const pl = this;
        let  dep;
        plugins.forEach(pl1=>{
            if (name===pl1.name) {
                if (dep)
                    throw new Error('SNO');
                dep = pl1;
            }
        });
        // this guarantees the plugins are in the right order by the
        // hacky expedient of failing if they're not.
        // +++ improve this +++
        if (!dep)
            throw new Error(`can't find plugin: ${name}`);
        pl._depends.push(dep);
        return dep;
    }
    connect(chrjs) {
        const pl = this;
        pl.chrjs = chrjs;
        pl._depends.forEach(dep=>{
            if (dep.chrjs!==pl.chrjs)
                throw new Error(`dependent plugins must be attached to the same store`);
        });
    }
    start(cb) {
        const pl = this;
        if (!pl.chrjs)
            cb(new Error(`plugin ${pl.name} started while not connected`));
        else
            cb(null);
    }
    ready() {
    }
    stop(cb)          {cb(null);}
    out(js,name,addr) {}
}
exports.Plugin = Plugin;

class StreamPlugin extends Plugin {
    constructor(opts) {
        super(opts);
        const pl = this;
        pl.reader = opts.Reader ? new opts.Reader() : through2.obj();
        pl.writer = opts.Writer ? new opts.Writer() : through2.obj();
        pl.writer.on('data',()=>{throw new Error("not ready to send data from engine");});
    }
    ready() {
        const pl = this;
        pl.writer.removeAllListeners('data');
        pl.writer.on('data',js=>pl.update(js));
    }
    stop(cb) {
        const pl = this;
        pl.writer.removeAllListeners('data');
        pl.writer.on('data',()=>{throw new Error("not ready to send data from engine");});
        super.stop(cb);
    }
    out(js,name,addr) {
        const   pl = this;
        const meta = addr ? {addr} : {};
        pl.reader.write(js.concat(meta));
    }
}
exports.StreamPlugin = StreamPlugin;

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

exports.registerEngine = eng=>{
    eng.on('mode',mode=>{
        if (mode==='master') {
            plugins.forEach(pl=>{
                pl.engine = eng;
                pl.update = (js,addr,misc={})=>{
                    if (js.length!==2 && typeof js[0]!=='string' & typeof js[1]!=='object')
                        throw new Error(`bad update record type: ${JSON.stringify(js)}`);
                    let src = pl.name;
                    if (typeof addr==='string')
                        src += ':'+addr;
                    else if (Array.isArray(addr))
                        src = [src,...addr];
                    const js2 = js.concat([_.extend({src},misc)]);
                    if (pl.chrjs===eng.chrjs)
                        eng.update(js2);
                    else if (pl.chrjs)
                        pl.chrjs.update(js2);
                    else
                        throw new Error(`plugin ${pl.name} trying to send while not connected`);
                };
                if (pl.eps)             // back compat with 0.7.x
                    pl.eps.update = pl.update;
                pl.ready();
            });
        }
    });
};

exports.get = name=>{
    let ans;
    plugins.filter(pl=>(pl.name===name)).forEach(pl=>{ans=pl;});
    return ans;
};

exports.add = (name,cl)=>{
    classes[name] = cl;
    cl.init({                   // use getters to fetch values lazily
        get addSubcommand() {return cmdline.addSubcommand;},
        get args()          {return cmdline.args;},
        get subcommands()   {return cmdline.subcommands;},
        get verbosity()     {return cmdline.verbosity;},
        package:            require('./package.json').name
    });
};

exports.require = name=>{
    /* eslint-disable security/detect-non-literal-require */
    let cl = classes[name];
    if (!cl) {
        try {
            require(`./plugins/${name}.js`);
        } catch (e1) {
            const malaya = require('./index.js');
            try {
                const pkg = require(`./plugins/${name}/package.json`);
                require(`./plugins/${name}/${pkg.main}`).init(malaya);
            } catch (e2) {
                //console.log(e2);
                require(`malaya-plugin-${name}`).init(malaya);
            }
        }
    }
    if (!classes[name])
        throw new Error(`can't load plugin ${name}`);
    return classes[name];
};

exports.setOverrides = os=>{
    overrides = os;
};

exports.instantiate = (plugin,name,opts)=>{
    const upds = {};
    if (opts===undefined && (name===undefined || typeof name==='object')) {
        opts = name || {};
        name = plugin;
    }
    overrides.forEach(([inst,k,v])=>{
        if (inst===name)
            upds[k] = v;
    });
    opts = Object.assign({},opts,upds);
    const pl = new classes[plugin](opts);
    pl.name = name;
    if (plugins.filter(pl1=>(pl1.name===pl.name)).length>0)
        throw new Error(`plugin named ${pl.name} twice`);
    plugins.push(pl);
    return pl;
};

exports.instantiateWriteStream = s=>{  // chars -> JSON
    if (Array.isArray(s)) {
        const insts = s.map(cl=>new cl());
        for (let i=0;i<insts.length-1;i++)
            insts[i].pipe(insts[i+1]);
        return new class extends stream.Duplex {
            constructor() {
                super({readableObjectMode:true});
            }
            pipe(s1,opts) {
                return insts[insts.length-1].pipe(s1,opts);
            }
            read(size) {
                return insts[insts.length-1].read(size);
            }
            write(chunk,enc,cb) {
                return insts[0].write(chunk,enc,cb);
            }
        }();
    } else
        return new s();
};

exports.instantiateReadStream = s=>{   // JSON -> chars
    if (Array.isArray(s)) {
        const insts = s.map(cl=>new cl());
        for (let i=insts.length-1;i>0;i--)
            insts[i].pipe(insts[i-1]);
        return new class extends stream.Duplex {
            constructor() {
                super({writableObjectMode:true});
            }
            on(ev,fn) {
                return insts[0].on(ev,fn);
            }
            once(ev,fn) {
                return insts[0].once(ev,fn);
            }
            pipe(s1,opts) {
                return insts[0].pipe(s1,opts);
            }
            read(size) {
                return insts[0].read(size);
            }
            write(chunk,enc,cb) {
                return insts[insts.length-1].write(chunk,enc,cb);
            }
        }();
    } else
        return new s();
};

exports.start = (cb=()=>{})=>{
    if (plugins.length===0)
        cb();
    else {
        const done = _.after(plugins.length,cb);
        plugins.forEach(pl=>pl.start(done));
    }
};
exports.stop = (cb=()=>{})=>{
    if (plugins.length===0)
        cb();
    else {                      // stop plugins in reverse order to starting them
        const done = _.after(plugins.length,cb);
        plugins.slice().reverse().forEach(pl=>pl.stop(done));
    }
};

function setStandardClasses() {
    classes.dummy = class extends StreamPlugin {};

    classes.timer = class extends Plugin {
        constructor(opts) {
            super(opts);
            const pl = this;
            pl.timer         = null;
            pl.opts.interval = opts.interval || 1000;
        }
        ready() {
            const pl = this;
            pl.timer = setInterval(()=>{
                pl.update(['tick',{t:Date.now()}]);
            },pl.opts.interval);
        }
        stop(cb) {
            const pl = this;
            if (!pl.timer)
                cb(new Error(`timer stopped when inactive`));
            else {
                clearInterval(pl.timer);
                pl.timer = null;
                super.stop(cb);
            }
        }
    };

    classes.restart = class extends Plugin {
        constructor(opts={}) {
            super(opts);
            const pl = this;
            pl.getData = opts.getData || (()=>{return {};});
        }
        ready() {
            const pl = this;
            pl.update(['restart',pl.getData()]);
        }
    };

    classes.fs = class extends Plugin {
        out([op,{filename,contents}],name,addr) {
            const pl = this;
                switch (op) {
                case 'readFile':
                    fs.readFile(filename,'utf8',(err,contents)=>{
                        pl.update(['readFile',err ?
                                   {err,filename} :
                                   {err,filename,contents} ]);
                    });
                    break;
                case 'writeFile':
                    fs.writeFile(filename,contents,err=>{
                        pl.update(['writeFile',{err,filename}]);
                    });
                    break;
                case 'listfiles':
                case 'move':
                case 'delete':
                    throw new Error('NYI');
                default:
                    throw new Error(`unknown file plugin operation: ${op}`);
                }
        }
    };

    classes.file = class extends Plugin {
        constructor({src,dst,Reader=whiskey.JSONParseStream,Writer=whiskey.StringifyJSONStream}) {
            super();
            const pl = this;
            pl.Reader  = Reader;
            pl.Writer  = Writer;
            pl.rs      = null;
            pl.ws      = null;
            pl.src     = src;
            pl.dst     = dst;
        }
        start(cb) {
            const pl = this;
            if (pl.src) {
                const rfs = fs.createReadStream(pl.src,{encoding:'utf8'});
                pl.rs = exports.instantiateWriteStream(pl.Reader);
                rfs.pipe(pl.rs);
                pl.rs.on('data',js=>{
                    if (!Array.isArray(js) || js.length!==2 || typeof js[0]!=='string' || typeof js[1]!=='object')
                        throw new Error(`dud input: ${JSON.stringify(js)}`);
                    else
                        pl.update(js);
                });
            }
            if (pl.dst) {
                const wfs = fs.createWriteStream(pl.dst,{encoding:'utf8'});
                pl.ws = new pl.Writer();
                pl.ws.pipe(wfs);
            }
            cb();
        }
        stop(cb) {
            const pl = this;
            if (pl.rs) {
                pl.rs.destroy();
                pl.rs = null;
            }
            if (pl.ws) {
                pl.ws.destroy();
                pl.ws = null;
            }
            cb();
        }
        out(js,name,addr) {
            const pl = this;
            pl.ws.write(js);
        }
    };

    // +++ more small plugins +++
}
setStandardClasses();

if (util.env==='test')
    exports._private = {
        forgetAll: ()=>{
            Object.values(classes).forEach(cl=>{delete classes[cl];});
            classes.length   = 0;
            plugins.length   = 0;
            overrides.length = 0;
        },
        reset: ()=>{
            Object.values(classes).forEach(cl=>{delete classes[cl];});
            classes.length   = 0;
            plugins.length   = 0;
            setStandardClasses();
        },
        plugins: plugins
    };
