"use strict";

// all-in-one command to administer malaya

const      fs = require('fs');
const    path = require('path');
const  VError = require('verror');
const  assert = require('assert');
const    util = require('./util.js');
const  execCP = require('child_process').exec;
const   chalk = require('chalk');

const tracing = require('./tracing');

// configure main arg parser

const argparse = new (require('argparse').ArgumentParser)({
    addHelp:     true,
    description: require('./package.json').description
});
argparse.addArgument(['-l','--long-lines'],
                     {
                         action:       'storeTrue',
                         defaultValue: false,
                         help:         "don't summarise JSON strings",
                         dest:         'long'
                     } );
argparse.addArgument(['-p','--prevalence-directory'],
                     {
                         action:       'store',
                         defaultValue: '.prevalence',
                         help:         "prevalence directory",
                         metavar:      'dir'
                     });
argparse.addArgument(['-q','--quiet'],
                     {
                         action:       'count',
                         defaultValue: 0,
                         help:         "be less verbose"
                     });
argparse.addArgument(['-v','--verbose'],
                     {
                         action:       'count',
                         defaultValue: 1,
                         help:         "be more verbose"
                     });
exports.argparse = argparse;

// configure subcommand parsers

const subparsers = argparse.addSubparsers({
    title: 'subcommands',
    dest:  'subcommandName'
});
const subcommands = exports.subcommands = {};

const addSubcommand = exports.addSubcommand = function(name,opts) {
    subcommands[name] = subparsers.addParser(name,opts);
    assert.strictEqual(subcommands[name].exec,undefined); // we'll be using this later
    return subcommands[name];
};

const argTypeMagicSpec = arg=>{
    const   ans = {};
    const items = arg.split(',');
    if (items.length===1 && items[0]==='')
        items.length = 0;
    items.forEach(it=>{
        const kv = it.split(':');
        if (kv.length===1)
            kv.push(true);
        else if (kv.length===2) {
            kv[1] = JSON.parse(kv[1]);
        } else
            throw new Error(`bad --auto spec item: ${it}`);
        if (!kv[0].startsWith('_'))
            kv[0] = '_'+kv[0];
        ans[kv[0]] = kv[1];
    });
    return ans;
};

const summariseJSON = tracing.summariseJSON;

addSubcommand('browse',{addHelp:true});
subcommands.browse.addArgument(
    ['what'],
    {
        action:       'store',
        help:         "path of URL"
    }
);

addSubcommand('cat',{addHelp:true});
subcommands.cat.addArgument(
    ['-f','--format'],
    {
        action:       'store',
        defaultValue: 'pretty',
        type:         s=>s.toLowerCase(),
        choices:      ['full','json','json5','pretty','yaml'],
        help:         "display format"
    }
);
subcommands.cat.addArgument(
    ['-j','--jmespath'],
    {
        action:       'store',
        defaultValue: null,
        help:         "jmespath expression to pass total expression through"
    }
);
subcommands.cat.addArgument(
    ['what'],
    {
        action:       'store',
        help:         "'journal', 'world', 'history' or <hash>"
    }
);

addSubcommand('compile',{addHelp:true});
subcommands.compile.addArgument(
    ['-D','--debug'],
    {
        action:       'storeTrue',
        defaultValue: false,
        help:         "generate debug code",
        dest:         'debug'
    }
);
subcommands.compile.addArgument(
    ['source'],
    {
        action:       'store',
        help:         "chrjs source file to compile"
    }
);

addSubcommand('client',{addHelp:true});
subcommands.client.addArgument(
    ['-a','--admin'],
    {
        action:       'storeConst',
        constant:     'admin',
        dest:         'urlPath',
        help:         "connect to an admin stream"
    }
);
subcommands.client.addArgument(
    ['-n','--noninteractive'],
    {
        action:       'store',
        nargs:        0,
        help:         "just stream the output, ignore input"
    }
);
subcommands.client.addArgument(
    ['-r','--replication'],
    {
        action:       'storeConst',
        constant:     'replication/journal',
        dest:         'urlPath',
        help:         "connect to a replication stream"
    }
);
subcommands.client.addArgument(
    ['url'],
    {
        action:       'store',
        nargs:        '?',
        help:         "URL to connect to: `ws://<host>:<port>/<path>`"
    }
);

addSubcommand('dump',{addHelp:true});
subcommands.dump.addArgument(
    ['-s','--serialise'],
    {
        action:       'storeTrue',
        help:         "use malaya extended JSON serialisation format"
    }
);

addSubcommand('exec',{addHelp:true});
subcommands.exec.addArgument(
    ['-D','--debug'],
    {
        action:       'storeTrue',
        defaultValue: false,
        help:         "generate debug code",
        dest:         'debug'
    }
);
subcommands.exec.addArgument(
    ['source'],
    {
        action:       'store',
        help:         "chrjs source file to exec"
    }
);

addSubcommand('fsck',{addHelp:true});

addSubcommand('init',{addHelp:true});
subcommands.init.addArgument(
    ['-d','--data'],
    {
        action:       'store',
        help:         "database to pilfer"
    }
);
subcommands.init.addArgument(
    ['--git'],
    {
        action:       'store',
        choices:      ['commit','push'],
        defaultValue: null,
        help:         "git action on world save"
    }
);
subcommands.init.addArgument(
    ['--clone'],
    {
        action:       'store',
        help:         "use the prevalence branch of named repo"
    }
);
subcommands.init.addArgument(
    ['--overwrite'],
    {
        action:       'storeTrue',
        defaultValue: false,
        help:         "reinit an existing prevalence directory"
    }
);
subcommands.init.addArgument(
    ['source'],
    {
        action:       'store',
        nargs:        '?',
        help:         "business logic source file"
    }
);

addSubcommand('journal',{addHelp:true});
subcommands.journal.addArgument(
    ['-n','--names'],
    {
        action:       'storeTrue',
        help:         "show only filenames",
        defaultValue: false
    }
);

addSubcommand('kill',{addHelp:true});
subcommands.kill.addArgument(
    ['signal'],
    {
        action:       'store',
        nargs:        '?',
        help:         "signal to send",
        defaultValue: 'SIGQUIT'
    }
);

addSubcommand('parse',{addHelp:true});
subcommands.parse.addArgument(
    ['-c','--stdout'],
    {
        action:       'storeTrue',
        defaultValue: false,
        help:         "output to stdout",
        dest:         'stdout'
    }
);
subcommands.parse.addArgument(
    ['source'],
    {
        action:       'store',
        help:         "chrjs source file to parse"
    }
);

addSubcommand('run',{addHelp:true});
subcommands.run.addArgument(
    ['--auto'],
    {
        action:       'store',
        defaultValue: null,
        type:         argTypeMagicSpec,
        help:         "magic events",
        dest:         'auto'
    }
);
subcommands.run.addArgument(
    ['--no-prefetch-bundles'],
    {
        action:       'storeFalse',
        defaultValue: true,
        help:         "don't prefetch browserify bundles at startup",
        dest:         'prefetchBundles'
    }
);
subcommands.run.addArgument(
    ['--no-tag-check'],
    {
        action:       'storeFalse',
        defaultValue: true,
        help:         "don't check tag",
        dest:         'tagCheck'
    }
);
subcommands.run.addArgument(
    ['-U','--admin-ui'],
    {
        action:       'storeTrue',
        defaultValue: false,
        help:         "start an admin UI browser session (implies --admin)",
        dest:         'adminUI'
    }
);
subcommands.run.addArgument(
    ['-a','--admin'],
    {
        action:       'storeTrue',
        defaultValue: false,
        help:         "start an admin UI browser session",
        dest:         'admin'
    }
);
subcommands.run.addArgument(
    ['-D','--debug'],
    {
        action:       'storeTrue',
        defaultValue: false,
        help:         "run in debug mode",
        dest:         'debug'
    }
);
subcommands.run.addArgument(
    ['--git'],
    {
        action:       'store',
        choices:      ['commit','push'],
        defaultValue: null,
        help:         "git action on world save"
    }
);
subcommands.run.addArgument(
    ['-m','--mode'],
    {
        action:       'store',
        choices:      ['idle','master','slave'],
        defaultValue: 'master',
        help:         "mode in which to start"
    }
);
subcommands.run.addArgument(
    ['-w','--web-port'],
    {
        action:       'store',
        defaultValue: 3000,
        type:         parseInt,
        dest:         'webPort',
        help:         "http port to listen on",
        metavar:      "port"
    });
subcommands.run.addArgument(
    ['-u','--master-url'],
    {
        action:       'store',
        help:         "URL from which to replicate",
        dest:         'masterUrl',
        metavar:      'url'
    }
);
if (util.env!=='prod')
    subcommands.run.addArgument(
        ['--private-test-urls'],
        {
            action:       'storeTrue',
            defaultValue: false,
            dest:         'privateTestUrls',
            help:         "not for you"
        }
    );
subcommands.run.addArgument(
    ['source'],
    {
        action:       'store',
        nargs:        '?',
        help:         "business logic source file"
    }
);

addSubcommand('save',{addHelp:true});

addSubcommand('status',{addHelp:true});

addSubcommand('transform',{addHelp:true});
subcommands.transform.addArgument(
    ['-D','--debug'],
    {
        action:       'storeTrue',
        defaultValue: false,
        help:         "run transform in debug mode",
        dest:         'debug'
    }
);
subcommands.transform.addArgument(
    ['--stdout'],
    {
        action:       'storeTrue',
        defaultValue: false,
        help:         "print transformed facts to stdout"
    }
);
subcommands.transform.addArgument(
    ['transform'],
    {
        action:       'store',
        help:         "chrjs source file for transform"
    }
);
subcommands.transform.addArgument(
    ['source'],
    {
        action:       'store',
        nargs:        '?',
        help:         "business logic source file"
    }
);


// now dispatch the subcommand

process.on('uncaughtException',function(err) {
    /*eslint-disable no-process-exit*/
    if (err instanceof util.Fail) {
        util.error(err.message);
        process.exit(100);
    } else {
        util.error(err.message);
        util.error(err.stack);
        process.exit(101);
    }
    /*eslint-enable no-process-exit*/
});

exports.run = function(opts0,argv2) {
    const          opts = opts0 || {};
    const          args = argparse.parseArgs(argv2);
    const prevalenceDir = path.resolve(args.prevalence_directory);
    const hashAlgorithm = opts.hashAlgorithm || util.hashAlgorithm;

    exports.verbosity = args.verbose-args.quiet;
    exports.args      = args;

    const findCallback = function() { // extract the callback for single-shot use.
        let cb;
        if (opts.callback) {
            cb = opts.callback;
            delete opts.callback;
        } else
            cb = function(){};
        return cb;
    };

    const checkDirectoriesExist = function() {
        if (!fs.existsSync(prevalenceDir))
            throw new VError("can't find prevalence directory");
        if (!fs.existsSync(path.join(prevalenceDir,'state')))
            throw new VError("can't find state directory");
    };

    const installSignalHandlers = function(eng) {
        /* eslint no-process-exit:0 */
        process.on('SIGINT',function() {
            process.stderr.write(' interrupt\n');
            if (eng)
                eng.stopPrevalence(false,function(){eng.stop();});
            process.exit(1);
        });
        process.on('SIGQUIT',function() {
            process.stderr.write(' quit\n');
            if (eng)
                eng.stopPrevalence(true,function(){eng.stop();});
            process.exit(1);
        });
        process.on('SIGTERM',function() {
            process.stderr.write(' term\n');
            process.exit(1);
        });
        process.on('SIGHUP',function() {
            if (eng && eng.mode==='master') {
                eng.stopPrevalence(false,function(err) {
                    eng.startPrevalence();
                });
            }
        });
        process.on('exit',function(code) {
            if (eng)
                eng.broadcast(['close',code],'admin');
        });
    };

    const compile = function(source,options) {
        const    parse = require('./parser.js').parse;
        const compiler = require('./compiler.js');
        const   recast = require('recast');
        const   crypto = require('crypto');
        const  content = fs.readFileSync(source,'utf8');
        const   hasher = crypto.createHash('sha1');
        compiler.debug = args.debug;
        options        = options || {loc:compiler.debug,attrs:true};
        hasher.write(compiler.mkCachePrefix(options));
        hasher.write(content);
        const        h = hasher.digest('hex');
        const  ccached = path.join(process.cwd(),'.ccache',h);
        try {
            return fs.readFileSync(ccached,'utf8');
        } catch (e1) {
            const chrjs = parse(content,options);
            const  code = recast.print(compiler.compile(chrjs)).code;
            try {
                fs.writeFileSync(ccached,code);
            } catch (e2) {
                // empty
            }
            return code;
        }
    };

    const fmtJSON = js=>tracing.fmtJSON(js,{long:args.long});
    const fmtFact = f=>tracing.fmtFact(f,{long:args.long});

    // optional decency checking: don't put undefined in store
    const sanityCheckChrjsAdds = function(chrjs,source) {
        const         _ = require('underscore');
        const  compiler = require('./compiler.js');
        const   ruleMap = compiler.getRuleMap(source);
        const  mySource = path.relative(process.cwd(),source);
        let  activeRule = null;
        const findUndef = js=>{
            if (js===undefined)
                return true;
            if (typeof js==='object')
                return _.some(_.values(js),findUndef);
            return false;
        };
        const loc = ()=>activeRule ?
              `rule ${mySource}:${ruleMap[activeRule].start.line}` :
              "something";
        chrjs.on('queue-rule',function(id,bindings) {
            activeRule = id;
        });
        chrjs.on('add',function(t,f) {
            if (![2,3].includes(f.length) || typeof f[0]!=='string' || typeof f[1]!=='object')
                console.log(chalk.yellow(`${loc()} added dubious `)+fmtFact(f));
            if (findUndef(f))
                console.log(chalk.yellow(`${loc()} added undef-y `)+fmtFact(f));
        });
    };

    const traceChrjs = (chrjs,source)=>tracing.trace(chrjs,source,{long:args.long});

    const _createEngine = opts.createEngine || function(options) {
        const engine = require('./engine.js');
        const    eng = new engine.Engine(options);
        return eng;
    };

    const createEngine = function(options) {
        options               = options || {};
        options.prevalenceDir = prevalenceDir;
        const eng = _createEngine(options);
        eng.on('mode',function(mode) {
            console.log(chalk.yellow(util.format("mode now: %s",mode)));
            if (mode==='broken' && args.admin)
                process.exit(1);
        });
        eng.on('slave',function(where) {
            if (where)
                console.log("slave online at: %j",where);
            else
                console.log("slave offline");
        });
        return eng;
    };

    const kill = function(sig) {
        checkDirectoriesExist();
        const lock = require("./lock.js");
        const data = lock.lockDataSync(path.join(prevalenceDir,'lock'));
        if (data===null || data.pid===null)
            console.log("not running");
        else
            process.kill(data.pid,sig);
    };

    const mkClientStream = function(what) {
        checkDirectoriesExist();
        const lock = require("./lock.js");
        const data = lock.lockDataSync(path.join(prevalenceDir,'lock'));
        if (data===null || data.pid===null) {
            console.log("not running");
            return null;
        } else {
            const ports = JSON.parse(fs.readFileSync(path.join(prevalenceDir,'ports')),'utf8');
            const    WS = require('websocket-stream');
            const    ws = new WS(`ws://localhost:${ports.http}/${what}`);
            return ws;
        }
    };

    const findSource = function(){
        const possibilities = ['bl.chrjs','index.malaya'];
        for (const p of possibilities)
            if (fs.existsSync(p))
                return p;
        throw new VError("can't find a default malaya source file");
    };

    subcommands.cat.exec = function() {
        const  engine = require('./engine.js');
        const whiskey = require('./whiskey.js');
        const   JSON5 = require('json5');
        const  getFmt = (s,what)=>{
            switch (s) {
            case 'full':
                return new whiskey.StringifyObjectStream(util.serialise);
            case 'json':
                return new whiskey.StringifyJSONStream();
            case 'json5': {
                return new whiskey.StringifyObjectStream(JSON5.stringify);
            }
            case 'yaml': {
                const yaml = require('js-yaml');
                return new whiskey.StringifyObjectStream(yaml.safeDump);
            }
            case 'pretty':
                switch (what) {
                case 'history':
                case 'journal':
                    return new whiskey.StringifyObjectStream(
                        j=>
                            chalk.yellow(new Date(j[0]).toISOString())+' '+
                            chalk.yellow(j[1])+' '+
                            (j[1]==='update' ? fmtFact(j[2]) : fmtJSON(j[2]))
                    );
                case 'facts':
                    return new whiskey.StringifyObjectStream(fmtFact);
                case 'world': {
                    let i = 0;
                    return new whiskey.StringifyObjectStream(j=>{
                        switch (++i) {
                        case 1:
                            return fmtJSON(j);
                        case 2: {
                            let ans = '';
                            Object.keys(j).forEach(k=>{
                                if (k==='chrjs') {
                                    ans += `   chrjs: {\n`;
                                    Object.keys(j.chrjs).forEach(k1=>{
                                        if (k1==='facts') {
                                            ans += `      facts: {\n`;
                                            Object.keys(j.chrjs.facts).forEach(k2=>{
                                                const id = `${k2}:`.padEnd(j.chrjs.t.toString().length+1,' ');
                                                ans += `         ${id} ${fmtFact(j.chrjs.facts[k2])},\n`;
                                            });
                                            if (Object.keys(j.chrjs.facts).length>0)
                                                ans = ans.slice(0,-2)+'\n';
                                            ans += `      },\n`;
                                        } else
                                            ans += `      ${k1}: ${fmtJSON(j.chrjs[k1])},\n`;
                                    });
                                    ans  = ans.slice(0,-2)+'\n';
                                    ans += `   },\n`;
                                } else
                                    ans += `   ${k}: ${fmtJSON(j[k])},\n`;
                            });
                            return `{\n${ans}}`;
                        }
                        default:
                            throw new Error('SNO');
                        }
                    });
                }
                default:
                    throw new Error('SNO');
                }
            default:
                throw new Error("SNO");
            }
        };
        const     out = new whiskey.LineStream(util.deserialise);
        const     dst = getFmt(args.format,args.what);
        dst.pipe(process.stdout);
        checkDirectoriesExist();
        let out1 = out;
        if (args.jmespath) {
            const   stream = require('stream');
            const jmespath = require('jmespath');
            out1 = stream.PassThrough({objectMode:true});
            require("stream-to-array")(out,(err,arr)=>{
                if (err)
                    throw err;
                else {
                    const ans = jmespath.search(arr,args.jmespath);
                    if (!ans)
                        throw new Error("jmespath failed");
                    ans.forEach(e=>out1.write(e));
                    out1.end();
                }
            });
        }
        out1.pipe(dst);
        switch (args.what) {
        case 'journal':
        case 'world':
            fs.createReadStream(path.join(prevalenceDir,'state',args.what)).pipe(out);
            break;
        case 'facts': {
            const ws = mkClientStream('admin');
            if (ws) {
                const jsps = new whiskey.JSONParseStream();
                let      n = 0;
                ws.pipe(jsps);
                jsps.on('readable',()=>{
                    const js = jsps.read();
                    switch (++n) {
                    case 1:
                        if (js[0]!=='engine')
                            throw new Error("bad first packet: %j",js);
                        break;
                    case 2: {
                        const x = args.jmespath ? {jmespath:args.jmespath} : {};
                        if (js[0]!=='connection')
                            throw new Error("bad second packet: %j",js);
                        ws.write(JSON.stringify(['facts',x])+'\n');
                        break;
                    }
                    case 3:
                        if (js!==null)
                            js.forEach(j=>dst.write(j));
                        ws.end();
                        break;
                    }
                });
            }
            break;
        }
        case 'history': {
            engine.buildHistoryStream(
                prevalenceDir,
                (err,history)=>{
                    if (err) throw err;
                    history.pipe(out);
                });
            break;
        }
        default: {
            const hstore = engine.makeHashes(prevalenceDir);
            fs.createReadStream(hstore.makeFilename(args.what)).pipe(out);
            break;
        }
        };
    };

    subcommands.compile.exec = function() {
        args.source = args.source || findSource();
        fs.writeFileSync(args.source+'.js',compile(args.source));
    };

    subcommands.exec.exec = function() {
        const vm = require('vm');
        args.source = args.source || findSource();
        vm.runInNewContext(compile(args.source),{
            require:require,
            console:console});
    };

    subcommands.fsck.exec = function() {
        const    hash = require('./hash.js');
        const whiskey = require('./whiskey.js');
        const  engine = require('./engine.js');
        const  hashes = hash(util.hashAlgorithm).makeStore(path.join(prevalenceDir,'hashes'));
        let        ok = true;
        checkDirectoriesExist();
        try {
            const lines = fs.readFileSync(path.join(prevalenceDir,'state/world'),'utf8').split('\n');
            assert.strictEqual(lines[lines.length-1],'');
            lines.pop();
            if (lines.length!==2)
                throw new VError("wrong number of lines in world file: %s",lines.length);
            lines.forEach(l=>util.deserialise(l));
        } catch (e) {
            console.log("error in world file: %s",e.message);
            ok = false;
        }
        try {
            const lines = fs.readFileSync(path.join(prevalenceDir,'state/journal'),'utf8').split('\n');
            assert.strictEqual(lines[lines.length-1],'');
            lines.pop();
            lines.forEach(l=>util.deserialise(l));
        } catch (e) {
            console.log("error in journal file: %s",e.message);
            ok = false;
        }
        hashes.sanityCheck(err=>{console.log(err);ok=false;}); // this is sync really
        engine.buildHistoryStream(prevalenceDir,(err,rf)=>{    // this is sync really
            let first = true;
            if (err) {
                console.log("error in journal chaining: %s",err.message);
                ok = false;
            } else {
                const rj = new whiskey.LineStream(util.deserialise);
                let    t;
                rf.pipe(rj);
                rj.on('data',js=>{
                    if (typeof js[0]!=="number") {
                        console.log("error in history: first item not a number: %j",js[0]);
                        ok = false;
                    } else {
                        if (!first) {
                            if (t>js[0]) {
                                console.log("error in history: not monotonic: %j %j",t,js[0]);
                                ok = false;
                            }
                        }
                        t = js[0];
                    }
                    switch (js[1]) {
                    case 'init':
                        if (!first) {
                            console.log("error in history: 'init' occurs after start: %j",js);
                            ok = false;
                        }
                        break;
                    case 'previous':
                        if (js.length!==4) {
                            console.log("error in history: bad 'previous': %j",js);
                            ok = false;
                        }
                        break;
                    case 'code':
                        if (!Array.isArray(js[2])) {
                            console.log("error in history: code expects an array",js);
                            ok = false;
                        }
                        Object.keys(js[2][2]).forEach(k=>{
                            const h = js[2][2][k];
                            if (!fs.existsSync(path.join(prevalenceDir,'hashes',h))) {
                                console.log("error in history: code item not found in store: %j",h);
                                ok = false;
                            }
                        });
                        break;
                    case 'http':
                        if (!Array.isArray(js[2])) {
                            console.log("error in history: http expects an array",js);
                            ok = false;
                        }
                        if (!fs.existsSync(path.join(prevalenceDir,'hashes',js[2][1]))) {
                            console.log("error in history: http item not found in store: %j",js[2][1]);
                            ok = false;
                        }
                        break;
                    case 'update':
                        if (!Array.isArray(js[2])) {
                            console.log("error in history: update expects an array",js);
                            ok = false;
                        }
                        break;
                    default:
                        console.log("error in history: unknown item: %j",js);
                        ok = false;
                    }
                    if (first) {
                        if (js[1]!=='init') {
                            console.log("history does not start with init: %j",js);
                            ok = false;
                        }
                        first = false;
                    }
                });
            }
        });
        if (!ok)
            throw new util.Fail("errors were found");
    };

    subcommands.init.exec = function() {
        args.source = args.source || findSource();
        if ((args.git || args.clone) && args.overwrite)
            throw new VError("git/clone and overwrite don't mix");
        const eng = createEngine({
            businessLogic:path.resolve(args.source),
            git:          args.git,
            overwrite:    args.overwrite});
        const  cb = findCallback();
        if (args.clone)
            eng.initFromRepo(args.clone);
        else {
            eng.init();
            eng.start();
            if (args.data) {
                eng.startPrevalence(function(err1) {
                    if (err1)
                        cb(err1);
                    else
                        eng.loadData(args.data,function(err2) {
                            if (err2)
                                cb(err2);
                            else
                                eng.stopPrevalence(false,function(err3) {
                                    cb(err3);
                                });
                        });
                });
            }
        }
    };

    subcommands.kill.exec = function() {
        let sig = parseInt(args.signal);
        if (isNaN(sig)) {
            sig = args.signal.toUpperCase();
            if (!sig.startsWith('SIG'))
                sig = 'SIG'+sig;
        }
        kill(sig);
    };

    subcommands.parse.exec = function() {
        const compiler = require('./compiler.js');
        args.source = args.source || findSource();
        const out = JSON.stringify(compiler.parseFile(args.source));
        if (args.stdout)
            process.stdout.write(out);
        else
            fs.writeFileSync(args.source+'.json',out);
    };

    subcommands.run.exec = function() {
        checkDirectoriesExist();
        require('./compiler.js'); // for Malaya* globals
        if (args.adminUI)
            args.admin = true;
        args.source = args.source || findSource();
        const   source = path.resolve(args.source);
        const  options = {businessLogic:   source,
                          admin:           args.admin,
                          debug:           args.debug,
                          git:             args.git,
                          ports:           {http:args.webPort},
                          magic:           args.auto,
                          masterUrl:       args.masterUrl,
                          privateTestUrls: args.privateTestUrls};
        const      eng = createEngine(options);
        const    ports = {};
        eng._bindGlobals();
        eng.on('listen',function(protocol,port) {
            console.log("%s listening on *:%s",protocol,port);
            if (args.adminUI && protocol==='http') {
                execCP(util.format("chromium -disk-cache-dir=/dev/null -app='http://%s:%d/%s'",
                                   'localhost',
                                   options.ports.http,
                                   "admin.html"),
                       function(err,stdout,stderr) {
                           if (err) {
                               console.log("can't start admin browser: %s",err);
                           }
                       });
            }
            if (args.prefetchBundles) {
                const http = require('http');
                for (const k in eng.options.bundles) {
                    http.request({
                        port:args.webPort,
                        path:k
                    }).end();
                }
            }
            ports[protocol] = port;
            if (Object.keys(ports).length===Object.keys(options.ports).length)  // all ports listening?
                fs.writeFileSync(path.join(eng.prevalenceDir,'ports'),JSON.stringify(ports));
        });
        process.on('exit',()=>{
            fs.unlinkSync(path.join(eng.prevalenceDir,'ports'));
        });
        eng.on('saved',function(syshash,worldHash,journalHash) {
            console.log("closing hash:  %s",journalHash);
        });
        eng.on('loaded',function(syshash,worldHash,journalHash) {
            console.log("loaded: %s",journalHash);
        });
        eng.start();
        if (args.debug) {
            sanityCheckChrjsAdds(eng.chrjs,source);
            traceChrjs(eng.chrjs,source);
            eng.on('out',(dest,data)=>{ // we have clobbered the one in chrjs
                console.log("%s %j %s",chalk.yellow('<'),dest,summariseJSON(data));
            });
        }
        installSignalHandlers(eng);
        eng.become(args.mode);
    };

    subcommands.transform.exec = function() {
        checkDirectoriesExist();
        require('./compiler.js'); // for .chrjs extension
        const     cb = findCallback();
        const engine = require('./engine.js');
        const    eng = createEngine({debug:args.debug});
        const source = path.resolve(process.cwd(),args.transform);
        const  chrjs = require(source);
        const  print = args.stdout;
        eng.chrjs = args.source ? require(path.resolve(args.source)) : engine.makeInertChrjs();
        eng.start();
        if (args.debug) {
            sanityCheckChrjsAdds(eng.chrjs,source);
            traceChrjs(chrjs,source);
        }
        eng.startPrevalence(function(err) {
            for (let t=1;t<eng.chrjs.t;t++) {
                const fact = eng.chrjs.get(t+'');
                if (fact) {
                    if (!(fact instanceof Array && fact.length===2)) {
                        console.log("bad fact in store to be transformed: %j",fact);
                    }
                    else  {
                        chrjs.add([fact[0],fact[1],{keep:false}]);
                    }
                }
            }
            chrjs.add(['_transform',{},{keep:false}]); // for global operations
            if (print) {
                for (let t=1;t<chrjs.t;t++) {
                    const fact = chrjs.get(t+'');
                    if (fact) {
                        if (!(fact instanceof Array && [2,3].indexOf(fact.length)!==-1))
                            return cb(new VError("bad fact from transform: %j",fact));
                        if (fact.length===2 || fact[2].keep)
                            process.stdout.write(JSON.stringify(fact)+'\n');
                    }
                }
            } else {
                // +++ create a `state-NEW` directory to put this in until it's known to be good +++
                eng.journaliseCodeSources('transform',args.transform,true,function(err1) {
                    if (err1)
                        cb(err1);
                    else {
                        eng.chrjs = engine.makeInertChrjs();
                        for (let t=1;t<chrjs.t;t++) {
                            const fact = chrjs.get(t+'');
                            if (fact) {
                                if (!(fact instanceof Array && [2,3].indexOf(fact.length)!==-1))
                                    return cb(new VError("bad fact from transform: %j",fact));
                                if (fact.length===2 || fact[2].keep)
                                    eng.chrjs.add([fact[0],fact[1]]);
                            }
                        }
                    }
                    return null;
                });
            }
            eng.stopPrevalence(false,cb);
            return null;
        });
    };

    subcommands.save.exec = function() {
        kill('SIGHUP');
    };

    subcommands.status.exec = function() {
        checkDirectoriesExist();
        const   lock = require("./lock.js");
        const moment = require('moment');
        const  pLock = path.join(prevalenceDir,'lock');
        const   data = lock.lockDataSync(pLock);
        const   hash = require('./hash.js')(hashAlgorithm);
        const hstore = hash.makeStore(path.join(prevalenceDir,'hashes'));
        const   tfmt = "YYYY-MM-DD HH:mm:ss";
        console.log("stashed: %d hashes",hstore.getHashes().length);
        if (data===null || data.pid===null)
            console.log("server:  not running");
        else {
            const    stLock = fs.statSync(pLock);
            const    pWorld = path.join(prevalenceDir,'state','world');
            const   stWorld = fs.statSync(pWorld);
            const stJournal = fs.statSync(path.join(prevalenceDir,'state','journal'));
            util.readFileLinesSync(pWorld,function(l) {
                console.log("syshash: %s",util.deserialise(l));
                return false;
            });
            console.log("server:\t running (pid %d) since %s",data.pid,moment(stLock.mtime).format(tfmt));
            console.log("world:\t %d bytes, saved at %s",stWorld.size,  moment(stWorld.mtime).format(tfmt));
            console.log("journal: %d bytes, updated %s",stJournal.size,moment(stJournal.mtime).format(tfmt));
            for (const k in data.ports) {
                console.log("%s:\t listening on *:%d",k,data.ports[k]);
            }
        }
    };

    subcommands.dump.exec = function() {
        checkDirectoriesExist();
        const engine = require('./engine.js');
        const    eng = createEngine({});
        eng.chrjs = engine.makeInertChrjs();
        eng.start();
        for (let t=1;t<eng.chrjs.t;t++) {
            const fact = eng.chrjs.get(t+'');
            if (fact) {
                const text = args.serialise ? util.serialise(fact) : JSON.stringify(fact);
                process.stdout.write(text);
                process.stdout.write('\n');
            }
        }
    };

    subcommands.client.exec = function() {
        const client = require('./client.js');
        let      url = args.url || client.findURL(args.urlPath);
        if (args.urlPath && args.url)
            throw new VError("can't specify URL and connection type");
        if (!url)
            throw new VError("can't find a server to connect to");
        if (util.startsWith(url,'ws')) // allow as alternate protocol part
            url = 'http'+url.slice(2);
        if (args.noninteractive)
            client.nonInteractive(url);
        else
            client.repl(url);
    };

    subcommands.journal.exec = function() {
        checkDirectoriesExist();
        const eng = createEngine({});
        eng._makeHashes();
        if (args.names)
            eng.journalChain(function(err,hs) {
                if (err)
                    throw err;
                hs.forEach(function(h) {
                    process.stdout.write(h+'\n');
                });
            });
        else
            eng.buildHistoryStream((err,read)=>{
                if (err)
                    throw err;
                read.pipe(process.stdout);
            });
    };

    if (opts.tweakSubcommands)
        opts.tweakSubcommands({prevalenceDir});

    if (subcommands[args.subcommandName]===undefined)
        throw new VError("unknown subcommand: %s",args.subcommandName);
    if (subcommands[args.subcommandName].exec===undefined)
        throw new VError("NYI: subcommand `%s`",args.subcommandName);

    subcommands[args.subcommandName].exec(args);

    findCallback()(null);
};

if (util.env==='test') {
    exports._private = {argTypeMagicSpec:argTypeMagicSpec};
}
