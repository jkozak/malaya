"use strict";

var chr = require('../chr.js');

var Match  = chr.ItemMatch; // +++ replace these with chrjs notation +++
var Guard  = chr.ItemGuard;
var Delete = chr.ItemDelete;
var Add    = chr.ItemAdd;
var Fail   = chr.ItemFail;

suite('query',function() {
    var   total = 0;
    var samples = [10,50,100];
    samples.forEach(function(n) {
	var store = new chr.Store();
	for (var i=0;i<n/2;i++) {
	    store.add(["X",i,10]);
	    store.add(["X",i,20]);
	}
	// query(;['X',x,p];a) 0:a+p
	bench("1 headed, store"+n,function() {
	    store.snap(new chr.Snap([new Match(["X",new chr.Variable('x'),new chr.Variable('p')])],
				    0,
				    function(x,ctx){return x+ctx.get('p');} ));
	});
    });
    samples.forEach(function(n) {
	var store = new chr.Store();
	for (var i=0;i<n/2;i++) {
	    store.add(["X",i,10]);
	    store.add(["X",i,20]);
	}
	// query(;['X',x,p],['X',x,q],p>q;a) 0:a+p+q
	bench("2 headed, store"+n,function() {
	    store.snap(new chr.Snap([new Match(["X",new chr.Variable('x'),new chr.Variable('p')]),
				     new Match(["X",new chr.Variable('x'),new chr.Variable('q')]),
				     new Guard(function(ctx){return ctx['p']>ctx['q'];}) ],
				    0,
				    function(x,ctx){return x+ctx.get('p')+ctx.get('q');} ));
	});
    });
    samples.forEach(function(n) {
	var store = new chr.Store();
	for (var i=0;i<n/2;i++) {
	    store.add(["X",i,10]);
	    store.add(["X",i,20]);
	    store.add(["X",i,30]);
	}
	// query(;['X',x,p],['X',x,q],['X',x,r],p>q && q>r;a) 0:a+p+q+r
	bench("3 headed, store"+n,function() {
	    store.snap(new chr.Snap([new Match(["X",new chr.Variable('x'),new chr.Variable('p')]),
				     new Match(["X",new chr.Variable('x'),new chr.Variable('q')]),
				     new Match(["X",new chr.Variable('x'),new chr.Variable('r')]),
				     new Guard(function(ctx){return ctx.get('p')>ctx.get('q') && ctx.get('q')>ctx.get('r');}) ],
				    0,
		       function(x,ctx){return x+ctx.get('p')+ctx.get('q')+ctx.get('r');} ));
	});
    });
});
