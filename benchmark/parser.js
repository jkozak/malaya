"use strict";

var chrjs = require("../chrjs.js");

suite('parser',function() {
    set('iterations',10);
    bench("tiny program",function () {
	var prog = "store { ['abc',17,18];rule {-['abc',...rest]}}";
	chrjs._private.compile(prog);
    });
    bench("small program",function () {
	var prog = "store { ['abc',17,18];rule {-['abc',...rest];x;-x}};";
	for (var i=0;i<6;i++)
	    prog += prog;	// 64 times size of above
	chrjs._private.compile(prog);
    });
});

