"use strict";

var chr = require('../chr.js');

suite('query',function() {
    var   total = 0;
    var samples = [10,50,100];
    samples.forEach(function(n) {
	var store = new chr.Store();
	for (var i=0;i<n/2;i++) {
	    store.add(["X",i,10]);
	    store.add(["X",i,20]);
	}
	bench("1 headed, store"+n,function() {
	    total=0;
	    store.select(new chr.Select([["X",new chr.Variable('x'),new chr.Variable('p')]],
					function(ctx){total+=ctx['p'];} ));
	});
    });
    samples.forEach(function(n) {
	var store = new chr.Store();
	for (var i=0;i<n/2;i++) {
	    store.add(["X",i,10]);
	    store.add(["X",i,20]);
	}
	bench("2 headed, store"+n,function() {
	    total=0;
	    store.select(new chr.Select([["X",new chr.Variable('x'),new chr.Variable('p')],
					 ["X",new chr.Variable('x'),new chr.Variable('q')] ],
					function(ctx){return ctx['p']>ctx['q'];},
					function(ctx){total+=ctx['p']+ctx['q'];} ));
	});
    });
    samples.forEach(function(n) {
	var store = new chr.Store();
	for (var i=0;i<n/2;i++) {
	    store.add(["X",i,10]);
	    store.add(["X",i,20]);
	}
	bench("3 headed, store"+n,function() {
	    total=0;
	    store.select(new chr.Select([["X",new chr.Variable('x'),new chr.Variable('p')],
					 ["X",new chr.Variable('x'),new chr.Variable('q')] ],
					function(ctx){return ctx['p']>ctx['q'];},
					function(ctx){total+=ctx['p']+ctx['q'];} ));
	});
    });
});
