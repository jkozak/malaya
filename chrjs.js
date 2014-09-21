var util    = require("./util.js");
var sweet   = require("sweet.js");
var codegen = require('escodegen');
var fs      = require('fs');
var path    = require('path');

sweet.loadMacro('./chrjs.sjs');

require.extensions['.chrjs'] = function(module,filename) {
    var content = fs.readFileSync(filename,'utf8');
    module._compile(codegen.generate(sweet.parse(content,sweet.loadedMacros)),filename);
};

if (util.env==='test')
    exports._private = {compile: function(script) {
	return codegen.generate(sweet.parse(script,sweet.loadedMacros));
    } }
