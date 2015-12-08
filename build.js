"use strict";

const child = require('child_process');
const  path = require('path');
const  util = require('util');
const    fs = require('fs');

function run(cmd,cwd,env) {
    const opts = {stdio:[0,1,2],cwd:cwd};
    if (env) {
        opts.env = JSON.parse(JSON.stringify(process.env)); // yuk
        for (var k in env)
            opts.env[k] = env[k];
    }
    child.execSync(cmd,opts);
}

function cmd(args) {
    try {
        switch (args[0]) {
        case 'init':
            run("npm install",args[1]);
            run("npm link",   args[1]);
            args.slice(2).forEach(d => {
                run('npm link '+args[1],d);
                run('npm install',      d);
            });
            break;
        case 'test':
            args.slice(1).forEach(d => {
                run("npm test",d,{NODE_ENV:args[0]});
            });
            break;
        case 'benchmark': {
            args.slice(1).forEach(d => {
                const db = path.join(d,'benchmark');
                if (fs.existsSync(db)) {
                    var chrjsjss = [];
                    fs.readdirSync(db).forEach(f => {
                        if (/\.chrjs$/.exec(f)) {
                            run("node malaya/malaya compile "+path.join(db,f),'.',{NODE_ENV:args[0]});
                            chrjsjss.push(path.join(db,f+'.js'));
                        }
                    });
                    run("npm run benchmark",d,{NODE_ENV:args[0]});
                    chrjsjss.forEach(f => fs.unlinkSync(f));
                }
            });
            break;
        }
        default:
            throw new Error(util.format("no such op: %j",args[0]));
        }
        return 0;
    } catch (e) {
        console.log("failed: %s",e.message);
        return 1;
    }
}

process.exit(cmd(process.argv.slice(2)));    /* eslint no-process-exit:0 */


