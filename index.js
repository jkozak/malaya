"use strict";

exports.cmdline    = require('./cmdline.js');
exports.compiler   = require('./compiler.js'); // also adds .chrjs extension to `require`
exports.engine     = require('./engine.js');
exports.util       = require('./util.js');

exports.load       = require('./compiler.js').load;

exports.plugin     = require('./plugin.js');
exports.Plugin     = require('./plugin.js').Plugin;

exports.tracing    = require('./tracing.js');

exports.middleware = require('./middleware.js');

exports.add = thing=>{
    if (thing.prototype instanceof exports.Plugin)
        exports.plugin.add(thing);
    else
        throw new Error(`don't know how to add ${JSON.stringify(thing)}`);
};
