"use strict";

var crypto = require('crypto');
var stream = require('stream');
var fs     = require('fs');
var util   = require('./util.js');

module.exports = function(algorithm) {
    var ans = {
	init: function(dirname) {
	    try {		// if dirname doesn't exist, create it
		var st = fs.statSync(dirname);
		if (!st.isDirectory())
		    throw new Error(util.format("hash store %j exists and is not a directory",dirname));
	    } catch (err) {
		if (err.code==='ENOENT') {
		    try {
			fs.mkdirSync(dirname);
		    } catch (err1) {
			throw new Error(util.format("can't find or open a hashstore at: %j",dirname));
		    }
		} else
		    throw err;
	    }
	},
	make_store: function(dirname) {
	    ans.init(dirname);
	    var store = {
		makeFilename: function(h) {
		    return dirname+'/'+h;
		},
		contains: function(h) {
		    return fs.existsSync(store.makeFilename(h));
		},
		putFileSync: function(filename) {
		    return store.putSync(fs.readFileSync(filename));
		},
		putSync: function(x) {
		    var        h = ans.hash(x);
		    var filename = store.makeFilename(h);
		    if (!fs.existsSync(filename)) {
			util.debug("adding new hash to store: %s",h);
			fs.writeFileSync(filename,x);
		    }
		    return h;
		},
		getSync: function(h) {
		    return fs.readFileSync(store.makeFilename(h));
		},
		getHashes:function() {
		    return fs.readdirSync(dirname);
		},
		sanityCheck:function(options) {
		    var hashes = store.getHashes();
		    for (var k in hashes) { // check all hashes are sound
			var h = hashes[k];
			if (ans.hash(store.getSync(h))!==h)
			    throw new Error("broken hash: "+h);
		    }
		    var hash = options.hash;
		    while (hash) {          // ensure there is a full history for this hash
			var i = 0;
			util.readFileLinesSync(store.makeFilename(hash),function(line) {
			    var js = util.deserialise(line);
			    if (i++===0) {
				switch (js[1]) {
				case 'init':
				    hash = null;
				    break;
				case 'previous':
				    hash = js[2];
				    break;
				default:
				    throw new Error(util.format("bad log file hash: %s",hash));
				}
			    } else if (options.code) {
				if (js[1]==='code') {
				    for (var k in js[2][2]) {
					if (!store.contains(js[2][2][k]))
					    throw new Error("can't find source code for %s",k);
				    }
				}
			    }
			    return options.code; // only read whole file if checking `code` items
			});
		    }
		}
	    };
	    return store;
	},
	make_hasher: function() {
	    return crypto.createHash(algorithm);
	},
	hash: function(x) {
	    var hasher = ans.make_hasher();
	    hasher.write(x);
	    return hasher.digest('hex');
	}
    };
    return ans;
};
