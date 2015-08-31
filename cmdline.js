"use strict";

// all-in-one command to administer malaya

var     fs = require('fs');
var   path = require('path');
var VError = require('verror');
var assert = require('assert');
var   util = require('./util.js');
var execCP = require('child_process').exec;

// configure main arg parser

var argparse = new (require('argparse').ArgumentParser)({
    addHelp:     true,
    description: "tiny vegetarian mosquito"
});
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
                         help: "       be more verbose"
                     });
exports.argparse = argparse;

// configure subcommand parsers

var subparsers = argparse.addSubparsers({
    title: 'subcommands',
    dest:  'subcommandName'
});
var subcommands = exports.subcommands = {};

var addSubcommand = exports.addSubcommand = function(name,opts) {
    subcommands[name] = subparsers.addParser(name,opts);
    assert.strictEqual(subcommands[name].exec,undefined); // we'll be using this later
    return subcommands[name];
};

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
        help:         "chrjs source file to compile",
        defaultValue: 'bl.chrjs'
    }
);

addSubcommand('init',{addHelp:true});
subcommands.init.addArgument(
    ['-d','--data'],
    {
        action:       'store',
        help:         "database to pilfer"
    }
);
subcommands.init.addArgument(
    ['source'],
    {
        action:       'store',
        nargs:        '?',
        help:         "business logic source file",
        defaultValue: 'bl.chrjs'
    }
);

addSubcommand('run',{addHelp:true});
subcommands.run.addArgument(
    ['--no-auto'],
    {
        action:       'storeFalse',
        defaultValue: true,
        help:         "no _tick &c magic",
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
    ['-A','--admin-ui'],
    {
        action:       'storeTrue',
        defaultValue: false,
        help:         "start an admin UI browser session",
        dest:         'adminUI'
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
subcommands.run.addArgument(
    ['source'],
    {
        action:       'store',
        nargs:        '?',
        help:         "business logic source file",
        defaultValue: 'bl.chrjs'
    }
);

addSubcommand('save',{addHelp:true});

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

addSubcommand('status',{addHelp:true});

addSubcommand('dump',{addHelp:true});
subcommands.dump.addArgument(
    ['-s','--serialise'],
    {
        action:       'storeTrue',
        help:         "use malaya extended JSON serialisation format"
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


addSubcommand('logs',{addHelp:true});


// now dispatch the subcommand

process.on('uncaughtException',function(err) {
    /*eslint-disable no-process-exit*/
    if (err instanceof exports.Fail) {
        util.error(err.message);
        process.exit(100);
    } else {
        util.error(err.message);
        util.error(err.stack);
        process.exit(101);
    }
    /*eslint-enable no-process-exit*/
});

exports.run = function(opts0) {
    var          opts = opts0 || {};
    var          args = argparse.parseArgs();
    var prevalenceDir = path.resolve(args.prevalence_directory);
    var hashAlgorithm = opts.hashAlgorithm || util.hashAlgorithm;

    exports.verbosity = args.verbose-args.quiet;
    exports.args      = args;

    var findCallback = function() { // extract the callback for single-shot use.
        var cb;
        if (opts.callback) {
            cb = opts.callback;
            delete opts.callback;
        } else
            cb = function(){};
        return cb;
    };

    var checkDirectoriesExist = function() {
        if (!fs.existsSync(prevalenceDir))
            throw new VError("can't find prevalence directory");
        if (!fs.existsSync(path.join(prevalenceDir,'state')))
            throw new VError("can't find state directory");
    };

    var installSignalHandlers = function(eng) {
        /* eslint no-process-exit:0 */
        process.on('SIGINT',function() {
            process.stderr.write(' interrupt\n');
            if (eng)
                eng.stopPrevalence(false,function(){eng.stop();});
            process.exit(1);
        });
        process.on('SIGQUIT',function() {
            process.stderr.write(' quit\n');
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

    var compile = function(source,options) {
        var    parse = require('./parser.js').parse;
        var compiler = require('./compiler.js');
        var   recast = require('recast');
        options        = options || {attrs:true};
        compiler.debug = args.debug;
        return recast.print(compiler.compile(parse(fs.readFileSync(source),options))).code;
    };

    // basic tracing facility
    // +++ move to `Engine`, make an `emit` stream +++
    var isFactInteresting = function(f) {        // what's worth tracing?
        return ['_tick','_take-outputs','_output'].indexOf(f[0])===-1;
    };
    var isAddInteresting = function(add) {
        return isFactInteresting(add);
    };
    var isTraceInteresting = function(firing) {
        if (firing.adds.length!==0)
            return true;
        if (firing.dels.filter(function(d){return isFactInteresting(d);}).length===0)
            return false;
        return true;
    };
    var traceChrjs = function(chrjs,source) {
        // rule invocations nest, but that's an implementation detail;
        // so we use `stack` and `outQ` to flatten out the display
        var compiler = require('./compiler.js');
        var    stack = [];
        var     outQ = [];
        var  ruleMap = compiler.getRuleMap(source);
        var mySource = path.relative(process.cwd(),source);
        var provoker = null;
        var  borings = 0;       // count of `add`s deemed not interesting
        chrjs.on('queue-rule',function(id,bindings) {
            var firing = {id:id,done:false,dels:[],adds:[],t:Date.now()};
            stack.push(firing);
            outQ.push(firing);
        });
        chrjs.on('add',function(t,f) {
            if (stack.length>0)
                stack[stack.length-1].adds.push(f);
            else if (isAddInteresting(f)) {
                if (borings) {
                    console.log("~~~ %d boring adds ignored ~~~",borings);
                    borings = 0;
                }
                console.log("> %j",f);
                provoker = null;
            } else {
                borings++;
                provoker = f;
            }
        });
        chrjs.on('del',function(t,f) {
            if (stack.length>0)
                stack[stack.length-1].dels.push(f);
        });
        chrjs.on('finish-rule',function(id) {
            var firing = stack.pop();
            assert.strictEqual(firing.id,id);
            firing.done = true;
            while (outQ.length>0 && outQ[0].done) { /* eslint no-loop-func:0 */
                var firing1 = outQ.shift();
                if (isTraceInteresting(firing1)) {
                    if (provoker) {
                        console.log("> %j",provoker);
                        provoker = null;
                    }
                    console.log(" rule %s:%d took %dms",mySource,ruleMap[firing1.id].start.line,Date.now()-firing1.t);
                    firing1.dels.forEach(function(d){
                        console.log("  - %j",d);
                    });
                    firing1.adds.forEach(function(a){
                        console.log("  + %j",a);
                    });
                } else
                    borings++;
            }
        });
    };

    var _createEngine = opts.createEngine || function(options) {
        var engine = require('./engine.js');
        var    eng = new engine.Engine(options);
        return eng;
    };
    
    var createEngine = function(options) {
        options               = options || {};
        options.prevalenceDir = prevalenceDir;
        var eng = _createEngine(options);
        eng.on('mode',function(mode) {
            console.log("mode now: %s",mode);
        });
        eng.on('slave',function(where) {
            if (where)
                console.log("slave online at: %j",where);
            else
                console.log("slave offline");
            if (args.auto) {
                var sp = where===null ? {} : {port:where.ports.http,server:where.host};
                eng.broadcast({'_spare':sp});
            }
        });
        return eng;
    };

    subcommands.cat.exec = function() {
        checkDirectoriesExist();
        switch (args.what) {
        case 'journal':
        case 'world':
            fs.createReadStream(path.join(args.prevalence_directory,'state',args.what)).pipe(process.stdout);
            break;
        case 'history': {
            var eng = createEngine({});
            eng._makeHashes();
            eng.buildHistoryStream(function(err,history) {
                if (err) throw err;
                history.pipe(process.stdout);
            });
            break;
        }
        default: {
            var   hash = require('./hash.js')(hashAlgorithm);
            var hstore = hash.makeStore(path.join(prevalenceDir,'hashes'));
            fs.createReadStream(hstore.makeFilename(args.what)).pipe(process.stdout);
            break;
        }
        };
    };

    subcommands.compile.exec = function() {
        fs.writeFileSync(args.source+'.js',compile(args.source));
    };

    subcommands.init.exec = function() {
        var eng = createEngine({businessLogic:path.resolve(args.source)});
        var  cb = findCallback();
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
    };

    var tickInterval = null;
    subcommands.run.exec = function() {
        checkDirectoriesExist();
        var     auto = args.auto;
        var   source = path.resolve(args.source);
        var  options = {businessLogic: source,
                        debug:         args.debug,
                        ports:         {http:args.webPort},
                        masterUrl:     args.masterUrl};
        var      eng = createEngine(options);
        eng.on('listen',function(protocol,port) {
            util.debug("%s listening on *:%s",protocol,port);
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
                var http = require('http');
                for (var k in eng.options.bundles) {
                    http.request({
                        port:args.webPort,
                        path:k
                    }).end();
                }
            }
        });
        eng.on('saved',function(syshash) {
            util.debug("saved world:  %s",syshash);
        });
        eng.on('loaded',function(syshash) {
            util.debug("loaded: %s",syshash);
        });
        eng.start();
        eng.on('become',function(mode) {
            if (tickInterval) 
                clearInterval(tickInterval);
            if (auto && mode==='master') {
                tickInterval = setInterval(function() {
                    eng.update(['_tick',{date:new Date()},{port:'server:'}]);
                    eng.update(['_take-outputs',{},{port:'server:'}]);
                },1000);
            } else 
                tickInterval = null;
        });
        if (args.debug)
            traceChrjs(eng.chrjs,source);
        eng.on('mode',function(mode) {
            if (auto && mode==='master')
                eng.update(['_restart',{},{port:'system://'}]);
        });
        installSignalHandlers(eng);
        eng.become(args.mode);
    };

    subcommands.transform.exec = function() {
        checkDirectoriesExist();
        require('./compiler.js'); // for .chrjs extension
        var     cb = findCallback();
        var engine = require('./engine.js');
        var    eng = createEngine({debug:args.debug});
        var source = path.resolve(process.cwd(),args.transform);
        var  chrjs = require(source);
        var  print = args.stdout;
        var   fact;
        var      t;
        eng.chrjs = engine.makeInertChrjs();
        eng.start();
        if (args.debug)
            traceChrjs(chrjs,source);
        eng.startPrevalence(function(err) {
            for (t=1;t<eng.chrjs.t;t++) {
                fact = eng.chrjs.get(t+'');
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
                for (t=1;t<chrjs.t;t++) {
                    fact = chrjs.get(t+'');
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
                        for (t=1;t<chrjs.t;t++) {
                            fact = chrjs.get(t+'');
                            if (fact) {
                                if (!(fact instanceof Array && [2,3].indexOf(fact.length)!==-1))
                                    return cb(new VError("bad fact from transform: %j",fact));
                                if (fact.length===2 || fact[2].keep)
                                    eng.chrjs.add([fact[0],fact[1]]);
                            }
                        }
                    }
                });
            }
            eng.stopPrevalence(false,cb);
        });
    };

    subcommands.save.exec = function() {
        checkDirectoriesExist();
        var lock = require("./lock.js");
        var data = lock.lockDataSync(path.join(prevalenceDir,'lock'));
        if (data===null || data.pid===null)
            util.printf("not running\n");
        else 
            process.kill(data.pid,'SIGHUP');
    };

    subcommands.status.exec = function() {
        checkDirectoriesExist();
        var lock   = require("./lock.js");
        var moment = require('moment');
        var pLock  = path.join(prevalenceDir,'lock');
        var data   = lock.lockDataSync(pLock);
        var hash   = require('./hash.js')(hashAlgorithm);
        var hstore = hash.makeStore(path.join(prevalenceDir,'hashes'));
        var tfmt   = "YYYY-MM-DD HH:mm:ss";
        util.printf("stashed: %d hashes\n",hstore.getHashes().length);
        if (data===null || data.pid===null)
            util.printf("server:  not running\n");
        else {
            var    stLock = fs.statSync(pLock);
            var    pWorld = path.join(prevalenceDir,'state','world');
            var   stWorld = fs.statSync(pWorld);
            var stJournal = fs.statSync(path.join(prevalenceDir,'state','journal'));
            util.readFileLinesSync(pWorld,function(l) {
                util.printf("syshash: %s\n",util.deserialise(l));
                return false;
            });
            util.printf("server:\t running (pid %d) since %s\n",data.pid,moment(stLock.mtime).format(tfmt));
            util.printf("world:\t %d bytes, saved at %s\n",stWorld.size,  moment(stWorld.mtime).format(tfmt));
            util.printf("journal: %d bytes, updated %s\n",stJournal.size,moment(stJournal.mtime).format(tfmt));
            for (var k in data.ports) {
                util.printf("%s:\t listening on *:%d\n",k,data.ports[k]);
            }
        }
    };

    subcommands.dump.exec = function() {
        checkDirectoriesExist();
        var engine = require('./engine.js');
        var    eng = createEngine({});
        var   fact;
        var      t;
        eng.chrjs = engine.makeInertChrjs();
        eng.start();
        for (t=1;t<eng.chrjs.t;t++) {
            fact = eng.chrjs.get(t+'');
            if (fact) {
                var text = args.serialise ? util.serialise(fact) : JSON.stringify(fact);
                process.stdout.write(text);
                process.stdout.write('\n');
            }
        }
    };

    subcommands.client.exec = function() {
        var client = require('./client.js');
        var    url = args.url || client.findURL(args.urlPath);
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
    
    subcommands.logs.exec = function() {
        checkDirectoriesExist();
        var eng = createEngine({});
        eng._makeHashes();
        eng.journalChain(function(err,hs) {
            if (err)
                throw err;
            hs.forEach(function(h) {
                process.stdout.write(h+'\n');
            });
        });
    };
    
    if (subcommands[args.subcommandName]===undefined)
        throw new VError("unknown subcommand: %s",args.subcommandName);
    if (subcommands[args.subcommandName].exec===undefined)
        throw new VError("NYI: subcommand `%s`",args.subcommandName);
    
    subcommands[args.subcommandName].exec(args);
    
    findCallback()(null);
};
