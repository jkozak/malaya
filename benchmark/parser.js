"use strict";

const parser = require("../parser.js");

suite('parser',function() {
    set('iterations',10);
    bench("tiny program",function () {
	const prog = "store { ['abc',17,18];rule (-['abc',...rest])}";
	parser.parse(prog);
    });
});
