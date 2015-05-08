var   util = require('../../../util.js');
var assert = require('assert');
var      _ = require('underscore');

require('../bl.chrjs');         // do this here to avoid timeout in tests

function mkFixture(msjson) {    // make test fixture from prevalence serialisation format data
    return util.deserialise(JSON.stringify(msjson));
}

function mkIDB(fixture) {       // bare server without prevalence layer
    var bl = require('../bl.chrjs');
    bl.reset();                 // `bl` is effectively shared by `require`
    for (var i in fixture)
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
    bl.addReturningNoOutput = function(x) {
        var outs = this.addReturningOutputs(x);
        assert(outs.length===0,util.format("expected no output, not: %j",outs));
    };
    return bl;
}

function mkUserLoggedIn(user,channel) {
    user = util.deepClone(user);
    user[1].LoggedOn = 1;
    user[1].port     = util.format('test://%s/',channel);
    return user;
}

var USER_JK = mkFixture([":Permissions",{
    "DirtyFlag":0,
    "TeamID":100,
    "UpdateDate":"date:Fri Jul 25 17:49:33 2014",
    "ApplicationID":51,
    "Deleted":0,
    "MatchingVolEntry":":B",
    "UpdateUserID":51,
    "SessionID":0,
    "Enabled":1,
    "AppRole":1283,
    "roles":":ABDT",
    "CurrFailCount":0,
    "LogOnTime":"date:Fri Jul 25 17:49:29 2014",
    "CountryID":44,
    "CompanyID":100,
    "CSPID":1,
    "LoggedOn":0,
    "ApplicationName":":John Kozak",
    "Password":":JK"
}]);

var USER_FM = mkFixture([":Permissions",{
    "DirtyFlag":0,
    "TeamID":1,
    "UpdateDate":"date:Thu Dec  2 16:25:14 2004",
    "ApplicationID":1,
    "Deleted":0,
    "MatchingVolEntry":":B",
    "UpdateUserID":1,
    "SessionID":76601,
    "Enabled":1,
    "AppRole":2,
    "roles":":T",
    "CurrFailCount":0,
    "LoggedOn":0,
    "LogOnTime":"date:Wed Dec  1 14:54:11 2004",
    "CountryID":44,
    "CompanyID":1,
    "CSPID":1,
    "ApplicationName":":Floy Murazik",
    "Password":":241tykxKcB_n6fR",
    "anon":true
}]);

var TCS = mkFixture([
    [":Cookies", {
         "CookieID": 2, 
         "ApplicationID": 51, 
         "Cookie": ":eikooC"
     }],
    [":Team", {
         "RegionID": 1, 
         "TeamID": 1, 
         "UpdateDate": "date:Wed Sep 29 00:00:00 1999", 
         "TeamRole": 2, 
         "UpdateUserID": -1, 
         "TradeBrokerageRate": 1, 
         "TeamSettlementName": ":BZW", 
         "SettlementID": 1, 
         "TeamName": ":BARCAP", 
         "EnabledFlag": 1, 
         "CountryID": 44, 
         "TeamTLA": ":IE5", 
         "CompanyID": 1, 
         "QuoteBrokerageRate": 0, 
         "DeletedFlag": 0
     }], 
    [":Team", {
         "RegionID": 1, 
         "TeamID": 100, 
         "UpdateDate": "date:Wed Sep 29 00:00:00 1999", 
         "TeamRole": 3, 
         "UpdateUserID": -1, 
         "TradeBrokerageRate": 1, 
         "TeamSettlementName": ":DOW", 
         "SettlementID": 100, 
         "TeamName": ":DOW", 
         "EnabledFlag": 1, 
         "CountryID": 44, 
         "TeamTLA": ":IE5", 
         "CompanyID": 100, 
         "QuoteBrokerageRate": 0, 
         "DeletedFlag": 0
     }] 
]);

var FE_COOKIES = mkFixture([
    [":FEConfig",
        {
            "CookieData": ":<blotter-cell-prototype name=\"broker\">$STOCKNAME +999.9999 - +999.9999 99* A99999 X 99999A 99*</blotter-cell-prototype>",
            "TabID": 0,
            "ConfigID": 70
        }],
    [":FEConfig",
        {
            "TabID": 0,
            "CookieData": ":<blotter-cell-prototype name=\"trader\">$STOCKNAME +999.9999 - +999.9999       A99999 X 99999A</blotter-cell-prototype>",
            "ConfigID": 72
        }],
    [":FEConfig",
        {
            "CookieData": ":<custom-page-count brokerTabs=\"3\" traderTabs=\"2\" />",
            "TabID": 0,
            "ConfigID": 80
        }],
    [":FEConfig",
        {
            "ConfigID": 90,
            "TabID": 0,
            "CookieData": ":<remove-all-colour-schemes/>"
        }],
    [":FEConfig",
        {
            "ConfigID": 1,
            "TabID": 0,
            "CookieData": ":<remove-all-blotter-tabs/>"
        }],
    [":FEConfig",
        {
            "ConfigID": 100,
            "TabID": 0,
            "CookieData": ":<new-instrument-wait timeout=\"15.0\" />"
        }],
    [":FEConfig",
        {
            "TabID": 0,
            "CookieData": ":<blotter-custom-tab>1 2 26 47 40 41 43 44 3 23 28 46 27 31 33 32 45 34</blotter-custom-tab>",
            "ConfigID": 50
        }],
    [":FEConfig",
        {
            "CookieData": ":<add-blotter-tab name=\"All\">1 2 26 47 40 41 43 44 3 23 28 46 27 31 33 32 45 34</add-blotter-tab>",
            "TabID": 0,
            "ConfigID": 10
        }]
]);

var              USERS = [USER_JK,USER_FM].concat(TCS).concat(FE_COOKIES);
var USERS_JK_LOGGED_IN = [mkUserLoggedIn(USER_JK,'JK'),USER_FM].concat(TCS).concat(FE_COOKIES);
var USERS_FM_LOGGED_IN = [mkUserLoggedIn(USER_FM,'FM'),USER_JK].concat(TCS).concat(FE_COOKIES);

var INSTRUMENTS = mkFixture([
    [":InstrumentClass", 
     {
         "SellBrokerage": 20,
         "AssociatedTitle": 1, 
         "Title": ":Straight Prices", 
         "Display_ShowPlusMinus": 0, 
         "AuctionVolumes": ":25 30 35 40 45 50 75 100 150 200", 
         "InstSubClassID": 1, 
         "PriceTick": 0.001, 
         "MarketID": 2, 
         "DefaultVolume": 25, 
         "InstSubClassName": ":Conventional Straight", 
         "CounterpartyDowgate": 1, 
         "Match_xBidMinus1": 1, 
         "BuyBrokerage": 20, 
         "DefaultPercentTolerence": 0.1
     }],
    [":Instrument", 
     {
         "InstDesc": null, 
         "InstID": 34, 
         "CountryID": 44, 
         "BidBigFigure": 120.11, 
         "VisibleFlag": 1, 
         "VolatilitySpread": 2, 
         "AccrualDate": "date:Thu Jan 26 00:00:00 1995", 
         "UpdateDate": "date:Thu Sep 30 15:54:25 1999", 
         "MaturityDate": "date:Mon Dec  7 00:00:00 2015", 
         "PublishFlag": 0, 
         "AuctionInstTitle": ": ", 
         "CouponType": 0, 
         "FreeOfTax": 0, 
         "UpdateUserID": -1, 
         "AccruedMethod": 4, 
         "GreyMarket": 1, 
         "DisplayOrder": 20151207, 
         "BidDate": "date:Fri Feb 14 15:52:13 2014", 
         "IssuePrice": null, 
         "OfferDate": "date:Wed Feb  7 10:05:06 2007", 
         "MidPrice": 0.25, 
         "OfferBigFigure": 120, 
         "Strippable": 1, 
         "AuctionUpdateDate": "date:Mon Apr 14 14:48:14 2014", 
         "DirtyFlag": 0, 
         "IssueDate": "date:Thu Jan 26 00:00:00 1995", 
         "Rating": null, 
         "CouponFrequency": 2, 
         "Tranche": null, 
         "InstSubClassID": 1, 
         "PriceTick": 0.001, 
         "MarketID": 2, 
         "Currency": ":GBP", 
         "CouponFloat": 0, 
         "InstName": ":8 15", 
         "CreationDate": "date:Thu Sep 30 15:54:25 1999", 
         "VolatilityPercent": 0.1
     }], 
    [":Instrument", 
     {
         "InstDesc": null, 
         "InstID": 35, 
         "CountryID": 44, 
         "BidBigFigure": 109.44, 
         "VisibleFlag": 1, 
         "VolatilitySpread": 2, 
         "AccrualDate": "date:Thu Apr 30 00:00:00 1992", 
         "UpdateDate": "date:Thu Nov 11 16:24:53 2004", 
         "MaturityDate": "date:Fri Aug 25 00:00:00 2017", 
         "PublishFlag": 1, 
         "AuctionInstTitle": ": ", 
         "CouponType": 0, 
         "FreeOfTax": 0, 
         "UpdateUserID": -2, 
         "AccruedMethod": 4.375, 
         "GreyMarket": 1, 
         "DisplayOrder": 20170825, 
         "BidDate": "date:Thu Mar  6 15:44:50 2008", 
         "IssuePrice": 27, 
         "OfferDate": "date:Wed Feb  7 10:05:30 2007", 
         "MidPrice": 0.25, 
         "OfferBigFigure": 130, 
         "Strippable": 0, 
         "AuctionUpdateDate": "date:Mon Apr 14 14:48:14 2014", 
         "DirtyFlag": 0, 
         "IssueDate": "date:Thu Apr 30 00:00:00 1992", 
         "Rating": null, 
         "CouponFrequency": 2, 
         "Tranche": null, 
         "InstSubClassID": 1, 
         "PriceTick": 0.001, 
         "MarketID": 2, 
         "Currency": ":GBP", 
         "CouponFloat": 0, 
         "InstName": ":8T17", 
         "CreationDate": "date:Thu Sep 30 15:54:25 1999", 
         "VolatilityPercent": 0.1
     }]
]);

var MARKET = mkFixture([
    [":MarketManager",{
        "ClosingTime":"date:Wed Sep 29 1999 18:30:00 GMT+0100 (BST)",
        "OpenAutomatically":0,
        "RegionID":1,
        "MinMarketVol":10000,
        "UpdateDate":"date:Wed Sep 29 1999 07:00:00 GMT+0100 (BST)",
        "OpenPriceSeqNo":1,
        "Status":1,
        "MaxMarketVol":100000000,
        "SpecialsOrderIndex":0,
        "UpdateUserID":-1,
        "ForwardOrderIndex":0,
        "OpeningTime":"date:Wed Sep 29 1999 07:00:00 GMT+0100 (BST)",
        "RollOver2Automatically":0,
        "PriceDisplayOrderIndex":0,
        "RollOver2Time":"date:Wed Sep 29 1999 00:00:00 GMT+0100 (BST)",
        "InstDisplayOrderIndex":0,
        "MarketName":":Gilt",
        "MinIncrementBetweenPrices":1000,
        "RollOver1Automatically":0,
        "CountryID":44,
        "OpenTradeSeqNo":1,
        "MarketID":2,
        "OperationalStatus":":L",
        "RollOver1Time":"date:Wed Sep 29 1999 00:00:00 GMT+0100 (BST)",
        "MinMarketVal":1000,
        "auctionId":10000
    }],
    [":SequenceNumbers",{
        "PriceID":4,
        "PriceSequenceNo":5,
        "MarketID":2,
        "TradeID":7,
        "TradeSequenceNo":7
    }]
]);

var AUCTION = mkFixture([
    [":AuctionTemplate",{
        "AuctionName" : ":Short Break Evens",
        "UpdateDate" : "date:Tue Jul 22 2014 21:48:01 GMT+0100 (BST)",
        "id" : null,
        "Deleted" : 0,
        "CreationDate" : "date:Fri Jul 04 2014 06:55:37 GMT+0100 (BST)",
        "AuctionPhases" : ":A",
        "UpdateUserID" : 51,
        "MatchingDuration" : 121,
        "AuctionTemplateID" : 1,
        "AuctionDuration" : 61
    }],
    [":AuctionInstrumentsTemplate",{
        "AuctionTemplateID" : 1,
        "CreationDate" : "date:Fri Jul 04 2014 06:55:21 GMT+0100 (BST)",
        "InstID" : 869,
        "UpdateDate" : "date:Fri Jul 04 2014 06:55:21 GMT+0100 (BST)",
        "UpdateUserID" : 52,
        "AuctionTemplateInstance" : 0,
        "AuctionID" : 0
     }],
    [":AuctionInstrumentsTemplate",{
        "InstID" : 1870,
        "AuctionTemplateID" : 1,
        "CreationDate" : "date:Fri Jul 04 2014 06:55:21 GMT+0100 (BST)",
        "AuctionTemplateInstance" : 0,
        "UpdateUserID" : 52,
        "UpdateDate" : "date:Fri Jul 04 2014 06:55:21 GMT+0100 (BST)",
        "AuctionID" : 0
    }],
    [":AuctionInstrumentsTemplate",{
        "AuctionID" : 0,
        "AuctionTemplateID" : 1,
        "CreationDate" : "date:Fri Jul 04 2014 06:55:21 GMT+0100 (BST)",
        "InstID" : 1737,
        "UpdateDate" : "date:Fri Jul 04 2014 06:55:21 GMT+0100 (BST)",
        "AuctionTemplateInstance" : 0,
        "UpdateUserID" : 52
    }],
    [":AuctionInstrumentsTemplate",{
        "UpdateUserID" : 52,
        "AuctionTemplateInstance" : 0,
        "UpdateDate" : "date:Fri Jul 04 2014 06:55:21 GMT+0100 (BST)",
        "InstID" : 557,
        "AuctionTemplateID" : 1,
        "CreationDate" : "date:Fri Jul 04 2014 06:55:21 GMT+0100 (BST)",
        "AuctionID" : 0
    }]
]);

function assertJustOne(arr,fn) {
    assert.equal(arr.filter(fn).length,1);
}

describe("json-for-xml interactions",function() {
    describe("logon",function() {
        it("should handle logon0 unencrypted",function() {
            var IDB = mkIDB(USERS);     // not set to require encrypted logons
            IDB.add(['logon0',{},{port:'test://'}]);
            assert.deepEqual(IDB.getOutputs(),[['_output','self',{logon0:{}}]]);
        });
        var tryLogon = function(user,pw,idb) { // unencrypted
            idb = idb || mkIDB(util.deepClone(USERS));
            var out = idb.addReturningOneOutput(
                ['logon',{protocol:12,t:1,pw:pw,j:'1.8.0_31',user:user},{port:'test://'}] );
            assert.equal(out[1],'self');
            assert.equal(_.keys(out[2]).length,1);
            return out[2].logon;
        }
        it("should handle good logon",function() {
            var resp = tryLogon("John Kozak","JK");
            assert.equal(resp.OK,1);
            assert.notStrictEqual(resp.session_key,undefined);
        });
        it("should handle bad user logon",function() {
            var resp = tryLogon("Bad Jock McBad","JK");
            assert.equal(resp.OK,0);
            assert.strictEqual(resp.session_key,undefined);
        });
        it("should handle blank password logon",function() {
            var resp = tryLogon("John Kozak",'');
            assert.equal(resp.OK,0);
            assert.strictEqual(resp.session_key,undefined);
        });
        it("should handle bad password logon",function() {
            var resp = tryLogon("John Kozak",'KJ');
            assert.equal(resp.OK,0);
            assert.strictEqual(resp.session_key,undefined);
        });
        it("should only allow one simultaneous logon per user",function() {
            var  idb = mkIDB(util.deepClone(USERS));
            var resp = tryLogon("John Kozak",'JK',idb);
            assert.equal(resp.OK,1);
            assert.notStrictEqual(resp.session_key,undefined);
            resp = tryLogon("John Kozak",'JK',idb);
            assert.equal(resp.OK,0);
            assert.strictEqual(resp.session_key,undefined);
        });
        it("should return static data",function() {
            var fixture = USERS_JK_LOGGED_IN.concat(INSTRUMENTS);
            var    user = fixture[0][1];
            var    outs = mkIDB(fixture).addReturningOutputs(['start',{},{port:user.port}]);
            var    seen = {};
            outs.forEach(function(out) {
                assert.strictEqual(out[1],'self'); // all outputs to user
                assert.equal(_.keys(out[2]).length,1);
                var  tag = _.keys(out[2])[0];
                var xmls = out[2][tag]._children;
                seen[tag] = true;
                switch (tag) {
                case 'static-data': {
                    assertJustOne(xmls,function(x){return x.self                      &&
                                                   x.self.ID===user.ApplicationID     &&
                                                   x.self.Name===user.ApplicationName &&
                                                   x.self.Role===user.AppRole });
                    assert(xmls.some(function(x){return x.counterparty;}));
                    assert(xmls.some(function(x){return x.instrument;}));
                    break;
                }
                case 'contexts':
                    // +++
                    break;
                }
            });
            assert(seen['static-data']);
            assert(seen['contexts']);
            assert(seen['BigFigBlock']);
            assert(seen['initialised']);
            assert.deepEqual(outs[outs.length-1],["_output","self",{initialised:{}}]);
        });
    });
    describe("cookie",function() {
        it("should return cookie appropriately",function() {
            var users = USERS_JK_LOGGED_IN;
            var   out = mkIDB(users).addReturningOneOutput(['cookie',{id:'2'},{port:users[0][1].port}]);
            assert.deepEqual(out[2].cookie._children,['eikooC']);
            assert.deepEqual(users,USERS_JK_LOGGED_IN);
        });
        it("should return error for non-existent cookie",function() {
            var users = USERS_JK_LOGGED_IN;
            var   out = mkIDB(users).addReturningOneOutput(['cookie',{id:'0'},{port:users[0][1].port}]);
            assert.equal(out[2].cookie._children.length,0);
            assert.equal(out[2].cookie.error,"not found");
            assert.deepEqual(users,USERS_JK_LOGGED_IN);
        });
        it("should update cookies",function() {
            var users = USERS_JK_LOGGED_IN;
            var   idb = mkIDB(users);
            idb.addReturningNoOutput(['store-cookie',{id:'2',_children:["cOOKIE"]},{port:users[0][1].port}]);
            var out = idb.addReturningOneOutput(['cookie',{id:'2'},{port:users[0][1].port}]);
            assert.deepEqual(out[2].cookie._children,['cOOKIE']);
        });
    });
    describe("market",function() {
        it("should change market state on command from broker",function(){
            var users = USERS_JK_LOGGED_IN;
            var   idb = mkIDB(users.concat(MARKET));
            var   out = idb.addReturningOneOutput(['market-status',{ID:2,status:2},{port:users[0][1].port}]);
            assert.deepEqual(out,["_output","all",{"market-status":{ID:2,status:2}}]);
            out = idb.addReturningOneOutput(['market-status',{ID:2,status:1},{port:users[0][1].port}]);
            assert.deepEqual(out,["_output","all",{"market-status":{ID:2,status:1}}]);
        });
        it("should not change market state on command from just anyone",function(){
            var users = USERS_FM_LOGGED_IN;
            var   idb = mkIDB(users.concat(MARKET));
            idb.addReturningNoOutput(['market-status',{ID:2,status:2},{port:users[0][1].port}]);
        });
    });
    describe("auction",function() {
        it("should list auction templates",function() {
            var users = USERS_JK_LOGGED_IN;
            var   idb = mkIDB(users.concat(MARKET).concat(INSTRUMENTS).concat(AUCTION));
            var   out = idb.addReturningOneOutput(['AuctionTemplateBlock',{},{port:users[0][1].port}]);
            console.log("*** +++ %j",out);
        })
    });
});
