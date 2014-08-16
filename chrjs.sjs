
var util    = require("./util.js");
var sweet   = require("sweet.js");
var codegen = require('escodegen');
var fs      = require('fs');

macroclass head {
    pattern {
	rule { [ $heads:head (,) ...] }
    }
    pattern {
	rule { [ $heads:head (,) ... , $[...] $rest:id] }
    }
    pattern {
	rule { [ $[...] $rest:id] }
    }
    pattern {
	rule { $l:lit }
    }
    pattern {
	rule { $id:id }
    }
};

macroclass term {
    pattern {
	rule { $t:() $x:head }
    }
    pattern {
	rule { $t:(+)$x:head }
    }
    pattern {
	rule { $t:(-)$x:head }
    }
};

macroclass chr_body_term {
    pattern {
	rule { {$terms:chr_body_terms (;) ...} }
    }
    pattern {
	rule { $x:term }
    }
    pattern {
	rule { if ( $guard:expr ) $t:chr_body_term }
    }
    pattern {
	rule { if ( $guard:expr ) $t:chr_body_term else $f:chr_body_term }
    }
    pattern {
	rule { $x:expr }
    }
};

macroclass chr_rule {
    pattern {
	rule { when { $heads:term (;) ...} $body:chr_body_term }
    }
};

macro store {
    rule { $rules:chr_rule (;) ... }
};

require.extensions['.chrjs'] = function(module,filename) {
    var content = fs.readFileSync(filename,'utf8');
    module._compile(codegen.generate(sweet.parse(content,sweet.loadedMacros)),filename);
};
