"use strict";
/*eslint-disable no-extend-native*/

var _util = require('util');
var shell = require('shelljs');
var    fs = require('fs');
var  path = require('path');

exports.verbosity = 3;

exports.format = _util.format;

exports.debug = function (msg) {
    if (exports.verbosity>2)
        console.warn(_util.format.apply(null,arguments));
};

exports.info = function (msg) {
    if (exports.verbosity>1)
        _util.print("INFO: "+_util.format.apply(null,arguments));
};

exports.error  = function (msg) {
    if (exports.verbosity>0)
        _util.error(_util.format.apply(null,arguments));
};

exports.printf  = function (msg) {
    _util.print(_util.format.apply(null,arguments));
};

exports.inherit = _util.inherit;

exports.readFdLinesSync = function(fd,fn) {
    var bufferSize = 1024;
    var buffer     = new Buffer(bufferSize);
    var leftOver   = '';
    var read,line,idxStart,idx;
    while ((read=fs.readSync(fd,buffer,0,bufferSize,null))!==0) {
        leftOver += buffer.toString('utf8',0,read);
        idxStart  = 0;
        while ((idx=leftOver.indexOf("\n",idxStart))!==-1) {
            line = leftOver.substring(idxStart,idx);
            if (!fn(line))
                break;
            idxStart = idx+1;
        }
        leftOver = leftOver.substring(idxStart);
    }
};

exports.readFileLinesSync = function(path0,fn) {
    var fd = fs.openSync(path0,"r+");
    try {
        exports.readFdLinesSync(fd,fn);
    } finally {
        fs.closeSync(fd);
    }
};

// object stashing format:
//  JSON with extra encoding:
//     string "abc" is encoded as ":abc"
//     date   DDD   is encoded as "date:"+DDD
//     ...
var serialise = function(v0) {
    return JSON.stringify(v0,function(k,v) {
        if (v instanceof Date)
            return "date:"+v;
        else if (typeof v==="string")
            return ":"+v;
        else
            return v;
    });
};
var deserialise = function(v) {
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

process.on('uncaughtException', function(err) {
    /*eslint-disable no-process-exit*/
    if (err instanceof exports.Fail) {
        console.log(err.message);
        process.exit(100);
    } else {
        console.error(err.stack);
        process.exit(101);
    }
    /*eslint-enable no-process-exit*/
});

exports.serialise = function(v) {
    // disable standard `toJSON` processing which we replace above
    var saveDate = Date.prototype.toJSON;
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

exports.sourceVersion = (function() {
    var cmd;
    var out;
    cmd = shell.exec("hg id -t",{silent:true});
    out = cmd.output.trim();
    if (cmd.code===0 && out!=='' && out!=='tip')
        return out;
    cmd = shell.exec("hg id -i",{silent:true});
    if (cmd.code===0)
        return cmd.output.trim();
    try {
        return JSON.parse(fs.readFileSync(path.resolve(__dirname,'./package.json'))).version;
    } catch (e) {
        return "???";
    }
})();

exports.env = (function() {
    var env = process.env.NODE_ENV;
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

if (exports.env==='prod' && exports.source_version.slice(-1)==='+')
    throw new exports.Fail("must run registered code in production");
