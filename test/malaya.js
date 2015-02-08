var malaya = require("../malaya.js");

var      _ = require('underscore');
var assert = require('assert');
var   temp = require('temp');
var   path = require('path');

temp.track();			// auto-cleanup at exit

var mkServer = function(opts) {
    var srvr =  malaya.createServer(_.extend({
	prevalenceDir: path.join(temp.mkdirSync(),'prevalence'),
	audit:         true,
	logging:       false,
	init:          true,
	tag:           'malaya-test',
	sync_journal:  'none'
    },opts));
    srvr.start();
    return srvr;
};

