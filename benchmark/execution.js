"use strict";

var chrjs = require("../chrjs.js");

var     _ = require('underscore');

suite('execution',function() {
    set('iterations',10);
    var store;
    var storeG;
    before(function() {
	store  = require('../test/bl/match.chrjs');
	storeG = _.clone(store);
	storeG._genPrepare();
    });
    bench("match enter 10 prices",function () {
	store.clear();
	for (var i=0;i<10;i++)
	    store.update(['match-price',{user:"John Kozak",instrument:"IL21",volume:10000000,isBuy:true,t:1}]);
    });
    bench("match enter 20 prices",function () {
	store.clear();
	for (var i=0;i<20;i++)
	    store.update(['match-price',{user:"John Kozak",instrument:"IL21",volume:10000000,isBuy:true,t:1}]);
    });
    bench("match enter 10 prices, gen'd _prepare",function () {
	storeG.clear();
	for (var i=0;i<10;i++)
	    storeG.update(['match-price',{user:"John Kozak",instrument:"IL21",volume:10000000,isBuy:true,t:1}]);
    });
    bench("match enter 20 prices, gen'd _prepare",function () {
	storeG.clear();
	for (var i=0;i<20;i++)
	    storeG.update(['match-price',{user:"John Kozak",instrument:"IL21",volume:10000000,isBuy:true,t:1}]);
    });
});

