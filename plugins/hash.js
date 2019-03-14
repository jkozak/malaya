"use strict";

// provides access to the Malaya hash-store

const  plugin = require('../plugin.js');

plugin.add('hash',class extends plugin.Plugin {
    out([op,js]) {
        const pl = this;
        switch (op) {
        case 'get':
            pl.update(['get',{hash:js.hash,value:this.engine.hashes.getSync(js.hash,{})}]); // +++ async
            break;
        case 'put': {
            const h = this.engine.hashes.putSync(js.value,{});
            pl.update(['put',{hash:h,value:js.value}]);                                  // +++ async
            break;
        }
        default:
            throw new Error("bad op: %j",op);
        }
    }
});
