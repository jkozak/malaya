"use strict";

const  util = require('./util.js');
const chalk = require('chalk');

exports.expect = (chrjs,script,options)=>{
    const fmtPort = (p)=>p+"        ".slice(p.length);
    const  colMap = {
        "server:":  chalk.bold
    };
    const colours = ['red','green','blue'];
    const    outs = [];
    options = options || {quiet:false};
    chrjs.reset();
    script.forEach((js)=>{
        if (Array.isArray(js))
            if (!colMap[js[2].port]) {
                if (colours.length>0)
                    colMap[js[2].port] = chalk[colours.shift()];
                else
                    throw new Error(`no colours left for ${js[2].port}`);
            }
    });
    chrjs.out = (d,j)=>{
        if (!options.quiet)
            console.log(colMap[d]("%s -> %j"),fmtPort(d),j);
        outs.push([d,j]);
    };
    script.forEach((js)=>{
        if (typeof js==='string')
            console.log(chalk.bgBlack("\n\t%s\n"),js);
        else if (typeof js==='function') {
            if (util.env==='test')
                js(outs,chrjs._private.orderedFacts);
            else
                js(outs);
            outs.length = 0;
        }
        else {
            if (!options.quiet)
                console.log(colMap[js[2].port]("%s <- %j"),fmtPort(js[2].port),[js[0],js[1]]);
            chrjs.update(js);
        }
    });
};
