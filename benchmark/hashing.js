"use strict";

const           fs = require('fs');
const         path = require('path');
const         temp = require('temp').track();
const       crypto = require('crypto');
const digestStream = require('digest-stream');
const       assert = require('assert').strict;

const         util = require('../util.js');

const         hAlg = util.hashAlgorithm;

if (true) {
    const   tdir = temp.mkdirSync();
    const cLines = 10000;
    const   line = "Specimen line of text - it's great!  Really, it is. Everyone knows it.  True dat,  And so on\n";

    suite("on-the-fly hashing performance overhead",function() {
        bench("pure sync write",function() {
            const fd = fs.openSync(path.join(tdir,'a'),'w');
            for (let i=0;i<cLines;i++)
                fs.writeSync(fd,line);
            fs.closeSync(fd);
        });
        bench("pure sync hashing",function() {
            const h = crypto.createHash(hAlg);
            for (let i=0;i<cLines;i++)
                h.update(line);
            h.digest('hex');
        });
        bench("streams, rudely",function(done) {
            const wstr = fs.createWriteStream(path.join(tdir,'b'));
            for (let i=0;i<cLines;i++)
                wstr.write(line);
            wstr.end(done);
        });
        bench("streams, doucement",function(done) {
            const wstr = fs.createWriteStream(path.join(tdir,'c'));
            const doIt = n=>{
                if (n>0) {
                    wstr.write(line);
                    setImmediate(()=>doIt(n-1));
                } else {
                    wstr.end(done);
                }
            };
            doIt(cLines);
        });
        bench("streams, rudely, with hashing",function(done) {
            const wstr = fs.createWriteStream(path.join(tdir,'d'));
            const hstr = digestStream(hAlg,'hex',()=>{});
            hstr.pipe(wstr);
            hstr.on('close',()=>wstr.end());
            wstr.on('close',done);
            for (let i=0;i<cLines;i++)
                hstr.write(line);
            hstr.end();
        });
        bench("streams, doucement, with hashing",function(done) {
            const wstr = fs.createWriteStream(path.join(tdir,'e'));
            const hstr = digestStream(hAlg,'hex',()=>{});
            hstr.pipe(wstr);
            hstr.on('close',()=>wstr.end());
            wstr.on('close',done);
            const doIt = n=>{
                if (n>0) {
                    hstr.write(line);
                    setImmediate(()=>doIt(n-1));
                } else {
                    hstr.end();
                }
            };
            doIt(cLines);
        });
        after(()=>{             // check outputs are the same
            const chkFile = (p,q)=>
                  assert.strictEqual(fs.readFileSync(path.join(tdir,p),'utf8'),fs.readFileSync(path.join(tdir,q),'utf8'));
            chkFile('a','b');
            chkFile('a','c');
            chkFile('a','d');
            chkFile('a','e');
        });
    });

}
