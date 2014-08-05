"use strict";

var crypto = require('crypto');
var stream = require('stream');
var fs     = require('fs');
var util   = require('util');

module.exports = function(algorithm) {
    var ans = {
	init: function(dirname) {
	    try {		// if dirname doesn't exist, create it
		var st = fs.statSync(dirname);
		// +++ check it's a directory +++
		// +++ delete any staging files therein +++
	    } catch (err) {
		// +++ check `err` is "file not found" +++
		try {
		    fs.mkdirSync(dirname);
		} catch (err1) {
		    throw new Error("can't find or open a hashstore at: "+JSON.stringify(dirname));
		}
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
			util.debug("adding new hash to store: "+h);
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
		sanityCheck:function() {
		    for (var k in store.getHashes()) {
			if (ans.hash(store.getSync(k))!==k)
			    throw new Error("broken hash: "+k);
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
