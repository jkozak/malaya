var _util = require('util');

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

