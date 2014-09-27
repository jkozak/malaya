var util    = require("./util.js");
var codegen = require('escodegen');
var eschrjs = require('./eschrjs.js');
var fs      = require('fs');
var path    = require('path');
var assert  = require('assert');

function transformToInterpreter(chrjs) {
    assert.strictEqual(chrjs.type,'Program');
    return chrjs;
}

function transform(chrjs) {
    // +++ transform chrjs to plain js
    return transformToInterpreter(chrjs);
}

require.extensions['.chrjs'] = function(module,filename) {
    var content = fs.readFileSync(filename,'utf8');
    module._compile(codegen.generate(transform(eschrjs.parse(content))),filename);
};

if (util.env==='test') {
    exports._private = {
	compile: function(script) {
            return codegen.generate(transform(eschrjs.parse(script)));
        },
	parse: function(script) {
	    return eschrjs.parse(script,{range:true,loc:true});
	} };
}
