var sweet = require("sweet.js");
var chrjs = require("../chrjs.js");

var assert = require("assert");
var   temp = require('temp');
var   util = require('../util.js');
var   path = require('path');
var     fs = require('fs');

temp.track();

describe('chrjs parser',function() {
    it("should parse map",function() {
	var x = chrjs._private.compile("store { {a:[],c:22};};");
	//console.log(util.format("*** macro expands to: %j",x));
    });
    it("should parse list",function() {
	var x = chrjs._private.compile("store { ['X',19,{a:1}];};");
	//console.log(util.format("*** macro expands to: %j",x));
    });
    it("should parse rule",function() {
	var x = chrjs._private.compile("store { rule { +['A',a,...r1];(a==100);{B:a,...r2}} };");
	//console.log(util.format("\n*** macro expands to: %j",x));
    });
});
