var    fe3 = require('../fe3.js');

var    x2j = require('../x2j.js');
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

var FIXTURE = [
    ["Permissions",{"UserName":"Anon.","TotalFailCount":0,"RegionID":1,"TelExtn":null,"DirtyFlag":0,"TeamID":100,"UpdateDate":"Fri Jul 25 17:49:33 2014","NewFEFlag":1,"TelNo":"7777 7777                     ","ApplicationID":51,"Email":"Unknown","Deleted":0,"MatchingVolEntry":"B","UpdateUserID":51,"SessionID":0,"Enabled":1,"AppRole":1283,"CurrFailCount":0,"LogOnTime":"Fri Jul 25 17:49:29 2014","CountryID":44,"CompanyID":100,"TelAreaCode":"20    ","TelCountryCode":"44","CSPID":1,"LoggedOn":0,"ApplicationName":"John Kozak","Password":"JK"}],
    ["Permissions",{"UserName":"Anon.","TotalFailCount":0,"RegionID":1,"TelExtn":null,"DirtyFlag":0,"TeamID":1,"UpdateDate":"Thu Dec  2 16:25:14 2004","NewFEFlag":1,"TelNo":"7777 7777                     ","ApplicationID":1,"Email":"Unknown","Deleted":0,"MatchingVolEntry":"B","UpdateUserID":1,"SessionID":76601,"Enabled":1,"AppRole":2,"CurrFailCount":0,"LoggedOn":0,"LogOnTime":"Wed Dec  1 14:54:11 2004","CountryID":44,"CompanyID":1,"TelAreaCode":"20    ","TelCountryCode":"44","CSPID":1,"ApplicationName":"Floy Murazik","Password":"241tykxKcB_n6fR","anon":true}]
];

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

var mkServer = function(opts) {
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
    for (var i in FIXTURE) 
	srvr.command(FIXTURE[i],{port:'test:'});
    return srvr;
};

function logOnOffServerTest(srvr) {
    var  ans = srvr.command(['logon',{user:"John Kozak",pw:"JK"}],{port:'test:'});
    assert.equal(ans.adds.length,1);            // one nett addition
    assert.equal(ans.adds.length,1);            // one nett deletion
    assert.equal(ans.adds[0][0],'Permissions'); // both of Permissions records
    assert.equal(ans.dels[0][0],'Permissions');
    assert.equal(ans.adds[0][1].LoggedOn,1);
    assert.equal(ans.dels[0][1].LoggedOn,0);
    assert.equal(ans.adds[0][1].ApplicationID,51); // appId 51 is JK
    assert.equal(ans.dels[0][1].ApplicationID,51);
    ans = srvr.command(['logoff',{appId:51}],{port:'test:'});
    assert.equal(ans.adds.length,1);            // one nett addition
    assert.equal(ans.adds.length,1);            // one nett deletion
    assert.equal(ans.adds[0][0],'Permissions'); // both of Permissions records
    assert.equal(ans.dels[0][0],'Permissions');
    assert.equal(ans.adds[0][1].LoggedOn,0);
    assert.equal(ans.dels[0][1].LoggedOn,1);
    assert.equal(ans.adds[0][1].ApplicationID,51); // appId 51 is JK
    assert.equal(ans.dels[0][1].ApplicationID,51);
}

describe("server",function() {
    var prevalenceDir = path.join(temp.mkdirSync(),'prevalence');
    it("inits nicely and performs a simple logon and logoff",function() {
	var srvr = mkServer({init:true,prevalenceDir:prevalenceDir});
	logOnOffServerTest(srvr);
	srvr.close();
    });
    it("loads nicely and performs a simple logon and logoff",function() {
	var srvr = mkServer({init:false,prevalenceDir:prevalenceDir});
	logOnOffServerTest(srvr);
	srvr.close();
    });
    it("reloads nicely and performs a simple logon and logoff",function() {
	var srvr = mkServer({init:false,prevalenceDir:prevalenceDir});
	logOnOffServerTest(srvr);
	srvr.close();
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
    it("inits nicely and performs a simple logon and logoff",function() {
	var srvr = mkServer({init:true,prevalenceDir:prevalenceDir});
	logOnOffFE3ConnectionTest(srvr);
	srvr.close();
    });
    it("loads nicely and performs a simple logon and logoff",function() {
	var srvr = mkServer({init:false,prevalenceDir:prevalenceDir});
	logOnOffFE3ConnectionTest(srvr);
	srvr.close();
    });
    it("reloads nicely and performs a simple logon and logoff",function() {
	var srvr = mkServer({init:false,prevalenceDir:prevalenceDir});
	logOnOffFE3ConnectionTest(srvr);
	srvr.close();
    });
});

describe("FE3Connection",function() {
    var prevalenceDir = path.join(temp.mkdirSync(),'prevalence');
    it("inits nicely and performs a brace of logons and logoffs",function() {
	var srvr = mkServer({init:true,prevalenceDir:prevalenceDir});
	logOnOffMultipleFE3ConnectionTest(srvr);
	srvr.close();
    });
    it("loads nicely and performs a brace of logons and logoffs",function() {
	var srvr = mkServer({init:false,prevalenceDir:prevalenceDir});
	logOnOffMultipleFE3ConnectionTest(srvr);
	srvr.close();
    });
    it("reloads nicely and performs a brace of logons and logoffs",function() {
	var srvr = mkServer({init:false,prevalenceDir:prevalenceDir});
	logOnOffMultipleFE3ConnectionTest(srvr);
	srvr.close();
    });
});
