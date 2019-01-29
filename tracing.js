"use strict";

// execution tracing

const     path = require('path');
const    chalk = require('chalk');
const    JSON5 = require('json5');
const   assert = require('assert');

const compiler = require('./compiler.js');

const summariseJSON = exports.summariseJSON = (js,{n=12,long=false}={})=>{
    if (long)
        return JSON.stringify(js);
    else {
        return JSON5.stringify(js,(k,v)=>{
            if (typeof v!=='string')
                return v;
            else if (k==='port')
                return v;
            else if (v.length>n)
                return v.slice(0,n)+'...';
            else
                return v;
        });
    }
};

const fmtJSON = exports.fmtJSON = (js,opts={})=>summariseJSON(js,opts);
const fmtFact = exports.fmtFact = (f,opts={})=>{
    if (Array.isArray(f) && [2,3].includes(f.length) && typeof f[0]==='string') {
        if (f.length===2)
            return `['${chalk.blue(f[0])}',${fmtJSON(f[1],opts)}]`;
        else
            return `['${chalk.blue(f[0])}',${fmtJSON(f[1],opts)},${chalk.green(fmtJSON(f[2],opts))}]`;
    } else
        return chalk.red(JSON5.stringify(f));
};

const isFactInteresting = f=>{              // what's worth tracing?
    return ['_tick','_take-outputs','_output'].indexOf(f[0])===-1;
};
const isAddInteresting = add=>{
    return isFactInteresting(add);
};
const isTraceInteresting = firing=>{
    if (firing.adds.length!==0)
        return true;
    if (firing.dels.filter(d=>isFactInteresting(d)).length===0)
        return false;
    return true;
};

exports.trace = (chrjs,source_,opts={})=>{
    // rule invocations nest, but that's an implementation detail;
    // so we use `stack` and `outQ` to flatten out the display
    const    stack = [];
    const     outQ = [];
    const   source = chrjs.__file__;
    const  ruleMap = compiler.getRuleMap(path.resolve(source));
    const mySource = path.relative(process.cwd(),source);
    const    print = opts.print || console.log;
    let   provoker = null;
    let    borings = 0;       // count of `add`s deemed not interesting
    chrjs.on('queue-rule',(id,bindings)=>{
        const firing = {id:id,done:false,dels:[],adds:[],t:Date.now()};
        stack.push(firing);
        outQ.push(firing);
    });
    chrjs.on('add',(t,f)=>{
        if (stack.length>0)
            stack[stack.length-1].adds.push(f);
        else if (isAddInteresting(f)) {
            if (borings) {
                print(chalk.yellow(`~~~ ${borings} boring adds ignored ~~~`));
                borings = 0;
            }
            print(`${chalk.yellow('>')} ${fmtFact(f,opts)}`);
            provoker = null;
        } else {
            borings++;
            provoker = f;
        }
    });
    chrjs.on('del',(t,f)=>{
        if (stack.length>0)
            stack[stack.length-1].dels.push(f);
    });
    chrjs.on('finish-rule',(id)=>{
        const firing = stack.pop();
        assert.strictEqual(firing.id,id);
        firing.done = true;
        while (outQ.length>0 && outQ[0].done) { /* eslint no-loop-func:0 */
            const firing1 = outQ.shift();
            if (isTraceInteresting(firing1)) {
                if (provoker) {
                    print(`${chalk.yellow('>')} ${fmtFact(provoker,opts)}`);
                    provoker = null;
                }
                print(chalk.yellow(` rule ${mySource}:${ruleMap[firing1.id].start.line} took ${Date.now()-firing1.t}ms`));
                firing1.dels.forEach(d=>{
                    print(`  ${chalk.yellow('-')} ${fmtFact(d,opts)}`);
                });
                firing1.adds.forEach(a=>{
                    print(`  ${chalk.yellow('+')} ${fmtFact(a,opts)}`);
                });
            } else
                borings++;
        }
    });
    chrjs.on('out',(dest,data)=>{
        print("%s %j %s",chalk.yellow('<'),dest,summariseJSON(data));
    });
};
