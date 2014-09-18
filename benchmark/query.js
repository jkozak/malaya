"use strict";

var chr = require('../chr.js');

var Match  = chr._private.ItemMatch; // +++ replace these with chrjs notation +++
var Guard  = chr._private.ItemGuard;
var Delete = chr._private.ItemDelete;
var Add    = chr._private.ItemAdd;
var Fail   = chr._private.ItemFail;

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
	    store.snap(new chr.Snap([new Match(["X",new chr.Variable('x'),new chr.Variable('p')])],
				    0,
				    function(x,ctx){return x+ctx['p'];} ));
	});
    });
    samples.forEach(function(n) {
	var store = new chr.Store();
	for (var i=0;i<n/2;i++) {
	    store.add(["X",i,10]);
	    store.add(["X",i,20]);
	}
	bench("2 headed, store"+n,function() {
	    store.snap(new chr.Snap([new Match(["X",new chr.Variable('x'),new chr.Variable('p')]),
				     new Match(["X",new chr.Variable('x'),new chr.Variable('q')]),
				     new Guard(function(ctx){return ctx['p']>ctx['q'];}) ],
				    0,
				    function(x,ctx){return x+ctx['p']+ctx['q'];} ));
	});
    });
    samples.forEach(function(n) {
	var store = new chr.Store();
	for (var i=0;i<n/2;i++) {
	    store.add(["X",i,10]);
	    store.add(["X",i,20]);
	    store.add(["X",i,30]);
	}
	bench("3 headed, store"+n,function() {
	    store.snap(new chr.Snap([new Match(["X",new chr.Variable('x'),new chr.Variable('p')]),
				     new Match(["X",new chr.Variable('x'),new chr.Variable('q')]),
				     new Match(["X",new chr.Variable('x'),new chr.Variable('r')]),
				     new Guard(function(ctx){return ctx['p']>ctx['q'] && ctx['q']>ctx['r'];}) ],
				    0,
				    function(x,ctx){return x+ctx['p']+ctx['q']+ctx['r'];} ));
	});
    });
});
