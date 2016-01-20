"use strict";

// !!! these tests used the deprecated node-jsx; as we're not
// !!! currently using that forget trying to fix them but rewrite
// !!! after converting to jsx's babel.

var     jsdom = require('jsdom');
var     React = require('react/addons');
var TestUtils = React.addons.TestUtils;

require('node-jsx').install();

var    assert = require('assert');
var        fs = require('fs');
var      path = require('path');
var      util = require('malaya').util;

describe("www",function() {
    describe("index",function() {
    });
    describe("auction",function() {
    });
});
