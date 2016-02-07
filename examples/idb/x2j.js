// xml2js has proved a bit of a disappointment
// Here's a parser/builder for a minimal subset of XML sufficient unto this project.

// format:
//  <a p='1'>text<node/></a>   <=>  {a:{p:'1',_children:['text',{node:{}}]}}

"use strict";
/*eslint-disable curly*/

const assert = require('assert');
const    sax = require('sax');
const parser = sax.parser(true);


exports.parse = function(xml) {
    let         ans;
    const     stack = [];
    const pushChild = function(ch) {
        const keys = Object.keys(stack[0]);
        assert.equal(keys.length,1);
        const insertHere = stack[0][keys[0]];
        if (insertHere._children===undefined)
            insertHere._children = [];
        insertHere._children.push(ch);
    };
    parser.onerror = function(e) {
        console.log("!!! offending XML: %j",xml);
        throw new Error(e);
    };
    parser.ontext = function (t) {
        assert(stack.length>0);
        pushChild(t);
    };
    parser.onopentag = function (node) {
        const newnode = {};
        newnode[node.name] = node.attributes;
        if (stack.length>0)
            pushChild(newnode);
        stack.unshift(newnode);
    };
    parser.onclosetag = function (node) {
        ans = stack.shift();
    };
    parser.write(xml).close();
    assert.equal(stack.length,0); // check we have run synchronously
    assert(ans);
    return ans;
};

exports.build = function(obj,cb) {
    let ans = '';
    if (cb===undefined)
        cb = function(s) {ans += s;};
    if ((typeof obj)==='string')
        cb(obj);
    else {
        assert.equal((typeof obj),'object');
        Object.keys(obj).forEach(function(k) {
            if (k==='_XML' && (typeof obj[k])==='string')
                cb(obj[k]);
            else {
                cb("<");
                cb(k);
                Object.keys(obj[k]).forEach(function(a) {
                    if (a!=='_children') {
                        if (obj[k][a]===undefined) {
                            //console.log("*** undef obj: %j  k: %j  a: %j",obj,k,a);
                        } else {
                            const s = obj[k][a]===null  ? "" :
                                obj[k][a]===true      ? "1" :
                                obj[k][a]===false     ? "0" :
                                obj[k][a].toString();
                            assert.equal(s.indexOf('"'),-1);
                            cb(" ");cb(a);cb('="');cb(s);cb('"');
                        }
                    }
                });
                const children = obj[k]._children;
                if (children!==undefined) {
                    cb('>');
                    assert(children instanceof Array);
                    for (let i=0;i<children.length;i++)
                        exports.build(children[i],cb);
                    cb("</");cb(k);cb('>');
                } else
                    cb('/>');
            }
        });
    }
    return ans;
};
