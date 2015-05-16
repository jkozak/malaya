var   lock = require('../lock.js');

var     fs = require('fs');
var   temp = require('temp').track();
var   path = require('path');
var assert = require('assert');


describe("basic locking",function() {
    it("manages a lock file",function() {
        var lk = path.join(temp.mkdirSync(),'lock');
        assert(!fs.existsSync(lk));
        lock.lockSync(lk,{abc:123});
        assert(fs.existsSync(lk));
        lock.unlockSync(lk);
        assert(!fs.existsSync(lk));
    });
    it("acquires and releases a lock",function() {
        var lk = path.join(temp.mkdirSync(),'lock');
        lock.lockSync(lk);
        lock.unlockSync(lk);
    });
    it("acquires and releases a lock twice",function() {
        var lk = path.join(temp.mkdirSync(),'lock');
        lock.lockSync(lk);
        lock.unlockSync(lk);
        lock.lockSync(lk);
        lock.unlockSync(lk);
    });
    it("lets a process can acquire a lock twice",function() {
        var lk = path.join(temp.mkdirSync(),'lock');
        lock.lockSync(lk);
        lock.lockSync(lk);
        lock.unlockSync(lk);
    });
    it("returns true iff lock acquired",function() {
        var lk = path.join(temp.mkdirSync(),'lock');
        assert.strictEqual(lock.lockSync(lk),true);
        assert.strictEqual(lock.lockSync(lk),false);
        assert.strictEqual(lock.lockSync(lk),false);
        lock.unlockSync(lk);
    });
    it("puts useful guff in lock file",function() {
        var lk = path.join(temp.mkdirSync(),'lock');
        lock.lockSync(lk,{abc:123});
        assert.strictEqual(lock.lockDataSync(lk).abc,123);
        assert.strictEqual(lock.lockDataSync(lk).pid,process.pid);
        assert.strictEqual(lock.pidLockedSync(lk),   process.pid);
    });
});

describe("multiprocess locking",function() {
    var killer = function(pid,sig) {
        assert.strictEqual(sig,0);              // only one handled
        if ([1234,5678].indexOf(pid)===-1)      // 1234 and 5678 are mocked to appear to be running
            throw new Error("no such bogus process");
    };
    var   proc = {
        pid:  null,
        kill: killer
    };
        
    before(function() {
        lock._private.setProcess(proc);
    });
    after(function() {
        lock._private.resetProcess();
    });
    it("does not allow a lock to be shared by multiple processes",function() {
        var lk = path.join(temp.mkdirSync(),'lock');
        proc.pid  = 1234;
        lock.lockSync(lk);
        proc.pid = 5678;
        assert.throws(function() {
            lock.lockSync(lk);
        });
        assert.strictEqual(lock.pidLockedSync(lk),1234);
    });
    it("requires an unlock to be from the issuing process",function() {
        var lk = path.join(temp.mkdirSync(),'lock');
        proc.pid  = 1234;
        lock.lockSync(lk);
        proc.pid = 5678;
        assert.throws(function() {
            lock.unlockSync(lk);
        });
        assert.strictEqual(lock.pidLockedSync(lk),1234);
        proc.pid  = 1234;
        lock.unlockSync(lk);
    });
    it("cleans up stale lockfiles",function() {
        var lk = path.join(temp.mkdirSync(),'lock');
        proc.pid  = 9;
        lock.lockSync(lk);
        assert.strictEqual(lock.lockDataSync(lk),null);
        proc.pid  = 1234;
        assert.strictEqual(lock.lockSync(lk),true);
        assert.strictEqual(lock.pidLockedSync(lk),1234);
    });
    it("allows a lock to be serially acquired by multiple processes",function() {
        var lk = path.join(temp.mkdirSync(),'lock');
        proc.pid = 1234;
        lock.lockSync(lk);
        proc.pid = 5678;
        assert.throws(function() {
            lock.lockSync(lk);
        });
        proc.pid = 1234;
        lock.unlockSync(lk);
        proc.pid = 5678;
        lock.lockSync(lk);
        proc.pid = 1234;
        assert.throws(function() {
            lock.lockSync(lk);
        });
    });
});
