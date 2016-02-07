// pid-style locking

"use strict";

const      _ = require('underscore');
const   temp = require('temp').track();
const   path = require('path');
const     fs = require('fs');
const     os = require('os');
const VError = require('verror');

const   util = require('./util.js');

let process_ = process;
let      os_ = os;

exports.lockSync = function(filename,data) {
    const tmp = temp.openSync({dir:path.dirname(filename)});

    data = _.extend({},data||{},{pid:      process_.pid,
                                 startTime:Date.now()-process.uptime()*1000 });

    fs.writeSync(tmp.fd,JSON.stringify(data),null,null,null);
    fs.closeSync(tmp.fd);
    for (let i=0;i<2;i++)
        try {
            fs.linkSync(tmp.path,filename);     // if locked, fails here
            return true;
        } catch (e) {
            const pid = exports.pidLockedSync(filename);
            if (pid===process_.pid)
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
    let data;
    try {
        data = JSON.parse(fs.readFileSync(filename));
    } catch (e) {
        if (e.code!=='ENOENT')
            throw new VError(e,"can't read or parse lockfile %s",filename);
        return null;
    }
    const systemStartTime = Date.now()-os_.uptime()*1000;
    if (data.startTime<systemStartTime) // process can't be older than the system
        return null;
    try {
        process_.kill(data.pid,0);
        return data;
    } catch (e) {
        return null;
    }
};

exports.pidLockedSync = function(filename) {
    const data = exports.lockDataSync(filename);
    return data===null ? null : data.pid;
};

exports.unlockSync = function(filename) {
    const data = exports.lockDataSync(filename);
    if (data===null)
        throw new VError("lockfile %s does not exist",filename);
    if (data.pid!==process_.pid)
        throw new VError("lockfile %s locked by process %d",filename,data.pid);
    fs.unlinkSync(filename);
};

if (util.env==='test')
    exports._private = {
        setProcess:   function(p) {process_=p;},
        resetProcess: function(p) {process_=process;},
        setOs:        function(o) {os_=o;},
        resetOs:      function(o) {os_=os;}
    };
