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
	rule { $x:expr }
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

// !!! should be when {...} not when (...)  !!!
macroclass chr_rule {
    pattern {
	rule { when ( $heads:term (;) ... ) $body:chr_body_term }
    }
};

macro store {
    rule { { $rules:chr_rule (;) ... } }
};


// testing only
macro foo {
    rule { $x } => { $x + 'rule1' }
};


