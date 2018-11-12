// some bits of nodejs library semantics are underdocumented, (or underunderstood-by-me)
// I'm writing tests to describe what I think should happen in these cases,
// and they will show in the future if those assumptions were unsafe.

"use strict";

const     fs = require('fs');
const   path = require('path');
const   temp = require('temp').track();
const assert = require('assert');
const VError = require('verror');

describe("fs stream",function() {
    it("written data should be immediately available",function(done) {
        const     data = "line 1\n";
        const      dir = temp.mkdirSync();
        let        err = null;
        const filename = path.join(dir,'xxx');
        fs.writeFileSync(filename,data);
        const readable = fs.createReadStream(filename);
        readable.setEncoding('utf8');
        readable.on('readable',function() {
            try {
                const js = readable.read();
                if (js!==null)
                    assert.strictEqual(js,data);
            } catch (e) {err=e;}
        });
        readable.on('end',function(){done(err);});
    });
    it("writes and reads interleave",function(done) {
        const    data1 = "line 1\n";
        const    data2 = "line 2\n";
        const      dir = temp.mkdirSync();
        let        err = null;
        const filename = path.join(dir,'xxx');
        let          i = 0;
        fs.writeFileSync(filename,data1);
        const readable = fs.createReadStream(filename);
        readable.setEncoding('utf8');
        readable.on('readable',function() {
            try {
                const js = readable.read();
                if (js!==null)
                    switch (i++) {
                    case 0:
                        assert.strictEqual(js,data1);
                        fs.writeFileSync(filename,data2);
                        break;
                    case 1:
                        assert.strictEqual(js,data2);
                    break;
                    default:
                        throw new VError('NYI: %j',i);
                    }
            } catch (e) {err=e;}
        });
        readable.on('end',function(){done(err);});
    });
});
