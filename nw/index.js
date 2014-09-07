"use strict";

// +++ sensible startup page, including:                        +++
// +++ check if prevalence dir exists, offer create page if not +++

var     fs = require('fs');
var   path = require('path');
var   util = require('util');
var malaya = require("malaya");
var server;

// +++ configure init and start buttons +++

$(document).ready(function() {
    var state = 'stopped';	// 'starting','started','stopping'
    var  opts = {};
    opts.prevalenceDir = path.resolve(process.cwd(),'.prevalence');
    opts.fe3Port       = 5110
    opts.port          = 3000;
    opts.bl            = fs.realpathSync('node_modules/malaya/bl.chrjs');
    opts.init          = false;
    opts.audit         = true;
    opts.webDir        = fs.realpathSync('node_modules/malaya/www');
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
		server.close();
		break;
	    case 'stopped':
		state = 'starting';
		server = malaya.createServer(opts);
		server.on('loaded',function(hash) {
		    $('#narrHash').text("opening hash");
		    $('#textHash').text(hash);
		    state = 'started';
		});
		server.run();
		server.on('ready',function() {
		    $('#bigButton').css('background','#c60000');
		    // +++ set hover as well +++
		    $('#bigButton').text('STOP');
		});
		break;
	    }
	},0);
    });
});
