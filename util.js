var _util = require('util');
var shell = require('shelljs');

exports.verbosity = 2;

exports.format = _util.format;

exports.debug = function (msg) {
    if (exports.verbosity>1)
	_util.debug(_util.format.apply(null,arguments));
};

exports.error  = function (msg) {
    if (exports.verbosity>0)
	_util.error(_util.format.apply(null,arguments));
};

exports.source_version = function() {
    var cmd;
    var out;
    cmd = shell.exec("hg id -t",{silent:true});
    out = cmd.output.trim();
    if (cmd.code===0 && out!=='' && out!=='tip')
	return out;
    cmd = shell.exec("hg id -i",{silent:true});
    if (cmd.code===0)
	return cmd.output.trim();
    // +++ try other VCSs to make generic
    // +++ if all fails, use value from package.json +++
};
