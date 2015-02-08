"use strict";

// +++ sensible startup page, including:                        +++
// +++ check if prevalence dir exists, offer create page if not +++

var        _ = require('underscore');
var       fs = require('fs');
var     path = require('path');
var     util = require('util');
var compiler = require('../../compiler.js');

// +++ configure init and start buttons +++

function brighten(elem,amount) {
    var m = elem.css('background-color').match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    var p = [0,0,0];
    for (var i=0;i<3;i++) 
        p[i] = Math.round(parseInt(m[i+1])*amount);
    elem.css('background-color',"rgb("+p[0]+","+p[1]+","+p[2]+')');
}

$(document).ready(function() {	// 'control' panel
    var  state = 'stopped';	// 'starting','started','stopping'
    var   opts = {};
    var cFacts = 0;
    var cConns = 0;
    var    dir = fs.realpathSync('../idb');	// +++ should be selected in the GUI
    var  build = require(path.join(dir,'setup.js'));
    var server;
    opts.fe3Port       = 5110
    opts.port          = 3000;
    opts.prevalenceDir = path.join(dir,'.prevalence');
    opts.businessLogic = path.join(dir,'bl.chrjs');
    opts.tag           = 'idb';
    opts.init          = false;
    opts.audit         = true;
    opts.webDir        = fs.realpathSync('.');
    opts.debug         = true;
    opts.onCompile     = function(filename) {initStanzas(filename);};
    $('#title').text(util.format("malaya.%s control panel",opts.tag))
    // set parameter table
    $('#paramPort').text(opts.port);
    $('#paramBL')  .text(opts.businessLogic);
    $('#paramPrvD').text(opts.prevalenceDir);
    for (var k in build.extraOpts) {
	var xo = build.extraOpts[k];
	$('#parameters tr:first').before(util.format("<tr><td>%s</td><td><code><span id='#xparam%s'>%s</span></code></td></tr>",xo[0],k,xo[1]));
    }
    // +++ get from above +++
    if (!(fs.existsSync(opts.prevalenceDir)))
	throw new Error("NYI - init");
    $('#bigButton').hover(function() {brighten($(this),1.2)},
			  function() {brighten($(this),0.83333)} );
    $('#bigButton').click(function() {
	$('#bigButton').css('backgroundColor','rgb(198,198,198)');
	$('#bigButton').text('');
	setTimeout(function() {
	    switch (state) {
	    case 'started':
		state = 'stopping';
		server.close();
		break;
	    case 'stopped':
		state  = 'starting';
		server = build.build(opts);
		process.on('SIGHUP',function() {server.save();});
		server.fe3.on('listening',function() {
		    cFacts = server.size;
		    $('#varNF').text(cFacts);
		    $('#varNC').text(cConns);
		    server.on('makeConnection',function() {$('#varNC').text(++cConns);});
		    server.on('loseConnection',function() {$('#varNC').text(--cConns);});
		    server.ready();
		});
		server.on('loaded',function(hash) {
		    // !!! this is now called too late to do anything !!!
		    $('#varHash').text(hash);
		});
		server.on('ready',function() {
		    $('#bigButton').css('background','rgb(254,0,0)');
		    $('#bigButton').text('STOP');
		    state = 'started';
		});
		server.on('closed',function(hash) {
		    $('#varHash').text(hash);
		    $('#bigButton').css('background','rgb(0,254,0)');
		    $('#bigButton').text('START');
		    state = 'stopped';
		});
		server.on('fire',function(obj,fact,adds,dels) {
		    cFacts += adds.length;
		    cFacts -= dels.length;
		    $('#varNF').text(cFacts);
		});
		server.on('queue-rule',function(ruleName,bindings) {
		    updateCodeDraw(ruleName);
		});
		server.on('query-done',function(queryName) {
		    updateCodeDraw(queryName);
		});
		server.on('add',function(t) {
		    addFact(t);
		});
		server.on('del',function(t) {
		    delFact(t);
		});
		server.run();
		break;
	    }
	},0);
    });
});

