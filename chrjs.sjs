
var util    = require("./util.js");
var sweet   = require("sweet.js");
var codegen = require('escodegen');
var fs      = require('fs');

//macro store {
//}

require.extensions['.chrjs'] = function(module,filename) {
    var content = fs.readFileSync(filename,'utf8');
    module._compile(codegen.generate(sweet.parse(content,sweet.loadedMacros)),filename);
};
