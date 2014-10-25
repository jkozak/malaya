// pid-style locking

var temp = require('temp');
var path = require('path');
var   fs = require('fs');

temp.track();

exports.lockSync = function(filename,opts) {
    var tmp = temp.openSync({dir:path.dirname(filename)});
    fs.writeSync(tmp.fd,process.pid,null,null,null);
    for (var i=0;i<2;i++) {
	try {
	    fs.linkSync(tmp.path,filename);	// if locked, fails here
	    return;
	} catch (e) {
	    var pid = parseInt(fs.readFileSync(filename));
	    try {
		process.kill(pid,0);
	    } catch (e) {
		// +++ check e===ESRCH +++
		try {
		    console.log("removing stale lockfile %s created by process %s",filename,pid);
		    fs.unlinkSync(filename);
		    continue;
		} catch (e) {
		    throw new Error("lockfile is stale but can't be removed");
		}
	    }
	    throw new Error("lock "+filename+" is held by process "+pid);
	}
    }
    throw new Error("failed to acquire lock "+filename);
};

exports.unlockSync = function(filename,opts) {
    fs.unlinkSync(filename);
};
