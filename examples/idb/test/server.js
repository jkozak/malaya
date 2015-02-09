var    fe3 = require('../fe3.js');

var    x2j = require('../x2j.js');
var   util = require('../../../util.js');
var      _ = require('underscore');
var   path = require('path');
var events = require('events');
var assert = require('assert');
var   temp = require('temp');
var     fs = require('fs');

var FE3_HDR_LENGTH = fe3._private.FE3_HDR_LENGTH;
var AP_XML2        = fe3._private.AP_XML2;
var AP_XML2A       = fe3._private.AP_XML2A;

temp.track();			// auto-cleanup at exit

function mkFixture(msjson) {
    return util.deserialise(JSON.stringify(msjson));
}

var USERS = mkFixture([
    [":Permissions",{"DirtyFlag":0,"TeamID":100,"UpdateDate":"date:Fri Jul 25 17:49:33 2014","ApplicationID":51,"Deleted":0,"MatchingVolEntry":":B","UpdateUserID":51,"SessionID":0,"Enabled":1,"AppRole":1283,"CurrFailCount":0,"LogOnTime":"date:Fri Jul 25 17:49:29 2014","CountryID":44,"CompanyID":100,"CSPID":1,"LoggedOn":0,"ApplicationName":":John Kozak","Password":":JK"}],
    [":Permissions",{"DirtyFlag":0,"TeamID":1,"UpdateDate":"date:Thu Dec  2 16:25:14 2004","ApplicationID":1,"Deleted":0,"MatchingVolEntry":":B","UpdateUserID":1,"SessionID":76601,"Enabled":1,"AppRole":2,"CurrFailCount":0,"LoggedOn":0,"LogOnTime":"date:Wed Dec  1 14:54:11 2004","CountryID":44,"CompanyID":1,"CSPID":1,"ApplicationName":":Floy Murazik","Password":":241tykxKcB_n6fR","anon":true}],
    [":Cookies", 
     {
         "CookieID": 2, 
         "ApplicationID": 51, 
         "Cookie": ":eikooC"
     }
    ],
    // [":Team", 
    //  {
    //      "RegionID": 1, 
    //      "TeamID": 1, 
    //      "UpdateDate": "date:Wed Sep 29 00:00:00 1999", 
    //      "TeamRole": 2, 
    //      "UpdateUserID": -1, 
    //      "TradeBrokerageRate": 1, 
    //      "TeamSettlementName": ":BZW", 
    //      "SettlementID": 1, 
    //      "TeamName": ":BARCAP", 
    //      "EnabledFlag": 1, 
    //      "CountryID": 44, 
    //      "TeamTLA": ":IE5", 
    //      "CompanyID": 1, 
    //      "QuoteBrokerageRate": 0, 
    //      "DeletedFlag": 0
    //  }
    // ], 
    // [":Team", 
    //  {
    //      "RegionID": 1, 
    //      "TeamID": 100, 
    //      "UpdateDate": "date:Wed Sep 29 00:00:00 1999", 
    //      "TeamRole": 3, 
    //      "UpdateUserID": -1, 
    //      "TradeBrokerageRate": 1, 
    //      "TeamSettlementName": ":DOW", 
    //      "SettlementID": 100, 
    //      "TeamName": ":DOW", 
    //      "EnabledFlag": 1, 
    //      "CountryID": 44, 
    //      "TeamTLA": ":IE5", 
    //      "CompanyID": 100, 
    //      "QuoteBrokerageRate": 0, 
    //      "DeletedFlag": 0
    //  }
    // ] 
]);

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
     }
    ],
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
     }
    ], 
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
     }
    ]
]);

var mkIDB = function(fixture) {	// bare server without prevalence layer
    var bl = require('../bl.chrjs');
    bl.reset();			// `bl` is effectively shared by `require`
    for (var i in fixture)
	bl.add(fixture[i]);
    return bl;
};

var mkFE3 = function(s,ap_type) {
    ap_type = ap_type || AP_XML2A;
    var hdr = new Buffer(FE3_HDR_LENGTH+4);
    hdr.writeInt32LE(ap_type,      0); // type
    hdr.writeInt32LE(0,            4); // drain
    hdr.writeInt32LE(0,            8); // ticks
    hdr.writeInt32LE(s.length+4+1,12); // cbData (inc trailing NUL)
    hdr.writeInt32LE(0,           16); // seqNo
    hdr.writeInt32LE(0,           20); // dummy
    hdr.writeInt32LE(0,           24); // dummy2
    return Buffer.concat([hdr,new Buffer(s),new Buffer('\0')]);
};

var rcveFE3 = function(s) {	// >> [<jsx>,...]   assumes it gets entire  FE3 frames (maybe more than 1)
    var ans = [];
    do {
	var hdr = new Buffer(s);
	assert.equal(hdr.readInt32LE(0),AP_XML2);
	var cb = hdr.readInt32LE(12)
	ans.push(x2j.parse(s.substr(24,cb-1)));
	s = s.substr(24+cb);
    } while (s!=='');
    return ans;
};

var mkServer = function(opts,fixture) { // full server with prevalence layer
    var srvr =  require('../../../malaya.js').createServer(_.extend({
	prevalenceDir: path.join(temp.mkdirSync(),'prevalence'),
	audit:         true,
	logging:       false,
	init:          true,
	tag:           'idb-test',
	businessLogic: path.join(__dirname,'../bl.chrjs'),
	sync_journal:  'none'
    },opts));
    srvr.start();
    srvr._private.bl._private.bl.reset();
    for (var i in fixture)
	srvr._private.bl._private.bl.add(fixture[i]); // add fact directly to store, bypassing context append
    return srvr;
};

function logOnOffServerTest(srvr) {
    var  out = null;
    var  ans = srvr.command(['logon',{user:"John Kozak",pw:"JK"}],{port:'test:',
								   write:function(js){out=js;} });
    assert.equal(ans.adds.length,2);            // one nett addition and _output
    assert.equal(ans.dels.length,1);            // one nett deletion

    var add0 = ans.refs[ans.adds[0]];
    var add1 = ans.refs[ans.adds[1]];
    var del0 = ans.refs[ans.dels[0]];
    
    assert.equal(add0[0],'Permissions'); // both of Permissions records
    assert.equal(del0[0],'Permissions');
    assert.equal(add0[1].LoggedOn,1);
    assert.equal(del0[1].LoggedOn,0);
    assert.equal(add0[1].ApplicationID,51); // appId 51 is JK
    assert.equal(del0[1].ApplicationID,51);
    assert.deepEqual(_.keys(out),['logon']);
    assert.deepEqual(out.logon.OK,1);
    out = null;
    ans = srvr.command(['logoff',{appId:51}],{port:'test:',
					      write:function(js){out=js;} });
    assert.equal(ans.adds.length,1);            // one nett addition
    assert.equal(ans.dels.length,1);            // one nett deletion

    var add0 = ans.refs[ans.adds[0]];
    var del0 = ans.refs[ans.dels[0]];

    assert.equal(add0[0],'Permissions'); // both of Permissions records
    assert.equal(del0[0],'Permissions');
    assert.equal(add0[1].LoggedOn,0);
    assert.equal(del0[1].LoggedOn,1);
    assert.equal(add0[1].ApplicationID,51); // appId 51 is JK
    assert.equal(del0[1].ApplicationID,51);
    assert.equal(out,null);
}

describe("server",function() {
    var prevalenceDir = path.join(temp.mkdirSync(),'prevalence');
    var          test = function(opts) {
	var srvr = mkServer(opts,USERS);
	try {
 	    logOnOffServerTest(srvr);
	} finally {
	    srvr.close();
	}
    };
    it("inits nicely and performs a simple logon and logoff",function() {
	test({init:true,prevalenceDir:prevalenceDir});
    });
    it("loads nicely and performs a simple logon and logoff",function() {
	test({init:false,prevalenceDir:prevalenceDir});
    });
    it("reloads nicely and performs a simple logon and logoff",function() {
	test({init:false,prevalenceDir:prevalenceDir});
    });
});

function mkSock(id) {
    var sock = new events.EventEmitter();
    sock.buf          = '';
    sock.remoteAccess = 'testie';
    sock.remotePort   = id||1234;
    sock.end          = function(){throw new Error('NYI');};
    sock.write        = function(x){sock.buf+=x;};
    return sock;
}

function logOnOffFE3ConnectionTest(srvr) {
    var sock = mkSock();
    var fe3c = new fe3._private.FE3Connection(sock,srvr);
    var  buf = '';
    sock.write = function(x){buf+=x;};
    
    sock.emit('data',mkFE3("<logon user='John Kozak' pw='JK'/>"));
    var jsxs = rcveFE3(buf);
    assert.equal(jsxs.length,1);
    assert.deepEqual(Object.keys(jsxs[0]),['logon']);
    assert.strictEqual(jsxs[0].logon.OK,"1");

    buf = '';
    sock.emit('data',mkFE3("<start/>"));
    jsxs = rcveFE3(buf);
    assert.equal(jsxs.length,3);
    assert.deepEqual(Object.keys(jsxs[0]),['static-data']);
    assert.deepEqual(Object.keys(jsxs[1]),['contexts']);
    assert.deepEqual(Object.keys(jsxs[2]),['initialised']);
}

function logOnOffMultipleFE3ConnectionTest(srvr) {
    var sock1 = mkSock(1);
    var fe3c1 = new fe3._private.FE3Connection(sock1,srvr);
    var sock2 = mkSock(2);
    var fe3c2 = new fe3._private.FE3Connection(sock2,srvr);
    
    sock1.emit('data',mkFE3("<logon user='John Kozak' pw='JK'/>"));
    sock2.emit('data',mkFE3("<logon user='Floy Murazik' pw='241tykxKcB_n6fR'/>"));

    var jsxs1 = rcveFE3(sock1.buf);
    assert.equal(jsxs1.length,1);
    assert.deepEqual(Object.keys(jsxs1[0]),['logon']);
    assert.strictEqual(jsxs1[0].logon.OK,"1");
    sock1.buf = '';

    var jsxs2 = rcveFE3(sock2.buf);
    assert.equal(jsxs2.length,1);
    assert.deepEqual(Object.keys(jsxs2[0]),['logon']);
    assert.strictEqual(jsxs2[0].logon.OK,"1");
    sock2.buf = '';

    sock1.emit('data',mkFE3("<start/>"));
    jsxs1 = rcveFE3(sock1.buf);
    assert.equal(jsxs1.length,3);
    assert(JSON.stringify(jsxs1).indexOf('Kozak')!==-1); // lazy!
    assert(JSON.stringify(jsxs1).indexOf('Murazik')===-1);
    assert.deepEqual(Object.keys(jsxs1[0]),['static-data']);
    assert.deepEqual(Object.keys(jsxs1[1]),['contexts']);
    assert.deepEqual(Object.keys(jsxs1[2]),['initialised']);

    sock2.emit('data',mkFE3("<start/>"));
    jsxs2 = rcveFE3(sock2.buf);
    assert.equal(jsxs2.length,3);
    assert.deepEqual(Object.keys(jsxs2[0]),['static-data']);
    assert(JSON.stringify(jsxs2).indexOf('Kozak')===-1);
    assert(JSON.stringify(jsxs2).indexOf('Murazik')!==-1);
    assert.deepEqual(Object.keys(jsxs2[1]),['contexts']);
    assert.deepEqual(Object.keys(jsxs2[2]),['initialised']);
}

describe("FE3Connection",function() {
    var prevalenceDir = path.join(temp.mkdirSync(),'prevalence');
    var          test = function(opts) {
	var srvr = mkServer(opts,USERS);
	try {
	    logOnOffFE3ConnectionTest(srvr);
	} finally {
	    srvr.close();
	}
    };
    it("inits nicely and performs a simple logon and logoff",function() {
	test({init:true,prevalenceDir:prevalenceDir});
    });
    it("loads nicely and performs a simple logon and logoff",function() {
	test({init:false,prevalenceDir:prevalenceDir});
    });
    it("reloads nicely and performs a simple logon and logoff",function() {
	test({init:false,prevalenceDir:prevalenceDir});
    });
});

describe("multiple connection",function() {
    var prevalenceDir = path.join(temp.mkdirSync(),'prevalence');
    var          test = function(opts) {
	var srvr = mkServer(opts,USERS);
	try {
	    logOnOffMultipleFE3ConnectionTest(srvr);
	} finally {
	    srvr.close();
	}
    };
    it("inits nicely and performs a brace of logons and logoffs",function() {
	test({init:true,prevalenceDir:prevalenceDir});
    });
    it("loads nicely and performs a brace of logons and logoffs",function() {
	test({init:false,prevalenceDir:prevalenceDir});
    });
    it("reloads nicely and performs a brace of logons and logoffs",function() {
	test({init:false,prevalenceDir:prevalenceDir});
    });
});

describe("business logic queries",function() {
    it("should return cookie appropriately",function() {
	var users = _.clone(USERS);
	assert.equal(users[0][1].ApplicationName,"John Kozak");
	users[0][1].LoggedOn = 1;
	users[0][1].port     = 'test://JK/';
	var   IDB = mkIDB(users);
	IDB.add(['cookie',{id:'2'},{port:users[0][1].port}]);
	var ok = false;
	var  n = 0;
	_.values(IDB._private.facts).forEach(function(f) {
	    if (f[0]==='_output') {
		n++;
		if (_.isEqual(f[2].cookie._children,['eikooC'])) 
		    ok = true;
	    }
	});
	assert.equal(n,1);
	assert(ok);
    });
    it("should return error for non-existent cookie",function() {
	var users = _.clone(USERS);
	assert.equal(users[0][1].ApplicationName,"John Kozak");
	users[0][1].LoggedOn = 1;
	users[0][1].port     = 'test://JK/';
	var   IDB = mkIDB(users);
	IDB.add(['cookie',{id:'0'},{port:users[0][1].port}]);
	var ok = false;
	var  n = 0;
	_.values(IDB._private.facts).forEach(function(f) {
	    if (f[0]==='_output') {
		n++;
		if (f[2].cookie.error==="not found") 
		    ok = true;
	    }
	});
	assert.equal(n,1);
	assert(ok);
    });
    // it("should return static data for user",function() {
    // 	var fixture = _.clone(USERS).concat(INSTRUMENTS);
    // 	assert.equal(fixture[0][1].ApplicationName,"John Kozak");
    // 	fixture[0][1].LoggedOn = 1;
    // 	fixture[0][1].port     = 'test://JK/';
    // 	var   IDB = mkIDB(fixture);
    // 	IDB.add(['start',{},{port:fixture[0][1].port}]);
    // 	console.log("*** %j",IDB._private.facts);
    // });
});
