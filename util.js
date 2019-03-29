"use strict";
/*eslint-disable no-extend-native*/

const _util = require('util');
const    os = require('os');
const    fs = require('fs');

exports.verbosity     = 3;
exports.hashAlgorithm = 'sha1';

exports.format = _util.format;

exports.debug = function (msg) {
    if (exports.verbosity>2)
        console.warn(_util.format.apply(null,arguments));
};

exports.info = function (msg) {
    if (exports.verbosity>1)
        console.log(_util.format.apply(null,arguments));
};

exports.error  = function (msg) {
    if (exports.verbosity>0)
        console.error(_util.format.apply(null,arguments));
};

exports.inherits = _util.inherits;

exports.readFdLinesSync = function(fd,fn) {
    const bufferSize = 64*1024;
    const buffer     = Buffer.alloc(bufferSize);
    let   leftOver   = '';
    let   done       = false;
    let   read,line,idxStart,idx;
    while (!done && (read=fs.readSync(fd,buffer,0,bufferSize,null))!==0) {
        leftOver += buffer.toString('utf8',0,read);
        idxStart  = 0;
        while ((idx=leftOver.indexOf('\n',idxStart))!==-1) {
            line = leftOver.substring(idxStart,idx);
            if (!fn(line)) {
                done = true;
                break;
            }
            idxStart = idx+1;
        }
        leftOver = leftOver.substring(idxStart);
    }
    return leftOver;            // return everything after the last newline
};

exports.readFileLinesSync = function(path0,fn) {
    const fd = fs.openSync(path0,"r");
    try {
        return exports.readFdLinesSync(fd,fn);
    } finally {
        fs.closeSync(fd);
    }
};

// object stashing format:
//  JSON with extra encoding:
//     string "abc" is encoded as ":abc"
//     date   DDD   is encoded as "date:"+DDD
//     ...
const serialise = function(v0) {
    return JSON.stringify(v0,function(k,v) {
        if (v instanceof Date)
            return "date:"+v.toISOString();
        else if (typeof v==="string")
            return ":"+v;
        else
            return v;
    });
};
const deserialise = function(v) {
    if (typeof v!=="string")
        return v;
    else if (v.charAt(0)===':')
        return v.substring(1);
    else if (v.indexOf("date:")===0)
        return new Date(v.substring(5)); // "date:".length===5
    else
        throw new Error(_util.format("unencoded: %s",v));
};

exports.Fail = function(msg) {
    this.name    = 'Fail';
    this.message = msg;
};
exports.Fail.prototype             = Object.create(Error.prototype);
exports.Fail.prototype.constructor = exports.Fail;

exports.serialise = function(v) {
    // disable standard `toJSON` processing which we replace above
    const saveDate = Date.prototype.toJSON;
    try {
        Date.prototype.toJSON = function(){return this;};
        return serialise(v);
    } finally {
        Date.prototype.toJSON = saveDate;
    }
};

exports.deserialise = function(s) {
    return JSON.parse(s,function(k,v) {
        return deserialise(v);
    });
};

exports.makeHttpPortName = function(req,prefix) { // nodejs http connection here
    const sock = req.socket;
    const prot = req.protocol==='https' ? 'wss' : 'ws';
    let   addr = sock.remoteAddress;
    const  pfx = '::ffff:';
    const  sfx = '/.websocket';
    prefix = prefix || req.path;
    if (addr.startsWith(pfx))
        addr = addr.substr(pfx.length);
    if (prefix.endsWith(sfx))
        prefix = prefix.slice(0,prefix.length-sfx.length);
    return _util.format("%s://%s:%s%s",prot,addr,sock.remotePort,prefix);
};

exports.deepClone = function(json) {
    return JSON.parse(JSON.stringify(json)); // lazy, very
};

exports.startsWith = function(str,prefix) {
    return str.indexOf(prefix)===0;
};

exports.endsWith = function(str,suffix) {
    return str.indexOf(suffix,str.length-suffix.length)!==-1;
};

exports.readToEnd = (stream,cb)=>{
    const bufs = [];
    stream.on('data',chunk=>{
        bufs.push(chunk);
    });
    stream.on('end',err=>{
        console.log("*** end");
        cb(err,Buffer.concat(bufs).toString());
    });
};

exports.after = function(times,fn) {
    if (times<0)
        throw new Error("after called with negative count");
    else if (times<1)
        return fn();
    else
        return ()=>{
            if (--times<1)
                fn();
        };
};

exports.parsePort = x=>{
    const i = parseInt(x);
    return isNaN(i) ? x : i;
};

exports.fmtSocketAddress = s=>{
    const a = s.address();
    if (typeof a==='string')
        return a;
    if (typeof a==='object' && a.family==='IPv4')
        return `${a.address}:${a.port}`;
    throw new Error(`unknown socket address type: ${JSON.stringify(a)}`);
};


// environmental stuff

exports.getSourceVersion = function() {
    const shell = require('shelljs');
    let     ans = '';
    const   com = shell.exec("git status --porcelain",{silent:true});
    const   tag = shell.exec("git describe --tags",{silent:true});
    const   rev = shell.exec("git rev-parse HEAD",{silent:true});
    const   ver = require('./package.json').version;
    if (tag.code===0)
        ans = tag.stdout.trim();
    else if (rev.code===0)
        ans = rev.stdout.trim();
    else
        ans = ver;
    if (com.code!==0 || com.stdout.trim()!=='')
        ans += '?';
    return ans;
};

exports.onWindows = /^win/.test(os.platform());

exports.env = (function() {
    let env = process.env.NODE_ENV;
    if (env==='production')
        env = 'prod';
    if (env==='' || env===undefined || env==='development')
        env = 'dev';
    if (!{dev:true,prod:true,test:true,benchmark:true}[env])
        throw new exports.Fail(_util.format("bad NODE_ENV: %j",env));
    return env;
})();

exports.inspect = _util.inspect;

if (exports.env==='test')
    exports._private = {
        deserialise: deserialise
    };

if (exports.env==='prod' && exports.getSourceVersion().slice(-1)==='?')
    throw new exports.Fail("must run registered code in production");
