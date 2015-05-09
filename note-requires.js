"use strict";

var      _ = require('underscore');
var   path = require('path');
var VError = require('verror');

exports.basedir = process.cwd();
exports.enabled = false;
exports.files   = {};

var        save = null;
var cExtensions = null;

exports.register = function(fn) {
    if (save!==null)
        throw new Error("`note-requires` already active");
    save = {};
    for (var k in require.extensions) {
        /* eslint no-loop-func:0 */
        require.extensions[k] = (function(ext) {
            save[k] = ext;
            return function(module,filename) {
                if (cExtensions!==_.keys(require.extensions).length)
                    throw new VError("require.extensions extended after note-requires init");
                if (exports.enabled) 
                    exports.files[path.relative(exports.basedir,filename)] = fn ? fn(filename) : null;
                return ext(module,filename);
            };
        })(require.extensions[k]);
    }
    cExtensions = _.keys(require.extensions).length;
};

exports.unregister = function() {
    if (save===null)
        throw new Error("note-requires not active");
    for (var k in save)
        require.extensions[k] = save[k];
    save = cExtensions = null;
    exports.enabled = false;
    exports.basedir = process.cwd();
    exports.files   = {};
};
