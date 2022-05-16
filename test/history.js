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

describe("history XXX",function() {
    const   prevDir = mkTempPrevDir();
    const hashStore = hash(util.hashAlgorithm).makeStore(path.join(prevDir,'hashes'));
    const journalFn = path.join(prevDir,'state','journal');
    const    hashes = [];
    let       index;
    before(()=>{                // create some hashes
        hashes.push(hashStore.putSync(mkJournal([[10,'init',{}]])));
        hashes.push(hashStore.putSync(mkJournal([[20,'previous',hashes.slice(-1)[0],''],
                                                 [21,'update',['x',{}]] ])));
        hashes.push(hashStore.putSync(mkJournal([[30,'previous',hashes.slice(-1)[0],'']])));
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
        assert.deepEqual(index.contents[hashes[0]].when,[10,10]);
        assert.deepEqual(index.contents[hashes[1]].when,[20,21]);
        assert.deepEqual(index.contents[hashes[2]].when,[30,30]);
    });
    it("adds another hash",function(){
        hashes.push(hashStore.putSync(mkJournal([
            [40,'previous',hashes.slice(-1)[0],''],
            [50,'term',{}]
        ])));
    });
    it("detects index staleness",function(){
        assert.throws(()=>{
            index = history.getIndex(prevDir,{fix:false});
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
        assert.deepEqual(index.contents[hashes[3]].when,[40,50]);
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
    it("finds hash by date explicitly",function(){
        assert.equal(history.findHashByDate(prevDir,new Date(10)),hashes[0]);
    });
    it("finds hash by date",function(){
        assert.equal(history.findHash(prevDir,new Date(10)),hashes[0]);
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
    it("finds hash generically but by unwrapped date",function(){
        assert.equal(history.findHash(prevDir,10),hashes[0]);
    });
    it("finds hash generically but by date - 1",function(){
        assert.equal(history.findHash(prevDir,new Date(10)),hashes[0]);
    });
    it("finds hash generically but by date - 2",function(){
        assert.equal(history.findHash(prevDir,new Date(20)),hashes[1]);
    });
    it("finds hash generically but by date - 3",function(){
        assert.equal(history.findHash(prevDir,new Date(21)),hashes[1]);
    });
    it("finds hash generically but by date - 4",function(){
        assert.equal(history.findHash(prevDir,new Date(30)),hashes[2]);
    });
    it("finds run generically but by date",function(){
        assert.equal(history.findRun(prevDir,new Date(30)),hashes.slice(-1)[0]);
    });
    it("finds run generically but by prefix",function(){
        const target = 2;
        const prefix = hashes[target].slice(0,10);
        assert.equal(history.findRun(prevDir,prefix),hashes.slice(-1)[0]);
    });
    it("accesses history via buildHistoryStream",function(done){
        history.buildHistoryStream(prevDir,hashes[3],(err,rs)=>{
            if (err)
                done(err);
            else {
                const objs = [];
                rs.pipe(whiskey.LineStream(util.deserialise))
                    .on('data',js=>objs.push(js))
                    .on('end',()=>{
                        assert.deepEqual(objs,[
                            [10,'init',{}],
                            [20,'previous',hashes[0],''],
                            [21,'update',  ['x',{}]],
                            [30,'previous',hashes[1],''],
                            [40,'previous',hashes[2],''],
                            [50,'term',{}]
                        ]);
                        done();
                    })
                    .on('error',done);
            }
        });
    });
    it("accesses history via buildRunStream and hash",function(done){
        history.buildRunStream(prevDir,hashes[0],(err,rs)=>{
            if (err)
                done(err);
            else {
                const objs = [];
                rs
                    .on('data',js=>objs.push(js))
                    .on('end',()=>{
                        assert.deepEqual(objs,[
                            [10,'init',{}],
                        ]);
                        done();
                    })
                    .on('error',done);
            }
        });
    });
    it("accesses history via buildRunStream and date/time",function(done){
        history.buildRunStream(prevDir,30,(err,rs)=>{
            if (err)
                done(err);
            else {
                const objs = [];
                rs
                    .on('data',js=>objs.push(js))
                    .on('end',()=>{
                        assert.deepEqual(objs,[
                            [10,'init',{}],
                            [20,'previous',hashes[0],''],
                            [21,'update',  ['x',{}]],
                        ]);
                        done();
                    })
                    .on('error',done);
            }
        });
    });
    it("accesses history via buildRunStream and date/time, splitting file",function(done){
        history.buildRunStream(prevDir,20.5,(err,rs)=>{
            if (err)
                done(err);
            else {
                const objs = [];
                rs
                    .on('data',js=>objs.push(js))
                    .on('end',()=>{
                        assert.deepEqual(objs,[
                            [10,'init',{}],
                            [20,'previous',hashes[0],''],
                        ]);
                        done();
                    })
                    .on('error',done);
            }
        });
    });
    it("buildRunStream and date/time handle events before the world gracefully",function(done){
        history.buildRunStream(prevDir,5,(err,rs)=>{
            if (err)
                done(err);
            else {
                const objs = [];
                rs
                    .on('data',js=>objs.push(js))
                    .on('end',()=>{
                        assert.deepEqual(objs,[]);
                        done();
                    })
                    .on('error',done);
            }
        });
    });
    it("creates another, disjoint, run ending in live journal",function(){
        assert.equal(hashes.length,4);
        hashes.push(hashStore.putSync(mkJournal([[110,'init',{}]])));
        hashes.push(hashStore.putSync(mkJournal([[120,'previous',hashes.slice(-1)[0],''],
                                                 [121,'update',['x',{}]] ])));
        hashes.push(hashStore.putSync(mkJournal([[130,'previous',hashes.slice(-1)[0],'']])));
        fs.writeFileSync(journalFn,mkJournal([[150,'previous',hashes.slice(-1)[0],''],
                                              [160,'update',['x',{}]] ]));
    });
    it("finds hash in journal by date/time",function(){
        assert.equal(history.findHashByDate(prevDir,150),'journal')
    });
    it("builds history of run including journal - 1",function(done){
        history.buildRunStream(prevDir,150.1,(err,rs)=>{
            if (err)
                done(err);
            else {
                const objs = [];
                rs
                    .on('data',js=>objs.push(js))
                    .on('end',()=>{
                        assert.deepEqual(objs,[
                            [110,'init',{}],
                            [120,'previous',hashes[4],''],
                            [121,'update',['x',{}]],
                            [130,'previous',hashes[5],''],
                            [150,'previous',hashes[6],'']
                        ]);
                        done();
                    })
                    .on('error',done);
            }
        });
    });
    it("builds history of run including journal - 2",function(done){
        history.buildRunStream(prevDir,155,(err,rs)=>{
            if (err)
                done(err);
            else {
                const objs = [];
                rs
                    .on('data',js=>objs.push(js))
                    .on('end',()=>{
                        assert.deepEqual(objs,[
                            [110,'init',{}],
                            [120,'previous',hashes[4],''],
                            [121,'update',['x',{}]],
                            [130,'previous',hashes[5],''],
                            [150,'previous',hashes[6],'']
                        ]);
                        done();
                    })
                    .on('error',done);
            }
        });
    });
    it("builds history of run including journal - 3",function(done){
        history.buildRunStream(prevDir,new Date(161),(err,rs)=>{
            if (err)
                done(err);
            else {
                const objs = [];
                rs
                    .on('data',js=>objs.push(js))
                    .on('end',()=>{
                        assert.deepEqual(objs,[
                            [110,'init',{}],
                            [120,'previous',hashes[4],''],
                            [121,'update',['x',{}]],
                            [130,'previous',hashes[5],''],
                            [150,'previous',hashes[6],''],
                            [160,'update',['x',{}]]
                        ]);
                        done();
                    })
                    .on('error',done);
            }
        });
    });
    it("builds history of run including journal - 4",function(done){
        history.buildRunStream(prevDir,new Date(160),(err,rs)=>{
            if (err)
                done(err);
            else {
                const objs = [];
                rs
                    .on('data',js=>objs.push(js))
                    .on('end',()=>{
                        assert.deepEqual(objs,[
                            [110,'init',{}],
                            [120,'previous',hashes[4],''],
                            [121,'update',['x',{}]],
                            [130,'previous',hashes[5],''],
                            [150,'previous',hashes[6],''],
                        ]);
                        done();
                    })
                    .on('error',done);
            }
        });
    });
    it("builds unfiltered history of current incarnation including journal",function(done){
        history.buildRunStream(prevDir,null,(err,rs)=>{
            if (err)
                done(err);
            else {
                const objs = [];
                rs
                    .on('data',js=>objs.push(js))
                    .on('end',()=>{
                        assert.deepEqual(objs,[
                            [110,'init',{}],
                            [120,'previous',hashes[4],''],
                            [121,'update',['x',{}]],
                            [130,'previous',hashes[5],''],
                            [150,'previous',hashes[6],''],
                            [160,'update',['x',{}]]
                        ]);
                        done();
                    })
                    .on('error',done);
            }
        });
    });
});
