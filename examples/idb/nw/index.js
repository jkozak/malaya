"use strict";

// +++ sensible startup page, including:                        +++
// +++ check if prevalence dir exists, offer create page if not +++

var      _ = require('underscore');
var     fs = require('fs');
var   path = require('path');
var   util = require('util');
var malaya = require("malaya");
var server;
var    fe3;

// +++ configure init and start buttons +++

$(document).ready(function() {
    var  state = 'stopped';	// 'starting','started','stopping'
    var   opts = {};
    var cFacts = 0;
    opts.prevalenceDir = fs.realpathSync('../.prevalence');
    opts.fe3Port       = 5110
    opts.port          = 3000;
    opts.tag           = 'idb';
    opts.businessLogic = fs.realpathSync('../bl.chrjs');
    opts.init          = false;
    opts.audit         = true;
    opts.webDir        = fs.realpathSync('www');
    opts.auto_output   = true;
    // set parameter table
    $('#paramPort').text(opts.port);
    $('#paramFE3P').text(opts.fe3Port);
    $('#paramBL')  .text(opts.bl);
    $('#paramPrvD').text(opts.prevalenceDir);
    // +++ get from above +++
    if (!(fs.existsSync(opts.prevalenceDir)))
	opts.init = true;
    $('#bigButton').click(function() {
	$('#bigButton').css('backgroundColor','#c6c6c6');
	$('#bigButton').text('');
	setTimeout(function() {
	    switch (state) {
	    case 'started':
		state = 'stopping';
		server.on('closed',function(hash) {
		    $('#narrHash').text("closing hash");
		    $('#textHash').text(hash);
		    $('#bigButton').css('background','#00c600');
		    // +++ set hover as well +++
		    $('#bigButton').text('START');
		    state = 'stopped';
		});
		fe3.close();
		server.close();
		break;
	    case 'stopped':
		state  = 'starting';
		server = malaya.createServer(opts);
		fe3    = require('../fe3.js').createServer({malaya:server});
		fe3.on('connect',function(mc) {
		    server.addConnection(mc);
		});
		fe3.on('listening',function() {
		    console.log('fe3  listening on *:'+opts.fe3Port);
		    cFacts = server.size;
		    $('#paramNF').text(cFacts);
		    server.ready();
		});
		server.on('loaded',function(hash) {
		    $('#narrHash').text("opening hash");
		    $('#textHash').text(hash);
		    server.command(['restart',{}],{port:'server:'});
		    server.listen(opts.port,function() {
			fe3.listen(opts.fe3Port);
		    });
		    state = 'started';
		});
		server.on('ready',function() {
		    $('#bigButton').css('background','#c60000');
		    // +++ set hover as well +++
		    $('#bigButton').text('STOP');
		});
		server.start();
		server.on('fire',function(obj,fact,adds,dels) {
		    cFacts += adds.length;
		    cFacts -= dels.length;
		    $('#paramNF').text(cFacts);
		});
		break;
	    }
	},0);
    });
});
