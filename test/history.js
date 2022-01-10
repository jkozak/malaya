"use strict";

const history = require("../history.js");

const fs      = require("fs");
const hash    = require("../hash.js");
const temp    = require("temp").track();
const path    = require("path");
const util    = require("../util.js");
const assert  = require('assert').strict;
const whiskey = require("../whiskey.js");

function mkTempPrevDir() {
    const prevDir = temp.mkdirSync();
    fs.mkdirSync(path.join(prevDir,'state'));
    hash(util.hashAlgorithm).init(path.join(prevDir,'hashes'));
    return prevDir;
}

function mkJournal(jss) {
    return jss.map(js=>util.serialise(js)+'\n').join('');
}

describe("history",function() {
    const   prevDir = mkTempPrevDir();
    const hashStore = hash(util.hashAlgorithm).makeStore(path.join(prevDir,'hashes'));
    const    hashes = [];
    let       index;
    before(()=>{                // create some hashes
        hashes.push(hashStore.putSync(mkJournal([[1,'init',{}]])));
        hashes.push(hashStore.putSync(mkJournal([[2,'previous',hashes.slice(-1)[0],'']])));
        hashes.push(hashStore.putSync(mkJournal([[3,'previous',hashes.slice(-1)[0],'']])));
    });
    it("builds an index",function(){
        index = history.getIndex(prevDir,{fix:true});
    });
    it("index contains an entry for each hash",function(){
        assert.deepEqual(hashes.slice().sort(),
                         Object.keys(index.contents).sort() );
    });
    it("index back-links hashes",function(){
        assert.equal(index.contents[hashes[0]].prev,null);
        assert.equal(index.contents[hashes[1]].prev,hashes[0]);
        assert.equal(index.contents[hashes[2]].prev,hashes[1]);
    });
    it("index fore-links hashes",function(){
        assert.deepEqual(index.contents[hashes[0]].next,[hashes[1]]);
        assert.deepEqual(index.contents[hashes[1]].next,[hashes[2]]);
        assert.deepEqual(index.contents[hashes[2]].next,[]);
    });
    it("index tags places in chain",function(){
        assert.equal(index.contents[hashes[0]].init,true);
        assert.equal(index.contents[hashes[0]].term,false);
        assert.equal(index.contents[hashes[0]].last,false);
        assert.equal(index.contents[hashes[1]].init,false);
        assert.equal(index.contents[hashes[1]].term,false);
        assert.equal(index.contents[hashes[1]].last,false);
        assert.equal(index.contents[hashes[2]].init,false);
        assert.equal(index.contents[hashes[2]].term,false);
        assert.equal(index.contents[hashes[2]].last,true);
    });
    it("indexes embedded file times",function(){
        assert.deepEqual(index.contents[hashes[0]].when,[1,1]);
        assert.deepEqual(index.contents[hashes[1]].when,[2,2]);
        assert.deepEqual(index.contents[hashes[2]].when,[3,3]);
    });
    it("adds another hash",function(){
        hashes.push(hashStore.putSync(mkJournal([
            [4,'previous',hashes.slice(-1)[0],''],
            [5,'term',{}]
        ])));
    });
    it("detects index staleness",function(){
        assert.throws(()=>{
            index = history.getIndex(prevDir);
        });
    });
    it("rebuilds index",function(){
        index = history.getIndex(prevDir,{fix:true});
    });
    it("index back-links updated",function(){
        assert.equal(index.contents[hashes[3]].prev,hashes[2]);
    });
    it("index fore-links updated",function(){
        assert.deepEqual(index.contents[hashes[2]].next,[hashes[3]]);
    });
    it("index tags updated",function(){
        assert.equal(index.contents[hashes[2]].last,false);
        assert.equal(index.contents[hashes[3]].init,false);
        assert.equal(index.contents[hashes[3]].term,true);
        assert.equal(index.contents[hashes[3]].last,true);
    });
    it("index embedded file times updated",function(){
        assert.deepEqual(index.contents[hashes[3]].when,[4,5]);
    });
    it("chains journals starting from end",function(done){
        history.journalChain(prevDir,hashes[3],(err,hs)=>{
            if (err)
                done(err)
            else {
                assert.deepEqual(hs,[hashes[0],hashes[1],hashes[2],hashes[3]]);
                done();
            }
        });
    });
    it("chains journals starting from penultimate",function(done){
        history.journalChain(prevDir,hashes[2],(err,hs)=>{
            if (err)
                done(err)
            else {
                assert.deepEqual(hs,[hashes[0],hashes[1],hashes[2]]);
                done();
            }
        });
    });
    it("finds hash by prefix",function(){
        const target = 2;
        const prefix = hashes[target].slice(0,10);
        for (let i=0;i<hashes.length;i++) {
            if (i!==target)
                if (hashes[i].startsWith(prefix)) {
                    console.log(`hash prefix collision really shouldn't happen`);
                    return;
                }
        }
        assert.equal(history.findHashByPrefix(prevDir,prefix),hashes[target]);
    });
    it("finds hash by date",function(){
        const target = 1;
        const      t = hashes[target][0];
        assert.equal(history.findHash(prevDir,t),hashes[target]);
    });
    it("finds hash generically but by prefix",function(){
        const target = 3;
        const prefix = hashes[target].slice(0,10);
        for (let i=0;i<hashes.length;i++) {
            if (i!==target)
                if (hashes[i].startsWith(prefix)) {
                    console.log(`hash prefix collision really shouldn't happen`);
                    return;
                }
        }
        assert.equal(history.findHash(prevDir,prefix),hashes[target]);
    });
    it("finds hash generically but by date",function(){
        const target = 2;
        const      t = hashes[target][0];
        assert.equal(history.findHash(prevDir,t),hashes[target]);
    });
    it("finds run generically but by date",function(){
        const target = 2;
        const      t = hashes[target][0];
        assert.equal(history.findRun(prevDir,t),hashes.slice(-1)[0]);
    });
    it("finds run generically but by prefix",function(){
        const target = 2;
        const prefix = hashes[target].slice(0,10);
        assert.equal(history.findRun(prevDir,prefix),hashes.slice(-1)[0]);
    });
    it("accesses history via a readable stream",function(done){
        history.buildHistoryStream(prevDir,hashes[3],(err,rs)=>{
            if (err)
                done(err);
            else {
                const objs = [];
                rs.pipe(whiskey.LineStream(util.deserialise))
                    .on('data',js=>objs.push(js))
                    .on('end',()=>{
                        assert.deepEqual(objs,[
                            [1,'init',{}],
                            [2,'previous',hashes[0],''],
                            [3,'previous',hashes[1],''],
                            [4,'previous',hashes[2],''],
                            [5,'term',{}]
                        ]);
                        done();
                    })
                    .on('error',done);
            }
        });
    });
});
