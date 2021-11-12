"use strict";

// all-in-one command to administer malaya

const       fs = require('fs');
const     path = require('path');
const   VError = require('verror');
const   assert = require('assert');
const     util = require('./util.js');
const   execCP = require('child_process').exec; // eslint-disable-line security/detect-child-process
const    chalk = require('chalk');

const  tracing = require('./tracing');

// configure main arg parser

const argparse = new (require('argparse').ArgumentParser)({
    add_help:     true,
    description: require('./package.json').description
});
argparse.add_argument('-l','--long-lines',
                     {
                         action:  'store_const',
                         const:   true,
                         default: null,
                         help:    "don't summarise JSON strings",
                         dest:    'long'
                     } );
argparse.add_argument('-p','--prevalence-directory',
                     {
                         action:  'store',
                         default: '.prevalence',
                         help:    "prevalence directory",
                         metavar: 'dir'
                     });
argparse.add_argument('-q','--quiet',
                     {
                         action:  'count',
                         default: 0,
                         help:    "be less verbose"
                     });
argparse.add_argument('-v','--verbose',
                     {
                         action:  'count',
                         default: 1,
                         help:    "be more verbose"
                     });
argparse.add_argument('-P','--plugin',
                     {
                         action:  'append',
                         default: [],
                         help:    "plugin to load"
                     });
argparse.add_argument('-O','--override',
                     {
                         action:  'append',
                         default: [],
                         type:    s=>{
                             let m = s.match(/([^.]+)\.([^=]+)=(.*)/);
                             if (m)
                                 return ['parameters',m[1],m[2],JSON.parse(m[3])];
                             m = s.match(/([^.]+)=(.*)/);
                             if (m)
                                 return ['plugins',m[1],m[2]];
                             m = s.match(/=(.*)/);
                             if (m)
                                 return ['plugins',null,m[1]];
                             else
                                 throw new Error(`bad override spec: ${s}`);
                         },
                         help:         "plugin setting to override"
                     });
exports.argparse = argparse;

// configure subcommand parsers

const subparsers = argparse.add_subparsers({
    title: 'subcommands',
    dest:  'subcommandName'
});
const subcommands = exports.subcommands = {};

const addSubcommand = exports.addSubcommand = function(name,opts) {
    subcommands[name] = subparsers.add_parser(name,opts);
    assert.strictEqual(subcommands[name].exec,undefined); // we'll be using this later
    return subcommands[name];
};

addSubcommand('browse',{add_help:true});
subcommands.browse.add_argument(
    'what',
    {
        action:  'store',
        help:    "path of URL"
    }
);

addSubcommand('cat',{add_help:true});
subcommands.cat.add_argument(
    '-e','--end',
    {
        action:  'store',
        dest:    'end',
        help:    "hash on which to end"
    }
);
subcommands.cat.add_argument(
    '-f','--format',
    {
        action:  'store',
        default: null,
        type:    s=>s.toLowerCase(),
        choices: ['full','json','json5','pretty','yaml'],
        help:    "display format"
    }
);
subcommands.cat.add_argument(
    '-r','--run',
    {
        action:  'store',
        default: null,
        type:    s=>s.toLowerCase(),
        help:    "run id"
    }
);
subcommands.cat.add_argument(
    '-M','--map',
    {
        action:  'append',
        dest:    'pipeline',
        type:    s=>['map',s],
        help:    "add map element to result pipeline "
    }
);
subcommands.cat.add_argument(
    '-F','--filter',
    {
        action:  'append',
        dest:    'pipeline',
        type:    s=>['filter',s],
        help:    "add filter element to result pipeline "
    }
);
subcommands.cat.add_argument(
    '-A','--accum',
    {
        action:  'store',
        dest:    'accum',
        type:    JSON.parse,
        help:    "seed for reduce"
    }
);
subcommands.cat.add_argument(
    '-R','--reduce',
    {
        action:  'store',
        dest:    'reduce',
        help:    "add final reduce element to result pipeline "
    }
);
subcommands.cat.add_argument(
    'what',
    {
        action:  'store',
        help:    "'journal', 'world', 'history' or <hash>"
    }
);

addSubcommand('compile',{add_help:true});
subcommands.compile.add_argument(
    '-D','--debug',
    {
        action:  'store_true',
        default: false,
        help:    "generate debug code",
        dest:    'debug'
    }
);
subcommands.compile.add_argument(
    'source',
    {
        action:  'store',
        help:    "chrjs source file to compile"
    }
);

addSubcommand('client',{add_help:true});
subcommands.client.add_argument(
    '-a','--admin',
    {
        action:  'store_const',
        const:   'admin',
        dest:    'urlPath',
        help:    "connect to an admin stream"
    }
);
subcommands.client.add_argument(
    '-n','--noninteractive',
    {
        action:  'store_true',
        help:    "just stream the output, ignore input"
    }
);
subcommands.client.add_argument(
    '-r','--replication',
    {
        action:  'store_const',
        const:   'replication/journal',
        dest:    'urlPath',
        help:    "connect to a replication stream"
    }
);
subcommands.client.add_argument(
    'url',
    {
        action:  'store',
        nargs:   '?',
        help:    "URL to connect to: `ws://<host>:<port>/<path>`"
    }
);

addSubcommand('dump',{add_help:true});
subcommands.dump.add_argument(
    '-s','--serialise',
    {
        action:  'store_true',
        help:    "use malaya extended JSON serialisation format"
    }
);

addSubcommand('exec',{add_help:true});
subcommands.exec.add_argument(
    '-D','--debug',
    {
        action:  'store_true',
        default: false,
        help:    "generate debug code",
        dest:    'debug'
    }
);
subcommands.exec.add_argument(
    '-m','--mode',
    {
        action:  'store',
        choices: ['idle','master','slave'],
        default: 'master',
        help:    "mode in which to start"
    }
);
if (util.env!=='prod')
    subcommands.exec.add_argument(
        '--private-test-urls',
        {
            action:  'store_true',
            default: false,
            dest:    'privateTestUrls',
            help:    "not for you"
        }
    );
subcommands.exec.add_argument(
    '-w','--web-port',
    {
        action:  'store',
        default: 3000,
        type:    parseInt,
        dest:    'webPort',
        help:    "http port to listen on",
        metavar: "port"
    }
);
subcommands.exec.add_argument(
    'source',
    {
        action: 'store',
        help:   "chrjs source file to exec"
    }
);

addSubcommand('fsck',{add_help:true});

addSubcommand('init',{add_help:true});
subcommands.init.add_argument(
    '-d','--data',
    {
        action:  'store',
        help:    "database to pilfer"
    }
);
subcommands.init.add_argument(
    '--git',
    {
        action:  'store',
        choices: ['commit','push'],
        default: null,
        help:    "git action on world save"
    }
);
subcommands.init.add_argument(
    '--clone',
    {
        action:  'store',
        help:    "use the prevalence branch of named repo"
    }
);
subcommands.init.add_argument(
    '--overwrite',
    {
        action:  'store_true',
        default: false,
        help:    "reinit an existing prevalence directory"
    }
);
subcommands.init.add_argument(
    '-r','--rng-seed',
    {
        action:  'store',
        type:    parseInt,
        default: null,
        help:    "seed the random number generator",
        dest:    'rngSeed'
    }
);
subcommands.init.add_argument(
    'source',
    {
        action: 'store',
        nargs:  '?',
        help:   "business logic source file"
    }
);

addSubcommand('kill',{add_help:true});
subcommands.kill.add_argument(
    'signal',
    {
        action:  'store',
        nargs:   '?',
        help:    "signal to send",
        default: 'SIGQUIT'
    }
);

addSubcommand('list',{add_help:true});
subcommands.list.add_argument(
    '-r','--run',
    {
        action:  'store',
        default: null,
        type:    s=>s.toLowerCase(),
        help:    "run id"
    }
);
subcommands.list.add_argument(
    'what',
    {
        action:  'store',
        help:    "'history-files', 'runs'"
    }
);

addSubcommand('parse',{add_help:true});
subcommands.parse.add_argument(
    '-c','--stdout',
    {
        action:  'store_true',
        default: false,
        help:    "output to stdout",
        dest:    'stdout'
    }
);
subcommands.parse.add_argument(
    'source',
    {
        action:  'store',
        help:    "chrjs source file to parse"
    }
);

addSubcommand('replay',{add_help:true});
subcommands.replay.add_argument(
    '-c','--command',
    {
        action:  'append',
        default: [],
        help:    "replay command to execute",
        dest:    'commands'
    }
);
subcommands.replay.add_argument(
    '-r','--run',
    {
        action:  'store',
        default: null,
        type:    s=>s.toLowerCase(),
        help:    "run id"
    }
);
subcommands.replay.add_argument(
    'source',
    {
        action:  'store',
        nargs:   '?',
        help:    "business logic source file"
    }
);

addSubcommand('revisit',{add_help:true});
subcommands.revisit.add_argument(
    '-r','--run',
    {
        action:  'store',
        default: null,
        type:    s=>s.toLowerCase(),
        help:    "run id"
    }
);
subcommands.revisit.add_argument(
    'source',
    {
        action:  'store',
        help:    "analysis source file"
    }
);

addSubcommand('run',{add_help:true});
subcommands.run.add_argument(
    '--no-prefetch-bundles',
    {
        action:  'store_false',
        default: true,
        help:    "don't prefetch browserify bundles at startup",
        dest:    'prefetchBundles'
    }
);
subcommands.run.add_argument(
    '--no-tag-check',
    {
        action:  'store_false',
        default: true,
        help:    "don't check tag",
        dest:    'tagCheck'
    }
);
subcommands.run.add_argument(
    '-U','--admin-ui',
    {
        action:  'store_true',
        default: false,
        help:    "start an admin UI browser session (implies --admin)",
        dest:    'adminUI'
    }
);
subcommands.run.add_argument(
    '-a','--admin',
    {
        action:  'store_true',
        default: false,
        help:    "start an admin UI browser session",
        dest:    'admin'
    }
);
subcommands.run.add_argument(
    '-D','--debug',
    {
        action:  'store_true',
        default: false,
        help:    "run in debug mode",
        dest:    'debug'
    }
);
subcommands.run.add_argument(
    '--git',
    {
        action:  'store',
        choices: ['commit','push'],
        default: null,
        help:    "git action on world save"
    }
);
subcommands.run.add_argument(
    '-m','--mode',
    {
        action:  'store',
        choices: ['idle','master','slave'],
        default: 'master',
        help:    "mode in which to start"
    }
);
subcommands.run.add_argument(
    '-w','--web-port',
    {
        action:  'store',
        default: 3000,
        type:    parseInt,
        dest:    'webPort',
        help:    "http port to listen on",
        metavar: "port"
    });
subcommands.run.add_argument(
    '-u','--master-url',
    {
        action:  'store',
        help:    "URL from which to replicate",
        dest:    'masterUrl',
        metavar: 'url'
    }
);
if (util.env!=='prod')
    subcommands.run.add_argument(
        '--private-test-urls',
        {
            action:  'store_true',
            default: false,
            dest:    'privateTestUrls',
            help:    "not for you"
        }
    );
subcommands.run.add_argument(
    'source',
    {
        action:  'store',
        nargs:   '?',
        help:    "business logic source file"
    }
);

addSubcommand('save',{add_help:true});

addSubcommand('status',{add_help:true});

addSubcommand('term',{add_help:true});

addSubcommand('transform',{add_help:true});
subcommands.transform.add_argument(
    '-D','--debug',
    {
        action:  'store_true',
        default: false,
        help:    "run transform in debug mode",
        dest:    'debug'
    }
);
subcommands.transform.add_argument(
    '-r','--run',
    {
        action:  'store',
        default: null,
        type:    s=>s.toLowerCase(),
        help:    "run id"
    }
);
subcommands.transform.add_argument(
    '--stdout',
    {
        action:  'store_true',
        default: false,
        help:    "print transformed facts to stdout"
    }
);
subcommands.transform.add_argument(
    'transform',
    {
        action:  'store',
        help:    "chrjs source file for transform"
    }
);
subcommands.transform.add_argument(
    'source',
    {
        action:  'store',
        nargs:   '?',
        help:    "business logic source file"
    }
);

addSubcommand('wait',{add_help:true});
subcommands.wait.add_argument(
    '--timeout',
    {
        action:  'store',
        type:    parseInt,
        default: null,
        help:    "wait for local malaya to change state",
        dest:    'timeout'
    }
);
subcommands.wait.add_argument(
    'state',
    {
        action:  'store',
        choices: ['stop'],
        default: 'master',
        help:    "event to await"
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

function stripPluginArgs(args) {
    const plugins = [];
    while (args.length>1 && ['-P','--plugin'].includes(args[0])) {
        plugins.push(args[1]);
        args = args.slice(2);
    }
    return [plugins,args];
}

exports.run = function(opts={},argv2=process.argv.slice(2)) {
    const [plugins,argv2a] = stripPluginArgs(argv2);

    plugins.forEach(p=>require('./plugin.js').require(p));

    const args = argparse.parse_args(argv2a);

    if (args.subcommandName==='exec') // !!! HACK !!!
        args.prevalence_directory = path.join(require('temp').mkdirSync(),'.prevalence');

    args.long = args.long || !process.stdout.isTTY;

    const prevalenceDir = path.resolve(args.prevalence_directory);
    const hashAlgorithm = opts.hashAlgorithm || util.hashAlgorithm;

    exports.verbosity = args.verbose-args.quiet;
    exports.args      = args;

    if (args.plugin && args.plugin.length>0)
        throw new util.Fail("plugins must be specified as the first arguments");

    if (args.override.length>0) {
        const overrides = {parameters:[],plugins:[]};
        args.override.forEach(o=>{
            overrides[o[0]].push(o.slice(1));
        });
        require('./plugin.js').setOverrides(overrides);
    }

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
        if (!fs.existsSync(path.join(prevalenceDir,'hashes')))
            throw new VError("can't find hashes directory");
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
        args.pipeline = args.pipeline || [];
        args.format = args.format!==null ?
            args.format :
            !process.stdout.isTTY ? 'full' :
            args.reduce || args.pipeline.filter(j=>j[0]==='map').length>0 ? 'json5' :
            'pretty';
        if (args.end)
            throw new Error(`NYI: end arg`);
        const   engine = require('./engine.js');
        const  history = require('./history.js');
        const  whiskey = require('./whiskey.js');
        const   stream = require('stream');
        const   evalFn = (code,args)=>{
            if (code.indexOf('=>')===-1 && !code.startsWith('function'))
                code = `(${args})=>${code}`;
            return util.eval(code);
        }
        let      accum = args.accum;
        const   reduce = args.reduce ? evalFn(args.reduce,'a,j') : (a,j)=>out1.write(j);
        const pipeline = (stages=>{
            stages = stages.map(([t,c])=>[t,evalFn(c,'j')]);
            return j=>{
                for (let i=0;i<stages.length;i++) {
                    const st = stages[i];
                    switch (st[0]) {
                    case 'map':    j = st[1](j);          break;
                    case 'filter': if (!st[1](j)) return; break;
                    default: throw new Error(`SNO`);
                    }
                }
                accum = reduce(accum,j);
            }
        })(args.pipeline);
        const      run = args.run && history.findHash(prevalenceDir,args.run);
        const    JSON5 = require('json5');
        const   getFmt = (s,what)=>{
            switch (s) {
            case 'full':
                return new whiskey.StringifyObjectStream(util.serialise);
            case 'json':
                return new whiskey.StringifyJSONStream();
            case 'json5':
                return new whiskey.StringifyObjectStream(JSON5.stringify);
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
                case 'history-files':
                    return new whiskey.StringifyObjectStream(x=>x);
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
        const      out = new whiskey.LineStream(util.deserialise);
        let       out1 = stream.PassThrough({objectMode:true});
        const      dst = getFmt(args.format,args.what);
        dst.pipe(process.stdout);
        checkDirectoriesExist();
        out.on('data',js=>{
            pipeline(js);
        });
        out.on('end',()=>{
            if (args.reduce)
                out1.write(accum);
            out1.end();
        });
        out1.pipe(dst);
        switch (args.what) {
        case 'journal':
        case 'world':
            if (run)
                throw new Error(`NYI`);
            fs.createReadStream(path.join(prevalenceDir,'state',args.what)).pipe(out);
            break;
        case 'facts': {
            const ws = mkClientStream('admin');
            if (ws) {
                const jsps = new whiskey.JSONParseStream();
                let      n = 0;
                ws.pipe(jsps);
                jsps.on('readable',()=>{
                    let js;
                    while ((js=jsps.read())!=null) {
                        switch (++n) {
                        case 1:
                            if (js[0]!=='engine')
                                throw new Error("bad first packet: %j",js);
                            break;
                        case 2: {
                            if (js[0]!=='connection')
                                throw new Error("bad second packet: %j",js);
                            ws.write(JSON.stringify(['facts',{accum:    args.accum,
                                                              reduce:   args.reduce,
                                                              pipeline: args.pipeline}])+'\n');
                            break;
                        }
                        case 3:
                            if (args.reduce)
                                dst.write(js);
                            else if (js!==null)
                                js.forEach(j=>dst.write(j));
                            ws.end();
                            break;
                        }
                    }
                });
            }
            break;
        }
        case 'history': {
            history.getIndex(prevalenceDir,{fix:true}); // +++ don't need whole history, just current
            history.buildHistoryStream(
                prevalenceDir,
                run,
                (err,history)=>{
                    if (err) throw err;
                    history.pipe(out);
                });
            break;
        }
        case 'history-files': {
            history.getIndex(prevalenceDir,{fix:true}); // +++ don't need whole history, just current
            history.journalChain(
                prevalenceDir,
                run,
                function(err,hs) {
                    if (err)
                        throw err;
                    if (args.format==='pretty')
                        hs.forEach(h=>dst.write(h));
                    else
                        dst.write(hs);
                });
            break;
        }
        default: {
            const hstore = engine.makeHashes(prevalenceDir);
            fs.createReadStream(hstore.makeFilename(args.what)).pipe(out);
            break;
        }
        }
    };

    subcommands.compile.exec = function() {
        args.source = args.source || findSource();
        fs.writeFileSync(args.source+'.js',compile(args.source));
    };

    subcommands.exec.exec = function() {
        args.source = args.source || findSource();
        const eng = createEngine({
            debug:         args.debug,
            businessLogic: path.resolve(args.source) });
        eng.init();
        subcommands.run.exec();
    };

    subcommands.fsck.exec = function() {
        const    hash = require('./hash.js');
        const whiskey = require('./whiskey.js');
        const history = require('./history.js');
        const  hashes = hash(util.hashAlgorithm).makeStore(path.join(prevalenceDir,'hashes'));
        let        ok = true;
        checkDirectoriesExist();
        history.getIndex(prevalenceDir,{fix:true});
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
        history.buildHistoryStream(prevalenceDir,null,(err,rf)=>{    // this is sync really
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
        const crypto = require('crypto');
        const   seed = args.rngSeed===null ? crypto.randomInt(256*256*256*256) : args.rngSeed;
        args.source = args.source || findSource();
        if ((args.git || args.clone) && args.overwrite)
            throw new VError("git/clone and overwrite don't mix");
        const eng = createEngine({
            businessLogic:path.resolve(args.source),
            git:          args.git,
            rngSeed:      seed,
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
                            else {
                                eng.chrjs.checkAllInvariants();
                                eng.stopPrevalence(false,function(err3) {
                                    cb(err3);
                                });
                            }
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

    subcommands.list.exec = function() {
        const history = require('./history.js');
        switch (args.what) {
        case 'history-files':
            throw new Error(`NYI`);
        case 'runs': {
            const index = history.getIndex(prevalenceDir,{fix:true});
            Object.keys(index.contents).forEach(h=>{
                //console.log(`${h} ${JSON.stringify(index.contents[h])}`);
            });
            index.runs.sort((p,q)=>index.contents[p[0]].when[0]-index.contents[q[0]].when[0]);
            index.runs.forEach(r=>{
                const start = new Date(index.contents[r.slice(-1)[0]].when[0])
                const  stop = new Date(index.contents[r.slice( 0)[0]].when[1])
                const stFmt = start.toLocaleString('en-GB').replace(', ',' ');
                const drFmt = ('    '+((stop-start)/3600000).toFixed(1)).slice(-5)
                console.log(`${stFmt} ${drFmt}  ${r.length.toString().padStart(2)} ${r[0]}`);
            });
            break;
        }
        default:
            throw new Error(`unknown thing to list: ${args.what}`);
        }
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

    subcommands.replay.exec = function() {
        const   engine = require('./engine.js');
        const  history = require('./history.js');
        const  whiskey = require('./whiskey.js');
        const readline = require('readline');
        const    JSON5 = require('json5');
        const histfile = path.join(prevalenceDir,'replay.history');
        const     cmds = Array.from(args.commands);
        const      run = args.run && history.findHash(prevalenceDir,args.run);
        let        eng = null;
        checkDirectoriesExist();
        history.getIndex(prevalenceDir,{fix:true});
        history.buildHistoryStream(
            prevalenceDir,
            run,
            (err,history)=>{
                if (err) throw err;

                const     rj = new whiskey.LineStream(util.deserialise);
                const     rl = readline.createInterface({
                    input:   process.stdin,
                    output:  process.stdout,
                    history: (()=>{ // doesn't work till node v15.8
                        try {
                            return JSON.parse(fs.readFileSync(histfile,'utf8'));
                        } catch (e) {
                            return [];
                        }
                    })()
                });
                let     skip = ()=>false;
                let       pc = 0;     // "program counter"
                const myEval = x=>util.eval(x,{
                    sandbox: {
                        facts: eng.chrjs.orderedFacts,
                        Date:  MalayaDate,
                        Math:  MalayaMath,
                        pc,
                        t:     eng._nextTimestamp
                    },
                    timeout: 100000});
                const   repl = (js)=>{
                    let loop = true;
                    if (js && js[1]!=='update')
                        rj.resume();
                    else {
                        const exec = cmd=>{
                            cmd = cmd.trim();
                            if (cmd.length>0) {
                                const m = /^([a-zA-Z=]) *(.*)$/.exec(cmd);
                                if (!m)
                                    console.log(`??: ${cmd}`);
                                else try {
                                    switch (m[1]) {
                                    case 'D':   // toggle debug
                                        throw new Error(`NYI`);
                                    case 'i':   // Inject <fact>
                                        throw new Error(`NYI`);
                                    case 'l':   // Long form
                                        args.long = !args.long;
                                        break;
                                    case 'n':   // Next <n>?
                                        if (js) {
                                            let n = m[2].length>0 ? parseInt(m[2]) : 1;
                                            if (n>0) {
                                                skip = ()=>--n>0;
                                                loop = false;
                                            }
                                        } else
                                            console.log(`log replayed`);
                                        break;
                                    case 'q':   // Quit
                                        process.exit(0);
                                        break;
                                    case 'r':   // Run to completion
                                        if (js) {
                                            skip = ()=>true;
                                            loop = false;
                                        } else
                                            console.log(`log replayed`);
                                        break;
                                    case 'u':   // Until <condition>
                                        if (js) {
                                            const test = m[2];
                                            skip = ()=>!myEval(test);
                                            loop = false;
                                        } else
                                            console.log(`log replayed`);
                                        break;
                                    case '=': { // examine and pretty print facts
                                        const res = myEval(m[2]);
                                        if (Array.isArray(res) &&
                                            res.every(x=>Array.isArray(x)      &&
                                                      [2,3].includes(x.length) &&
                                                      typeof x[0]==='string'   &&
                                                      typeof x[1]==='object'   &&
                                                      (x[2]===undefined || typeof x[2]==='object') ))
                                            res.forEach(f=>console.log(`= ${fmtFact(f)}`));
                                        else
                                            console.log(JSON5.stringify(myEval(m[2])));
                                        break;
                                    }
                                    default:
                                        console.log(`??: ${cmd}`);
                                    }
                                } catch (e) {
                                    console.log(`user code failed: ${e}`);
                                }
                            } else
                                loop = false;
                            if (loop)
                                setImmediate(()=>repl(js));
                            else
                                rj.resume();
                        };
                        if (cmds.length>0)
                            exec(cmds.shift());
                        else
                            rl.question(`? `,exec);
                    }
                };
                rl.on('history',h=>{fs.writeFileSync(histfile,JSON.stringify(h))});
                history.pipe(rj);
                rj.on('data',js=>{
                    pc++;
                    switch (js[1]) {
                    case 'init': {
                        const businessLogic = args.source || js[2].businessLogic;
                        if (eng)
                            throw new Error(`multiple inits in this history [${pc}]`);
                        require('./plugin.js').setOverrides({
                            plugins:    [[null,'dummy']],
                            parameters: [] });
                        eng = new engine.Engine({
                            businessLogic,
                            debug:         true
                        });
                        eng._rng.seed = js[2].rngSeed || 0;
                        eng._rng.engine.seed(eng._rng.seed);
                        eng._bindGlobals();
                        traceChrjs(eng.chrjs,businessLogic);
                        break;
                    }
                    case 'code': {
                        //const   bl = js[2][1];
                        //const srcs = js[2][2];
                        // +++ filename and SHA1 of code +++
                        // +++ change init to save code at start if data +++
                        break;
                    }
                    case 'update':
                        eng._nextTimestamp = js[0];
                        eng.chrjs.update(js[2]);
                        console.log(chalk.yellow(`# ${new Date(js[0]).toISOString()} ${pc.toString().padStart(6,' ')}`));
                        break;
                    }
                    rj.pause();
                    if (skip())
                        rj.resume();
                    else
                        repl(js);
                });
                rj.on('end',()=>{
                    console.log(`history fully replayed`);
                    repl(null);
                });
            });
    };

    subcommands.revisit.exec = function() {
        const  byline = require('byline');
        const    temp = require('temp');
        const prevDir = path.join(temp.mkdirSync(),'prevalence'); // !!! CBB !!!
        const     eng = _createEngine({
            businessLogic: args.source,
            prevalenceDir: prevDir,
            ports:         {},
            debug:         args.debug
        });
        if (args.run)
            throw new Error(`NYI: --run`);
        eng.init();
        eng.start();
        eng.on('mode',m=>{
            if (m==='master') {
                byline(process.stdin)
                    .on('data',l=>{
                        const js = util.deserialise(l);
                        eng.update([js[1],{time:js[0],body:js[2]}]);
                    })
                    .on('end',()=>{
                        eng.update(['end',{}]);
                        eng.on('mode',m=>{
                            if (m==='idle')
                                eng.stop(true);
                        });
                        eng.become('idle');
                    });
            }
        });
        eng.become('master');
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
            //N.B. set up out tracking here if desired.  Currently we
            // do this by pairing adds and dels in tracing.js.  This
            // is quite a robust heuristic, but maybe Do It Properly?
        }
        installSignalHandlers(eng);
        eng.become(args.mode);
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

    subcommands.term.exec = function() {
        checkDirectoriesExist();
        const  lock = require("./lock.js");
        if (lock.lockSync(path.join(prevalenceDir,'lock'))) {
            // +++ engine should handle prevDir existing but not stateDir +++
            // +++ sanity check, don't do anything if no state dir +++
            throw new Error(`NYI`);
            //const  hashes = hash(util.hashAlgorithm).makeStore(path.join(prevalenceDir,'hashes'));
            //fs.appendFileSync(jrnlFile,util.serialise([eng.timestamp(),'term',{}])+'\n');
            //hashes.putFileSync(jrnlFile);
            // try {
            //     rmRF.sync(path.join(eng.prevalenceDir,'state'));
            // } catch (e) {/* eslint no-empty:0 */}
            //lock.unlockSync(path.join(prevalenceDir,'lock'));
        }
    };

    subcommands.transform.exec = function() {
        /* eslint-disable security/detect-non-literal-require */
        checkDirectoriesExist();
        require('./compiler.js'); // for .chrjs extension
        const     cb = findCallback();
        const engine = require('./engine.js');
        const    eng = createEngine({debug:args.debug});
        const source = path.resolve(process.cwd(),args.transform);
        const  chrjs = require(source);
        const  print = args.stdout;
        if (args.run)
            throw new Error(`NYI: --run`);
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

    subcommands.wait.exec = function() {
        checkDirectoriesExist();
        switch (args.state) {
        case 'stop': {
            const t0 = Date.now();
            const interval = setInterval(()=>{
                const lock = require("./lock.js");
                const data = lock.lockDataSync(path.join(prevalenceDir,'lock'));
                if (data===null || data.pid===null) {
                    clearInterval(interval);
                } else if (args.timeout!==null && Date.now()-t0>args.timeout) {
                    console.log(`wait stop: timeout`);
                    clearInterval(interval);
                }
            },1000);
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
    exports._private = {};
}
