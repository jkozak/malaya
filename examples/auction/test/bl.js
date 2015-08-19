var   util = require('../../../util.js');
var assert = require('assert');
var      _ = require('underscore');

function mkAuction(fixture) {   // bare chrjs 
    var bl = require('../bl.chrjs');
    bl.reset();                 // `bl` is effectively shared by `require`
    for (var i in fixture||[])
        bl.add(fixture[i]);
    bl.getOutputs = function() {
        var ans = [];
        this._private.orderedFacts.forEach(function(f) {
            if (f[0]==='_output')
                ans.push(f);
        });
        return ans;
    };
    bl.addReturningOutputs = function(x) {
        this.add(x);
        var outs = this.getOutputs();
        this.add(['_take-outputs']); // convention to delete `_output` from store
        return outs;
    };
    bl.addReturningOneOutput = function(x) {
        var outs = this.addReturningOutputs(x);
        assert(outs.length===1,util.format("expected single output, not: %j",outs));
        return outs[0];
    };
    bl.addReturningOneOutputTo = function(dest,x) {
        var outs = this.addReturningOutputs(x);
        assert(outs.length===1,util.format("expected single output, not: %j",outs));
        assert.strictEqual(outs[0][0],'_output');
        assert.strictEqual(outs[0][1],dest);
        return outs[0][2];
    };
    bl.addReturningNoOutput = function(x) {
        var outs = this.addReturningOutputs(x);
        assert(outs.length===0,util.format("expected no output, not: %j",outs));
    };
    bl.getAll = function(t) {
        return this._private.orderedFacts.filter(function(x){return x[0]===t;});
    };
    bl.add(['_take-outputs']);
    return bl;
}

describe("logon",function() {
    var jk = ["user",{name:"John Kozak",pw:"JK",enabled:true,port:null}];
    mkAuction([jk]);            // do this to avoid timeouts
    it("checks passwords",function() {
        var  bl = mkAuction([jk]);
        assert.deepEqual(bl.addReturningOneOutputTo('self',
                                                    ['logon',{name:"John Kozak",pw:"KJ"},{port:'test://'}]),
                         ['logon',{ok:false,msg:"bad pw"}] );
    });
    it("checks enabled",function() {
        var  bl = mkAuction([['user',_.extend({},jk[1],{enabled:false})]]);
        assert.deepEqual(bl.addReturningOneOutputTo('self',
                                                    ['logon',{name:"John Kozak",pw:"JK"},{port:'test://'}]),
                         ['logon',{ok:false,msg:"logon disabled"}] );
    });
    it("checks user name",function() {
        var  bl = mkAuction([jk]);
        assert.deepEqual(bl.addReturningOneOutputTo('self',
                                                    ['logon',{name:"Johnnie Kozak",pw:"JK"},{port:'test://'}]),
                         ['logon',{ok:false,msg:"unknown user"}] );
    });
    it("logs users on",function() {
        var bl = mkAuction([jk]);
        assert.deepEqual(bl.addReturningOneOutputTo('self',
                                                    ['logon',{name:"John Kozak",pw:"JK"},{port:'test://'}]),
                         ['logon',{ok:true}] );
    });
    it("doesn't log users on twice",function() {
        var bl = mkAuction([jk]);
        assert.deepEqual(bl.addReturningOneOutputTo('self',
                                                    ['logon',{name:"John Kozak",pw:"JK"},{port:'test://'}]),
                         ['logon',{ok:true}] );
        assert.deepEqual(bl.addReturningOneOutputTo('self',
                                                    ['logon',{name:"John Kozak",pw:"JK"},{port:'test://1'}]),
                         ['logon',{ok:false,msg:"already logged on"}] );
    });
    it("doesn't log users on twice even on same connection",function() {
        var bl = mkAuction([jk]);
        assert.deepEqual(bl.addReturningOneOutputTo('self',
                                                    ['logon',{name:"John Kozak",pw:"JK"},{port:'test://'}]),
                         ['logon',{ok:true}] );
        assert.deepEqual(bl.addReturningOneOutputTo('self',
                                                    ['logon',{name:"John Kozak",pw:"JK"},{port:'test://'}]),
                         ['logon',{ok:false,msg:"already logged on"}] );
    });
    it("lets users logon and logoff and logon",function() {
        var bl = mkAuction([jk]);
        assert.deepEqual(bl.addReturningOneOutputTo('self',
                                                    ['logon',{name:"John Kozak",pw:"JK"},{port:'test://'}]),
                         ['logon',{ok:true}] );
        bl.addReturningNoOutput(['logoff',{},{port:'test://'}]);
        assert.deepEqual(bl.addReturningOneOutputTo('self',
                                                    ['logon',{name:"John Kozak",pw:"JK"},{port:'test://'}]),
                         ['logon',{ok:true}] );
    });
});

describe("auction generation",function() {
    var fixture = [
        ["counters",{auction:99}],
        ["user",{name:"Nick Jenkins",      pw:"NJ",enabled:true,port:"test://N"}] ];
    var      bl;

    before(function() {
        bl = mkAuction(fixture);
    });
        
    it("makes an auction",function() {
        var ans = bl.addReturningOneOutputTo('self',
                                             ['auction',{state:'new'},{port:'test://N'}] );
        assert.deepEqual(ans,['auction',{id:'a#99',state:'new',owner:"Nick Jenkins"}]);
    });
    it("makes another auction with different id",function() {
        var ans = bl.addReturningOneOutputTo('self',
                                             ['auction',{state:'new'},{port:'test://N'}] );
        assert.deepEqual(ans,['auction',{id:'a#100',state:'new',owner:"Nick Jenkins"}]);
    });
    it("preserves supplied info",function() {
        var ans = bl.addReturningOneOutputTo('self',
                                             ['auction',{state:'new',description:"words"},{port:'test://N'}] );
        assert.deepEqual(ans,['auction',{id:'a#101',state:'new',owner:"Nick Jenkins",description:"words"}]);
    });
});

describe("auction cloning",function() {
    var fixture = [
        ["counters",{auction:112}],
        ["user",{name:"Nick Jenkins",      pw:"NJ",enabled:true,port:"test://N"}],
        ["user",{name:"Kenneth Widmerpool",pw:"KW",enabled:true,port:"test://K"}],
        ['auction',{id:'a#111',state:'new',owner:"Nick Jenkins",description:"prolixity itself",wibble:'carrot'}] ];
    var      bl;

    before(function() {
        bl = mkAuction(fixture);
    });
        
    it("makes a similar auction",function() {
        var ans = bl.addReturningOneOutputTo('self',
                                             ['cloneAuction',{id:'a#111'},{port:'test://K'}] );
        assert.strictEqual(ans[0],'auction');
        assert.strictEqual((typeof ans[1].id),'string');
        assert.notStrictEqual(ans[1].id,'a#111');
        assert.strictEqual(ans[1].base,'a#111');
        assert.strictEqual(ans[1].owner,"Kenneth Widmerpool");
        assert.strictEqual(ans[1].wibble,'carrot');
    });
});

describe("'match' type auction",function() {
    var  saveNow = Date.now;
    var duration = 2;
    var  fixture = [
        ["counters",{auction:101}],
        ["user",{name:"Nick Jenkins",      pw:"NJ",enabled:true,port:"test://N"}],
        ["user",{name:"Kenneth Widmerpool",pw:"KW",enabled:true,port:"test://K"}],
        ["stock",{id:"spangles"}],
        ["stock",{id:"marathon"}],
        ["auction",{id:      "sweets",
                    type:    "match",
                    stocks:  ["spangles","marathon"],
                    state:   "ready",
                    owner:   "John Kozak",
                    start:   null,
                    duration:duration
                   }]
    ];
    after(function() {
        Date.now = saveNow;
    });
    it("runs for `duration` ticks",function() {
        var bl = mkAuction(fixture);
        var  t = 1000;
        Date.now = function(){return t;};
        var ans = bl.addReturningOneOutputTo('all',
                                             ['auction',{id:'sweets',state:'run'},{port:'test://N'}] );
        assert.strictEqual(ans[0],'auction');
        assert.strictEqual(ans[1].state,'run');
        assert.strictEqual(ans[1].start,t);
        
        assert.deepEqual(bl.addReturningOneOutputTo('all',['_tick',{date:t+1000}]),
                         ['tick',{id:'sweets','remaining':1}] );

        ans = bl.addReturningOneOutputTo('all',['_tick',{date:t+2000}]);
        assert.strictEqual(ans[0],      'auction');
        assert.strictEqual(ans[1].state,'done');
    });
    it("performs trades",function() {
        var bl = mkAuction(fixture);
        var  t = 1000;
        Date.now = function(){return t;};
        bl.addReturningOneOutputTo('all',
                                   ['auction',{id:'sweets',state:'run'},{port:'test://N'}] );

        bl.addReturningOneOutputTo('all',
                                   ['price',{auction:'sweets',stock:'spangles',buy:true,volume:10,user:"Nick Jenkins"},{port:'test://N'}] );

        var outs = bl.addReturningOutputs(['price',{auction:'sweets',stock:'spangles',buy:false,volume:10,user:"Kenneth Widmerpool"},{port:'test://K'}] );
        assert.strictEqual(outs.length,3);
        assert(outs.some(function(ou) {
            assert(ou[0]==='_output' && ou[1]==='all');
            var o = ou[2];
            return o[0]==='price'          &&
                o[1].user==="Nick Jenkins" &&
                o[1].volume===0            &&
                o[1].stock==='spangles'    &&
                o[1].buy===true            &&
                o[1].auction==='sweets'; }));
        assert(outs.some(function(ou) {
            assert(ou[0]==='_output' && ou[1]==='all');
            var o = ou[2];
            return o[0]==='price'                &&
                o[1].user==="Kenneth Widmerpool" &&
                o[1].volume===0                  &&
                o[1].stock==='spangles'          &&
                o[1].buy===false                 &&
                o[1].auction==='sweets'; }));
        assert(outs.some(function(ou) {
            assert(ou[0]==='_output' && ou[1]==='all');
            var o = ou[2];
            return o[0]==='trade'                  &&
                o[1].seller==="Kenneth Widmerpool" &&
                o[1].buyer==="Nick Jenkins"        &&
                o[1].volume===10                   &&
                o[1].stock==='spangles'            &&
                o[1].auction==='sweets'; }));
    });
    it("sets the user in price from the port",function() {
        var  bl = mkAuction(fixture);
        bl.addReturningOneOutputTo('all',
                                   ['price',{auction:'sweets',stock:'spangles',buy:true,volume:5,user:"Pamela Flitton"},{port:'test://K'}]);
        var prices = bl.getAll('price');
        assert.strictEqual(prices.length,1);
        assert.strictEqual(prices[0][1].user,"Kenneth Widmerpool");
    });
    it("replaces old prices with new",function() {
        var      bl = mkAuction(fixture);
        var mkPrice = function(v) {
            return ['price',{auction:'sweets',stock:'spangles',buy:true,volume:v,user:"Nick Jenkins"},{port:'test://N'}];
        };
        bl.addReturningOneOutputTo('all',['auction',{id:'sweets',state:'run'},{port:'test://N'}] );
        
        bl.addReturningOneOutputTo('all',mkPrice(5));
        bl.addReturningOneOutputTo('all',mkPrice(10));
        bl.addReturningOneOutputTo('all',mkPrice(15)); // only this price should be left

        var prices = bl.getAll('price');
        assert.strictEqual(prices.length,1);
        assert.strictEqual(prices[0][1].volume,15);
    });
});

