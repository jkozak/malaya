"use strict";

require("../compiler.js");

suite('execution',function() {
    set('iterations',10);
    let store;
    before(function() {
        store  = require('../test/bl/match.chrjs');
    });
    bench("match enter 10 prices",function () {
        store.reset();
        for (let i=0;i<10;i++)
            store.update(['match-price',{user:"John Kozak",instrument:"IL21",volume:10000000,isBuy:true,t:1}]);
    });
    bench("match enter 20 prices",function () {
        store.reset();
        for (let i=0;i<20;i++)
            store.update(['match-price',{user:"John Kozak",instrument:"IL21",volume:10000000,isBuy:true,t:1}]);
    });
});
