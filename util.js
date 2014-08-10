var _util = require('util');
var shell = require('shelljs');
var    fs = require('fs');

exports.verbosity = 3;

exports.format = _util.format;

exports.debug = function (msg) {
    if (exports.verbosity>2)
	_util.debug(_util.format.apply(null,arguments));
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

exports.regime = (function() {
    var regime = process.env.NODE_REGIME;
    if (regime==='production')
	regime = 'prod';
    if (regime==='' || regime===undefined)
	regime = 'dev';
    if (!{dev:true,prod:true,test:true}[regime])
	throw new Error(_util.format("bad regime: %j",regime));
    return regime;
})();

if (exports.regime==='prod' && exports.source_version.slice(-1)==='+')
    throw new Error("must run registered code in production");
