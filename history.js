"use strict";

// analysing &c the histories in the hash store

const          fs = require('fs');
const        path = require('path');
const        hash = require('./hash.js');
const        util = require('./util.js');
const MultiStream = require('multistream');

const makeHashes = exports.makeHashes = prevalenceDir=>
      hash(util.hashAlgorithm).makeStore(path.join(prevalenceDir,'hashes'));

const walkJournalFile = exports.walkJournalFile = (filename,deepCheck,cb,done)=>{
    let i = 0;
    util.readFileLinesSync(filename,line=>{
        const js = util.deserialise(line);
        if (i++===0) {
            switch (js[1]) {
            case 'init':
                break;
            case 'previous':
                cb(null,js[2],"journal");
                break;
            default:
                cb(new Error(`bad log file hash: ${hash}`));
            }
        } else if (deepCheck) {
            switch (js[1]) {
            case 'code':
                if (js[2][2][js[2][1]]) // hash from the bl src code filename
                    cb(null,js[2][2][js[2][1]],'bl',js[2][1]);
                for (const k in js[2][2])
                    cb(null,js[2][2][k],"source code",k);
                break;
            case 'transform':
                if (js[2][2][js[2][1]]) // hash from the transform src code filename
                    cb(null,js[2][2][js[2][1]],'transform',js[2][1]);
                for (const k in js[2][2])
                    cb(null,js[2][2][k],"source code",k);
                break;
            case 'http':
                cb(null,js[2][1],"http");
                break;
            }
        }
        return deepCheck; // only read whole file if checking `code` items
    });
    if (done!==undefined)
        done();
};

exports.walkHashes = (hashes,hash0,deepCheck,cb,done)=>{
    // the structure of the hash store is a linear chain of journal files with
    // other items hanging off them to a depth of one.  A recursive transversal
    // is not needed to scan this exhaustively.
    for (let h=hash0;h;) {
        const fn = hashes.makeFilename(h);
        /* eslint no-loop-func:0 */
        cb(null,h,"journal");
        h = null;
        walkJournalFile(fn,deepCheck,(err,hash1,what)=>{
            if (err)
                cb(new Error(`walkJournalFile fails: ${h}`));
            else if (what==='journal') {
                if (h!==null)
                    cb(new Error(`multiple journal backlinks in: ${hash1}`));
                else
                    h = hash1;
            }
        });
    }
    if (done!==undefined)
        done();
};

function hashChainPrev(prevDir,h0) {
    // chains hashes back from this one, reverse chronological order (latest->earliest)
    const index = getIndex(prevDir);
    const chain = [];
    for (let h=h0;h;h=index.contents[h].prev)
        chain.push(h);
    return chain;
}

const journalChain = exports.journalChain = (prevalenceDir,hash0,cb)=>{
    // delivers list of journal files in chronological order (earliest->latest)
    // chains back from hash0 if present else live journal
    const live = !hash0 || hash0==='journal';
    let    ans;
    if (live) {
        const j = indexFile(path.join(prevalenceDir,'state','journal'));
        ans = ['journal',...hashChainPrev(prevalenceDir,j.prev)];
    } else
        ans = hashChainPrev(prevalenceDir,hash0);
    ans.reverse();
    cb(null,ans);
};

exports.buildHistoryStream = (prevalenceDir,hash0,cb)=>{
    const hashes = makeHashes(prevalenceDir);
    journalChain(prevalenceDir,
                 hash0,
                 (err,hs)=>{
                     if (err) throw cb(err);
                     cb(null,new MultiStream(hs.map(h=>{
                         if (h==='journal')
                             return fs.createReadStream(path.join(prevalenceDir,'state','journal'));
                         else
                             return fs.createReadStream(hashes.makeFilename(h));
                     })));
                 });
};

function totalStoreHash(prevDir) {
    const hashes = hash('sha1').makeStore(path.join(prevDir,'hashes'));
    // +++ eslint doesn't understand BigInt literals yet, should be 0n below +++
    return hashes.getHashes().reduce((a,h)=>a^BigInt('0x'+h),BigInt(0)).toString(16);
}

function indexFile(filename) {
    const    data = fs.readFileSync(filename,'utf8');
    const   lines = data.split('\n').filter(l=>l.length>0);
    const     nth = i=>util.deserialise(lines.slice(i)[0])
    return {
        type: 'journal',
        init: nth( 0)[1]==='init',
        term: nth(-1)[1]==='term',
        prev: nth( 0)[1]==='previous' ? nth(0)[2] : null,
        next: [],
        last: nth(-1)[1]==='term' || undefined,
        when: [nth(0)[0],nth(-1)[0]]
    }
}

const buildIndex = (prevDir)=>{
    const   hashes = hash('sha1').makeStore(path.join(prevDir,'hashes'));
    const contents = {};        // hash -> {type,init:BOOL,term:BOOL,prev:HASH,last:BOOL}
    const     runs = [];        // [hash,...]
    hashes.getHashes().forEach(h=>{
        try {
            contents[h] = indexFile(hashes.makeFilename(h));
        } catch (e) {
            //console.log(`!!! assuming blob:${h} ${e}`);
            contents[h] = {type:'blob'};
        }
    });
    Object.keys(contents).forEach(h=>{
        const j = contents[h];
        if (j.type==='journal' && j.prev)
            contents[j.prev].next.push(h);
    });
    Object.keys(contents).forEach(h=>{
        const j = contents[h];
        if (j.type==='journal')
            j.last = j.next.length===0;
    });
    Object.keys(contents).forEach(h=>{
        const j = contents[h];
        if (j.type==='journal' && j.last) {
            const run = [];
            for (let h1=h;h1;h1=contents[h1].prev)
                run.push(h1);
            runs.push(run);
        }
    });
    const index = {
        contents,
        runs,
        hash: totalStoreHash(prevDir)
    };
    fs.writeFileSync(path.join(prevDir,'index.json'),JSON.stringify(index));
    return index;
};

const getIndex = exports.getIndex = (prevDir,opts)=>{
    opts = opts || {fix:true};
    try {
        const index = JSON.parse(fs.readFileSync(path.join(prevDir,'index.json'),'utf8'));
        if (index.hash!==totalStoreHash(prevDir))
            throw new Error(`hash store index stale`);
        return index;
    } catch (e) {
        if (opts.fix)
            return buildIndex(prevDir);
        else
            throw e;
    }
};

exports.addToIndex = (prevDir,h)=>{
    throw new Error(`NYI - incrementally add new hash to index`);
};

const findRunContainingHash = (prevDir,h)=>{
    const index = getIndex(prevDir);
    const    hs = [];
    index.runs.forEach(r=>{
        r.forEach(h1=>{
            if (h1===h)
                hs.push(r[0]);
        });
    });
    if (hs.length===1)
        return hs[0];
    else if (hs.length>1)
        throw new Error(`${h} ambiguous, matches: ${hs}`);
};

const findHashByPrefix = exports.findHashByPrefix = (prevDir,r)=>{
    const index = getIndex(prevDir);
    const    hs = [];
    Object.keys(index.contents).forEach(h=>{
        if (h.startsWith(r))
            hs.push(h);
    });
    if (hs.length===1)
        return hs[0];
    else if (hs.length>1)
        throw new Error(`${r} ambiguous, matches: ${hs}`);
    else
        throw new Error(`not found: ${r}`);
};

const findHashByDate = exports.findHashByDate = (prevDir,r)=>{
    const index = getIndex(prevDir);
    const     t = new Date(r);
    const    hs = [];
    Object.keys(index.contents).forEach(h=>{
        const when = index.contents[h].when;
        if (when && (when[0]<=t && t<when[1]))
            hs.push(h);
    });
    if (hs.length===1)
        return hs[0];
    else if (hs.length>1)
        throw new Error(`${r} ambiguous, matches: ${hs}`);
};


const findHash = exports.findHash = (prevDir,r)=>{
    if (r.match(/^[0-9a-z]+$/))
        return findHashByPrefix(prevDir,r);
    else if (r.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}t[0-9]{2}:[0-9]{2}:[0-9]{2}z/))
        return findHashByDate(prevDir,r);
    else if (r instanceof Date)
        return findHashByDate(prevDir,r);
    else if ((typeof r)==='number')
        return findHashByDate(prevDir,r);
    else
        throw new Error(`don't know how to find run ${r}`);
};

exports.findRun = (prevDir,r)=>{
    return findRunContainingHash(prevDir,findHash(prevDir,r));
};

if (require.main===module) {
    const index = getIndex(process.cwd(),{fix:true});
    Object.keys(index.contents).forEach(h=>{
        console.log(`${h} ${JSON.stringify(index.contents[h])}`);
    });
    index.runs.sort((p,q)=>index.contents[p[0]].when[0]-index.contents[q[0]].when[0]);
    index.runs.forEach(r=>{
        const start = new Date(index.contents[r.slice(-1)[0]].when[0])
        const  stop = new Date(index.contents[r.slice( 0)[0]].when[1])
        console.log(`${r[0]} ${r.length.toString().padStart(2)} ${start.toLocaleString('en-GB')} ${(stop-start)/3600000}`);
    });
    console.log(`hash: ${index.hash}`);
}
