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
		putFileSync: function(filename) {
		    return store.putSync(fs.readFileSync(filename));
		},
		putSync: function(x) {
		    var h  = ans.hash(x);
		    var fn = store.makeFilename(h);
		    if (!fs.existsSync(fn)) {
			util.debug("adding new hash to store: %s",h);
			fs.writeFileSync(fn,x);
		    }
		    return h;
		},
		getSync: function(h) {
		    return fs.readFileSync(store.makeFilename(h));
		},
		getHashes:function() {
		    return fs.readdirSync(dirname);
		},
		sanityCheck:function(hash) {
		    var hashes = store.getHashes();
		    for (var k in hashes) { // check all hashes are sound
			var h = hashes[k];
			if (ans.hash(store.getSync(h))!==h)
			    throw new Error("broken hash: "+h);
		    }
		    while (hash) {          // ensure there is a full history for this hash 
			util.readFileLinesSync(dirname+'/'+hash,function(line) {
			    var js = util.deserialise(line);
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
			    // +++ if super-paranoid check hashes in 'logic' items +++
			    return false; // only read first line
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
