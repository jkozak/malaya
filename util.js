var _util = require('util');
var shell = require('shelljs');
var    fs = require('fs');
var    ds = require('data-structures');

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
	idxStart  = 0
	while ((idx=leftOver.indexOf("\n",idxStart))!==-1) {
	    line = leftOver.substring(idxStart,idx);
	    if (!fn(line))
		break;
	    idxStart = idx+1;
	}
	leftOver = leftOver.substring(idxStart);
    }
};

exports.readFileLinesSync = function(path,fn) {
    var fd = fs.openSync(path,"r+");
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
exports.serialise = function(v) {
    return JSON.stringify(v,function(k,v) {
	if (v instanceof Date)
	    return "date:"+v;
	else if (typeof v==="string")
	    return ":"+v;
	else
	    return v;
    });
};

exports.deserialise = function(s) {
    return JSON.parse(s,function(k,v) {
	if (typeof v!=="string")
	    return v;
	else if (v.charAt(0)==':')
	    return v.substring(1);
	else if (v.startsWith("date:"))
	    return new Date(v.substring(5)); // "date:".length===5
	else
	    return v;
    });
};

exports.source_version = (function() {
    var cmd;
    var out;
    cmd = shell.exec("hg id -t",{silent:true});
    out = cmd.output.trim();
    if (cmd.code===0 && out!=='' && out!=='tip')
	return out;
    cmd = shell.exec("hg id -i",{silent:true});
    if (cmd.code===0)
	return cmd.output.trim();
    return JSON.parse(fs.readFileSync('./package.json')).version;
})();

exports.env = (function() {
    var env = process.env.NODE_ENV;
    if (env==='production')
	env = 'prod';
    if (env==='' || env===undefined)
	env = 'dev';
    if (!{dev:true,prod:true,test:true}[env])
	throw new Error(_util.format("bad NODE_ENV: %j",env));
    return env;
})();

// !!! this is really slow, avoid !!!
exports.Set = function() {
    this.map = new ds.Map();
    return this;
};
exports.Set.prototype.has     = function(k) {return this.map.has(k);};
exports.Set.prototype.add     = function(k) {this.map.set(k,null);};
exports.Set.prototype.delete  = function(k) {this.map.delete(k);};
exports.Set.prototype.forEach = function(f) {this.map.forEach(f);};
Object.defineProperty(exports.Set.prototype,'size',{
    get:function() {return this.map.size;}
});

exports.Map = ds.Map;
Object.defineProperty(ds.Map.prototype,'length',{get:function() {return this.size;}});

exports.inspect = _util.inspect;

if (exports.env==='prod' && exports.source_version.slice(-1)==='+')
    throw new Error("must run registered code in production");
