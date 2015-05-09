"use strict";

// all-in-one command to administer malaya

var     fs = require('fs');
var   path = require('path');
var VError = require('verror');
var assert = require('assert');
var   util = require('./util.js');

// configure main arg parser

var argparse = new (require('argparse').ArgumentParser)({
    addHelp:     true,
    description: "tiny vegetarian mosquito"
});
argparse.addArgument(['-p','--prevalence-directory'],
                     {
                         action:       'store',
                         defaultValue: '.prevalence',
                         help:         "prevalence directory"
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
var subcommands = {};

var addSubcommand = exports.addSubcommand = function(name,opts) {
    subcommands[name] = subparsers.addParser(name,opts);
    assert.strictEqual(subcommands[name].exec,undefined); // we'll be using this later
    return subcommands[name];
};

addSubcommand('cat',{addHelp:true});
subcommands.cat.addArgument(
    ['what'],
    {
        action:       'store',
        help:         "'journal', 'world', 'history' or <hash>"
    }
);
subcommands.cat.exec = function(args) {
};

addSubcommand('compile',{addHelp:true});
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
    ['--data'],
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
        action:       'store',
        help:         "don't special-case _tick,_output,_restart"
    }
);
subcommands.run.addArgument(
    ['--no-tag-check'],
    {
        action:       'store',
        help:         "don't check tag"
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

addSubcommand('slave',{addHelp:true});

addSubcommand('transform',{addHelp:true});
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
        help:         "chrjs source file for new business logic"
    }
);

addSubcommand('status',{addHelp:true});

addSubcommand('dump',{addHelp:true});

addSubcommand('client',{addHelp:true});
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
        console.log(err.message);
        process.exit(100);
    } else {
        console.log(err.message);
        console.error(err.stack);
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
                eng.stop();
            process.exit(1);
        });
        process.on('SIGQUIT',function() {
            process.stderr.write(' quit\n');
            process.exit(1);
        });
        process.on('SIGHUP',function() {
            if (eng && eng.mode!==null) {
                eng.stop(false,false);
                eng.start();
            }
        });
        process.on('exit',function(code) {
        });
    };

    var compile = function(source,options) {
        var    parse = require('./parser.js').parse;
        var compiler = require('./compiler.js');
        var   recast = require('recast');
        options        = options || {attrs:true};
        compiler.debug = options.debug || true;
        return recast.print(compiler.compile(parse(fs.readFileSync(source),options))).code;
    };

    var createEngine = opts.createEngine || function(options) {
        var Engine = require('./engine.js').Engine;
        return new Engine(options);
    };

    subcommands.cat.exec = function() {
        checkDirectoriesExist();
        switch (args.what) {
        case 'journal':
        case 'world':
            fs.createReadStream(path.join(args.prevalence_directory,'state',args.what)).pipe(process.stdout);
            break;
        case 'history': 
            createEngine({}).createFullJournalReadStream().pipe(process.stdout);
            break;
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
        require('./compiler.js'); // add `chrjs` extension to `require`
        var source = path.resolve(args.source);
        createEngine({chrjs:require(source)}).init(args.data);
    };
    
    subcommands.run.exec = function() {
        checkDirectoriesExist();
        require('./compiler.js'); // add `chrjs` extension to `require`
        var    auto = true;       // +++ from arg --no-auto
        var  source = path.resolve(args.source);
        var options = {chrjs:require(source),ports:{http:3000}};
        var     eng = createEngine(options);
        eng.on('loaded',function(syshash) {
            util.debug("loaded world: %s",syshash);
        });
        eng.start();
        eng.on('mode',function(mode) {
            if (mode==='master')
                installSignalHandlers(eng);
            // +++
        });
        eng.on('listen',function(protocol,port) {
            util.debug("%s listening on *:%s",protocol,port);
        });
        eng.on('saved',function(syshash) {
            util.debug("saved world:  %s",syshash);
        });
        if (auto) {
            eng.update(['restart',{},{port:'system://'}]); // +++ s/restart/_restart/ +++
            setInterval(function() {
                eng.update(['tick',{date:new Date()},{port:'server:'}]); // +++ s/tick/_tick/ +++
                eng.update(['_take-outputs',{},{port:'server:'}]);
            },1000);
        }
        eng.become('master');
    };
    
    subcommands.slave.exec = function() {
        checkDirectoriesExist();
        var eng = createEngine({});
        eng.start();
        eng.become('slave');
    };
    
    subcommands.transform.exec = function() {
        checkDirectoriesExist();
        require('./compiler.js'); // add `chrjs` extension to `require`
        var engine = require('./engine');
        var    eng = createEngine({});
        var  chrjs = require(path.resolve(args.transform));
        var   fact;
        var      t;
        eng.chrjs = engine.makeInertChrjs();
        eng.start();
        for (t=0;t<eng.chrjs.t;t++) {
            fact = eng.chrjs.get(t+'');
            if (!(fact instanceof Array && fact.length===2))
                throw new VError("bad fact in store to be transformed");
            chrjs.add([fact[0],fact[1],{keep:false}]);
        }
        eng.chrjs = args.source ? require(path.resolve(args.source)) : eng.makeInertChrjs();
        for (t=0;t<chrjs.t;t++) {
            fact = chrjs.get(t+'');
            if (fact[2].keep)
                eng.chrjs.add([fact[0],fact[1]]);
        }
        eng.journalise('transform',[args.transform,args.source]);
        eng.stop();
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
        var engine = require('./engine.js');
        var    eng = createEngine({});
        var   fact;
        var      t;
        eng.chrjs = engine.makeInertChrjs();
        eng.start();
        for (t=1;t<eng.chrjs.t;t++) {
            fact = eng.chrjs.get(t+'');
            if (fact) {
                process.stdout.write(util.serialise(fact));
                process.stdout.write('\n');
            }
        }
        eng.stop();
    };

    subcommands.client.exec = function() {
        //var client = require('./client.js');
        throw new Error("NYI: subcommand `client`");
    };
    
    subcommands.logs.exec = function() {
        checkDirectoriesExist();
        var eng = createEngine({});
        eng._makeHashes();
        process.stdout.write('journal\n');
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
};
