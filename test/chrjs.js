var   chrjs = require("../chrjs.js");

var  assert = require("assert");
var    temp = require('temp');
var    util = require('../util.js');
var    path = require('path');
var      fs = require('fs');
var  pretty = require('prettyjson');

temp.track();

describe('chrjs parser',function() {
     it("should parse map",function() {
 	 var x = chrjs._private.parse("store { {a:[],c:22};};");
 	 //console.log(util.format("*** macro expands to: %j",x));
     });
     it("should parse list",function() {
 	 var x = chrjs._private.parse("store { ['X',19,{a:1}];};");
 	 //console.log(util.format("*** macro expands to: %j",x));
     });
     it("should parse rule",function() {
 	 var x = chrjs._private.parse("store { rule ( +['A',a,...r1],a==100,{B:a,C,...r2}); };");
 	 //console.log(util.format("\n*** macro expands to: %j",x));
     });
     it("should parse named store",function() {
 	 var x = chrjs._private.parse("store fred { rule ( +['A',a,...r1],a==100,b=10,{B:a,...r2}); };");
 	 //console.log(util.format("\n*** macro expands to: %j",x));
     });
     it("should parse query",function() {
 	 var x = chrjs._private.parse("store fred { query q(;['A',x];a) 0:a+x; };");
 	 //console.log(util.format("\n*** macro expands to: %j",x));
     });
     it("should parse snap",function() {
 	 var x = chrjs._private.parse("store fred { rule (['A',x],+['B',10*snap(['C',x];a) 0:a+x] ); };");
 	 //console.log(util.format("\n*** macro expands to: \n"+pretty.render(x,{noColor:true})));
     });
     it("should reject chrjs extensions outside store",function() {
	 assert.throws(function() {
 	     chrjs._private.parse("snap(['C',x];a) 0:a+x;");
	 });
	 assert.throws(function() {
 	     chrjs._private.parse("rule(['C',x]);");
	 });
	 assert.throws(function() {
 	     chrjs._private.parse("var x = [...rs];");
	 });
	 assert.throws(function() {
 	     chrjs._private.parse("var x = {...rs};");
	 });
	 assert.throws(function() {
 	     chrjs._private.parse("var x = {s};");
	 });
     });
});
