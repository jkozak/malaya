var util   = require("../util.js");

var assert = require("assert");

describe('constants',function() {
    it("`env` will always be 'test' when testing",function() {
	assert.equal(util.env,"test");
    });
    it("`source_version` will be a string",function() {
	assert.equal(typeof util.source_version,'string');
    });
});


