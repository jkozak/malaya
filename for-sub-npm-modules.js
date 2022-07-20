"use strict";

// recursively run a command in subdirs of arg[1]

const   cp = require('child_process'); // eslint-disable-line security/detect-child-process
const   fs = require('fs');
const path = require('path');

process.argv.slice(3).forEach(d=>{
    console.log(`*** start: ${d}`);
    fs.readdirSync(d)
        .map(f=>path.join(d,f))
        .filter(f=>fs.statSync(f).isDirectory())
        .filter(f=>fs.existsSync(path.join(f,'package.json')))
        .map(f=>(console.log(`*** path: ${f}`),f))
        .forEach(f=>cp.execSync(process.argv[2],{cwd:f,stdio:'inherit'}));
});
