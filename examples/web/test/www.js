"use strict";

const       bl = require('../bl');

const testutil = require('malaya/testutil');

const   assert = require('chai').assert;
const        _ = require('underscore');

const     path = require('path');


describe("www",function() {
    let   ss = null;
    const $$ = [];
    before(function(done){
        const cBrowsers = 2;
        const     done1 = _.after(cBrowsers,done);
        ss = new testutil.SystemSlice(testutil.resetBl(bl,[]));
        for (let i=0;i<cBrowsers;i++){
            ss.addBrowser({
                file:   "www/index.html",
                scripts: ['file://'+path.join(__dirname,'..','node_modules/jquery/dist/jquery.min.js')],
                resourceLoader: (res,cb) => {
                    res.defaultFetch(cb);
                },
                virtualConsole: ss.jsdom.createVirtualConsole().sendTo(console),
                onload: (w) => {
                    $$.push(w.jQuery);
                    done1();
                }
            });
        }
    });
    it("lives!",function(){
        assert.strictEqual($$.length,2);
        $$[0]('#go').click();
        //??? POST? ???
    });
});
