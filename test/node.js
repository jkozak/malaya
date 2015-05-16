// some bits of nodejs library semantics are underdocumented, (or underunderstood-by-me)
// I'm writing tests to describe what I think should happen in these cases,
// and they will show in the future if those assumptions were unsafe.

var     fs = require('fs');
var   path = require('path');
var   temp = require('temp').track();
var assert = require('assert');
var VError = require('verror');

describe("fs stream",function() {
    it("written data should be immediately available",function(done) {
        var     data = "line 1\n";
        var      dir = temp.mkdirSync();
        var      err = null;
        var filename = path.join(dir,'xxx');
        fs.writeFileSync(filename,data);
        var readable = fs.createReadStream(filename);
        readable.setEncoding('utf8');
        readable.on('readable',function() {
            try {
                assert.strictEqual(readable.read(),data);
            } catch (e) {err=e;}
        });
        readable.on('end',function(){done(err);});
    });
    it("writes and reads interleave",function(done) {
        var    data1 = "line 1\n";
        var    data2 = "line 2\n";
        var      dir = temp.mkdirSync();
        var      err = null;
        var filename = path.join(dir,'xxx');
        var        i = 0;
        fs.writeFileSync(filename,data1);
        var readable = fs.createReadStream(filename);
        readable.setEncoding('utf8');
        readable.on('readable',function() {
            try {
                switch (i++) {
                case 0:
                    assert.strictEqual(readable.read(),data1);
                    fs.writeFile(filename,data2);
                    break;
                case 1:
                    assert.strictEqual(readable.read(),data2);
                    break;
                default:
                    throw new VError('NYI: %j',i);
                }
            } catch (e) {err=e;}
        });
        readable.on('end',function(){done(err);});
    });
});
