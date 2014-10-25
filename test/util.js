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

describe('serialise',function() {
    var date = new Date(0);
    it("should encode bare dates nicely",function() {
    	assert(util.deserialise(util.serialise(date)) instanceof Date);
    });
    it("should encode dates in arrays nicely",function() {
    	assert(util.deserialise(util.serialise([date]))[0] instanceof Date);
    });
    it("should encode dates in objects nicely",function() {
    	assert(util.deserialise(util.serialise({d:date})).d instanceof Date);
    });
});
