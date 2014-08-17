var sweet = require("sweet.js");
var chrjs = require("../chrjs.js");

var assert = require("assert");
var   temp = require('temp');
var   util = require('../util.js');
var   path = require('path');
var     fs = require('fs');

temp.track();

describe('chrjs parser',function() {
    it("should parse trivial script",function() {
	chrjs._private.compile("store { when ( x ) 1;};");
    });
});
