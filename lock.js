// pid-style locking

"use strict";

var      _ = require('underscore');
var   temp = require('temp').track();
var   path = require('path');
var     fs = require('fs');
var VError = require('verror');

var   util = require('./util.js');

exports.lockSync = function(filename,data) { 
    var tmp = temp.openSync({dir:path.dirname(filename)});

    data = _.extend({},data||{},{pid:process.pid});
    
    fs.writeSync(tmp.fd,JSON.stringify(data),null,null,null);
    for (var i=0;i<2;i++) 
        try {
            fs.linkSync(tmp.path,filename);     // if locked, fails here
            return true;
        } catch (e) {
            var pid = exports.pidLockedSync(filename);
            if (pid===process.pid)
                return false;
            else if (pid===null) {
                try {
                    util.info("removing stale lockfile %s",filename);
                    fs.unlinkSync(filename);
                    continue;
                } catch (e1) {
                    throw new VError(e,"lockfile %s is stale but can't be removed",filename);
                }
            }
            throw new VError(e,"lockfile %s is held by process %d",filename,pid);
        }
    throw new VError("failed to acquire lockfile %s",filename);
};

exports.lockDataSync = function(filename) {
    var data;
    try {
        data = JSON.parse(fs.readFileSync(filename));
    } catch (e) {
        if (e.code!=='ENOENT')
            throw new VError(e,"can't read or parse lockfile %s",filename);
        return null;
    }
    try {
        process.kill(data.pid,0);
        return data;
    } catch (e) {
        return null;
    }
};

exports.pidLockedSync = function(filename) {
    var data = exports.lockDataSync(filename);
    return data===null ? null : data.pid;
};

exports.unlockSync = function(filename) {
    var pid = exports.pidLockedSync(filename);
    if (pid!==process.pid)
        throw new VError("lockfile %s locked by process %d",filename,pid);
    fs.unlinkSync(filename);
};
