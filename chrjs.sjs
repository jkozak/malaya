macro term_obj {
    rule { $[...] $id:ident }     => { ''  : new chr.VariableRest($id) }
    rule { $id:ident : $t:expr } => { $id : $t }
    rule { $id:lit   : $t:expr }  => { $id : $t }
}

macro term_arr {
    rule { $[...] $id:ident }  => { new chr.VariableRest($id) }
    rule { $term }             => { $term }
}

macro term {
    rule { $t:fat_term } => { $t }
    rule { $e:expr }    => { $e }
}

macro fat_term {
    rule { [ $terms:term_arr (,) ... ] } => { [ $terms (,) ...]  }
    rule { { $terms:term_obj (,) ... } } => { { $terms (,) ... } }
}

macro expr_ {
    case { _ $id:ident } => {return #{$t};}
    case { _ $l:lit }    => {return #{$l};}
}

// +++ snap +++

macro query {
    rule { $name:ident ( $vars:ident (,) ... ; $fat_term (,) ... ; $accum:ident ) $init:lit : $iter:expr } => {
	// +++ 
    }
}

macro rule_item {
    case { _ + $t:term           } => {
	return #{new chr.ItemAdd($t)};
    }
    case { _ - $t:term           } => {
	return #{new chr.ItemDelete($t)};
    }
    case { _ $id:ident = $x:expr } => {
	//vars[unwrapSyntax(#{$id})] = null;
	return #{new chr.ItemDelete($t)};
    }
    case { _ ( $e:expr )         } => {
	var vars = new require('immutable').Set();
	// +++ walk AST pulling out variable names into vars +++
	// +++ avoiding e.g. function name in calls as we go +++
	// +++ call below is then something like:
	//     (function($vars (,) ...) {return $e;})(ctx.get(makeString($vars) (,) ...))
	return #{new chr.ItemGuard(function(ctx) {return $e;})};
    } 
    case { _   $t:fat_term       } => {
	return #{new chr.ItemMatch($t)};
    }
}

macro rule_ {
    rule { rule { $items:rule_item (;) ... } } => {
	$items (,) ...
    }
}

macro store_item {
    rule { $r:rule_ } => { ['rule', $r] }
    rule { $q:query } => { ['query',$q] }
    rule { $t:term  } => { ['fact', $t] }
}

macro store {
    rule { { $items:store_item (;) ... } } => {
	(function() {
	    var items = [ $items (,) ... ];
	})();
    }
    rule { $id:ident { $items:store_item (;) ... } } => {
	var $id = (function() {
	    var items = [ $items (,) ... ];
	})();
    }
}

export store;
