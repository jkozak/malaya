"use strict";

// execution tracing

const        _ = require('underscore');
const     path = require('path');
const    chalk = require('chalk');
const    JSON5 = require('json5');
const   assert = require('assert');

const compiler = require('./compiler.js');

const summariseJSON = exports.summariseJSON = (js,opts={})=>{
    const    n = opts.n || 12;
    const long = opts.long===undefined ? false : opts.long;
    const isKI = opts.isKeyInteresting || (k=>true);
    if (long)
        return JSON.stringify(js);
    else {
        return JSON5.stringify(js,(k,v)=>{
            if (!isKI(k))
                return '...';
            else if (typeof v!=='string')
                return v;
            else if (['src','dst'].includes(k))
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

exports.trace = (chrjs,source_,opts={})=>{
    // rule invocations nest, but that's an implementation detail;
    // so we use `stack` and `outQ` to flatten out the display
    const              stack = [];
    const               outQ = [];
    const             source = chrjs.__file__;
    const            ruleMap = compiler.getRuleMap(path.resolve(source));
    const           mySource = path.relative(process.cwd(),source);
    const              print = opts.print || console.log;
    const  isFactInteresting = opts.isFactInteresting || (f=>{ // what's worth tracing?
        return !(f[0]==='tick' && f[2] && f[2].src==='timer');
    });
    const   isAddInteresting = opts.isAddInteresting || (add=>{
        return isFactInteresting(add);
    });
    const isTraceInteresting = opts.isTraceInteresting || (firing=>{
        if (firing.adds.length!==0)
            return true;
        if (firing.dels.filter(d=>isFactInteresting(d)).length===0)
            return false;
        return true;
    });
    let             provoker = null;
    let              borings = 0; // count of `add`s deemed not interesting
    const             events = {};
    const                 on = (name,fn)=>{
        events[name] = fn;
        chrjs.on(name,fn);
    };
    opts.isKeyInteresting = opts.isKeyInteresting || (js=>true);
    on('queue-rule',(id,bindings)=>{
        const firing = {id:id,done:false,dels:[],adds:[],outs:[],t:Date.now()};
        stack.push(firing);
        outQ.push(firing);
    });
    on('add',(t,f)=>{
        if (stack.length>0)
            stack[stack.length-1].adds.push(f);
        else if (isAddInteresting(f)) {
            if (borings) {
                print(chalk.yellow(`\n~~~ ${borings} boring adds ignored ~~~`));
                borings = 0;
            }
            print(`\n${chalk.yellow('>')} ${fmtFact(f,opts)}`);
            provoker = null;
        } else {
            borings++;
            provoker = f;
        }
    });
    on('del',(t,f)=>{
        if (stack.length>0) {
            const adds = stack[stack.length-1].adds;
            for (let i=0;i<adds.length;i++)
                if (_.isEqual(adds[i],f)) { // here today, gone today
                    delete adds[i];
                    if (f[2] && f[2].dst)   // output determination heuristic
                        stack[stack.length-1].outs.push(f);
                    return;
                }
            stack[stack.length-1].dels.push(f);
        }
    });
    on('finish-rule',(id)=>{
        const firing = stack.pop();
        assert.strictEqual(firing.id,id);
        firing.done = true;
        while (outQ.length>0 && outQ[0].done) { /* eslint no-loop-func:0 */
            const firing1 = outQ.shift();
            if (isTraceInteresting(firing1)) {
                if (borings) {
                    print(chalk.yellow(`\n~~~ ${borings} boring adds ignored ~~~`));
                    borings = 0;
                }
                if (provoker) {
                    print(`\n${chalk.yellow('>')} ${fmtFact(provoker,opts)}`);
                    provoker = null;
                }
                print(chalk.yellow(` rule ${mySource}:${ruleMap[firing1.id].start.line} took ${Date.now()-firing1.t}ms`));
                firing1.dels.forEach(d=>{
                    print(`  ${chalk.yellow('-')} ${fmtFact(d,opts)}`);
                });
                firing1.adds.forEach(a=>{
                    print(`  ${chalk.yellow('+')} ${fmtFact(a,opts)}`);
                });
                firing1.outs.forEach(a=>{
                    print(`  ${chalk.yellow('<')} ${fmtFact(a,opts)}`);
                });
            } else
                borings++;
        }
    });
    return ()=>{
        Object.keys(events).forEach(k=>{
            chrjs.off(k,events[k]);
            delete events[k];
        });
    };
};
