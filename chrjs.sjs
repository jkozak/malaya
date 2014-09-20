macro obj_term {
    rule { $[...] $id:ident }    => { ''  : __VR($id) }
    rule { $id:ident : $t:expr } => { $id : $t }
}

macro arr_term {
    rule { $[...] $id:ident }  => { __VR($id) }
    rule { $term }             => { $term }
}

macro term {
    rule { [ $terms:arr_term (,) ... ] } => {
	[ $terms (,) ...]
    }
    rule { { $terms:obj_term (,) ... } } => { { $terms (,) ... } }
    rule { $e:expr }
}

macro rule_item {
    rule { + $t:term     } => { __ADD($t)    }
    rule { - $t:term     } => { __DELETE($t) }
    rule { ( $e:expr )   } => { __GUARD($e)  }
    rule {   $t:term     } => { __MATCH($t)  }
}

macro rule_ {
    rule { rule { $items:rule_item (;) ... } } => {
	$items (,) ...
    }
}

macro store_item {
    rule { $r:rule_ } => { ['rule',$r] }
    rule { $t:term  } => { ['term',$t] }
}

macro store {
    rule { { $items:store_item (;) ... } } => {
	(function() {
	    var items = [
		$items (,) ...
	    ];
	})();
    }
}
