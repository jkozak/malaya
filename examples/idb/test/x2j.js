var    x2j = require('../x2j.js');
var xml2js = require('xml2js');	// +++ use this for a second opinion +++
var assert = require('assert');
var   util = require('../../../util.js');

function roundTrip(js) {
    return x2j.parse(x2j.build(js));
}

describe("parse",function() {
    it("should parse simplest XML",function() {
	x2j.parse("<fred/>");
    });
    it("should parse nested XML",function() {
	x2j.parse("<fred a='2'>text <jim><sally/><sarah/></jim></fred>");
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
