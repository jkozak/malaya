var    x2j = require('../x2j.js');
var xml2js = require('xml2js');	// +++ use this for a second opinion +++
var assert = require('assert');
var   util = require('../../../util.js');

function roundTrip(js) {
    return x2j.parse(x2j.build(js));
}

describe("parse",function() {
    var jsx;
    it("should parse simplest XML",function() {
	jsx = x2j.parse("<fred/>");
	assert.deepEqual(jsx,{fred:{}});
    });
    it("should parse nested XML",function() {
	jsx = x2j.parse("<fred a='2'>text <jim><sally/><sarah/></jim></fred>");
	assert.deepEqual(Object.keys(jsx),['fred']);
    });
    it("should parse children",function() {
	jsx = x2j.parse("<static-data><self ID=\"51\" Name=\"John Kozak\" Role=\"1283\"/></static-data>");
	assert.deepEqual(jsx,{'static-data':{_children:[{self:{ID:'51',Name:'John Kozak',Role:'1283'}}]}});
    });
});

describe("build",function() {
    it("should build embedded text",function() {
	assert.equal(x2j.build({a:{_children:['spqr']}}),"<a>spqr</a>");
    });
    it("should build node children",function() {
	assert.equal(x2j.build({a:{_children:[{spqr:{}}]}}),"<a><spqr/></a>");
    });
    it("should handle raw XML hack",function() {
	assert.equal(x2j.build({a:{_children:[{_XML:'<spqr/>'}]}}),"<a><spqr/></a>");
    });
    it("should use single <> encoding",function() {
	assert.equal(x2j.build({a:{}}),"<a/>");
    });
    it("should use canonical encoding for boolean true",function() {
	assert.equal(x2j.build({a:{b:true}}),"<a b=\"1\"/>");
    });
    it("should use canonical encoding for boolean false",function() {
	assert.equal(x2j.build({a:{b:false}}),"<a b=\"0\"/>");
    });
    it("should use canonical encoding for null",function() {
	assert.equal(x2j.build({a:{b:null}}),"<a b=\"\"/>");
    });
});

describe("roundTrip",function() {
    var tests = [{node:{}},
		 {node:{_children:['a ',{one:{}},' b']}},
		 {node:{p:'a',q:'b'}}
		 ];
    for (var i in tests) {
	(function(i) {
	    it(util.format("should round-trip %j",tests[i]),function() {
		roundTrip(tests[i]);
	    });
	})(i);
    }
});
