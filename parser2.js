"use strict";

// Stub to compile and load parser.pegjs
// will be pre-done by a build procedure eventually

const    fs = require('fs');
const   peg = require('pegjs');
const  path = require('path');
const  util = require('./util.js');

let  parser;

try {
    parser = peg.generate(fs.readFileSync(path.join(__dirname,'parser2.pegjs'),'utf8'),
                          util.env==='test' ?
                          {
                              trace: false,
                              allowedStartRules: [
                                  'Start',
                                  'JsonMatch','RuleItem','FunctionExpression'
                              ]
                          } : {} );
} catch (e) {
    console.log("parser compile failed");
    console.log(e);
    throw e;
}

module.exports = Object.assign({},
                               parser,
                               {
                                   parse:(src,opts)=>{
                                       const ans = parser.parse(src,opts);
                                       // parser2 can build a DAG which will confuse the
                                       // compiler, so canonicalise this.
                                       return util.deepClone(ans);
                                   }
                               } );
