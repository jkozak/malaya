"use strict";

var chrjs = require("../chrjs.js");

suite('parser',function() {
    set('iterations',10);
    bench("tiny program",function () {
	var prog = "store { ['abc',17,18];rule {-['abc',...rest]}}";
	chrjs._private.compile(prog);
    });
});

