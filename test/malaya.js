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

describe("auto_output",function() {
    it("should not invoke write automagically if not so bidden",function(){
	var srvr =  mkServer({
	    businessLogic: path.join(__dirname,'bl/output.chrjs'),
	});
	var output = null;
	var    ans = srvr.command(['do_summat',{}],{port:'test:',
						    write:function(js){output=js;} });
	assert.deepEqual(output,null);
	assert.deepEqual(_.values(srvr._private.facts),
			 [['_output','self',{msg:"will this do?"}]] );
	srvr.close();
    });
    it("should invoke write automagically if so bidden",function(){
	var srvr =  mkServer({
	    businessLogic: path.join(__dirname,'bl/output.chrjs'),
	    auto_output:   true
	});
	var output = null;
	var    ans = srvr.command(['do_summat',{}],{port:'test:',
						    write:function(js){output=js;} });
	assert.deepEqual(output,{msg:"will this do?"});
	assert.deepEqual(srvr._private.facts,[]);
	srvr.close();
    });
});
