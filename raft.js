// RAFT implementation

"use strict";

const        util = require('./util.js');
const      events = require('events');
const      VError = require('verror');
const      assert = require('assert');
const      SockJS = require('node-sockjs-client');
const      stream = require('stream');
const          ip = require('ip');
const          fs = require('fs');

const      engine = require('./engine.js');
const     whiskey = require('./whiskey.js');


const Peer = exports.Peer = function(raft) {
    const peer = this;
    peer.raft       = raft;
    peer.portName   = null;     // null iff outgoing, else as in engine
    peer.io         = null;     // as in engine
    peer.nextIndex  = null;     // only if leader
    peer.matchIndex = null;     // only if leader
};

Peer.prototype.close = function(cb) {
    //const peer = this;
    // +++
    cb(new VError("NYI"));
};

Peer.prototype.forget = function(cb) {
    const peer = this;
    assert.strictEqual(peer.raft.peers[peer.name],undefined);
    cb(null);
};

const Raft = exports.Raft = function(eng) {
    const raft = this;
    raft.engine          = eng;
    raft.protocol        = 'http';        // || 'https'
    raft.wsSuffix        = '';
    raft.mode            = 'follower';    // || 'candidate' || 'leader'
    raft.id              = util.format("%s:%d",ip.address(),eng.options.ports.http);
    raft.peers           = {};            // peerName -> Peer
    raft.leader          = null;
    raft.currentTerm     = 0;             // persistent
    raft.votedFor        = null;          // persistent
    raft.votesWon        = new Set();     // a count when I am a candidate
    raft.commitIndex     = 0;
    raft.lastApplied     = 0;
    raft.leaderSeen      = false;
    raft.electionTimeout = null;
    raft.reconnInterval  = null;
    raft.timeouts        = {
        election:    [1500,3000], // !!! s/be [150,300] !!!
        connectRetry:5000,
        connectFail: 1000
    };
};

util.inherits(Raft,events.EventEmitter);

Raft.prototype.setTimeout = function(fn,t) {
    return setTimeout(fn,t);
};
Raft.prototype.clearTimeout = function(tOut) {
    return clearTimeout(tOut);
};
Raft.prototype.setInterval = function(fn,t) {
    return setInterval(fn,t);
};
Raft.prototype.clearInterval = function(tOut) {
    return clearInterval(tOut);
};

// The first object received over the link is of the form
// {type:'HELLO',id:<id>} - we generate, receive and handle the
// absence of them here.
Raft.prototype._installPeer = function(io,portName) {
    const   raft = this;
    const   addr = raft.engine.http.address();
    let peerName = null;
    const   tOut = raft.setTimeout(()=>{
        io.i.end();
    },raft.timeouts.connectFail);
    io.i.once('data',(js0)=>{
        console.log("*** reading 1: %j",js0);
        io.i.once('end',()=>{
            console.log("peer %s disconnected",peerName);
            raft.emit('cluster',raft.activeCount(),raft.clusterSize());
            if (peerName) {
                raft.peers[peerName].io       = null;
                raft.peers[peerName].portName = null;
            }
        });
        if (js0!==null && js0.type==='HELLO' && raft.peers[js0.id]) {
            peerName                      = js0.id;
            raft.peers[peerName].io       = io;
            raft.peers[peerName].portName = portName;
            raft.clearTimeout(tOut);
            console.log("peer %s connected",peerName);
            raft.emit('cluster',raft.activeCount(),raft.clusterSize());
            io.i.on('data',function(js) {
                console.log("*** reading 2..n: %j",js);
                if (js!==null)
                    raft.command(js,(err,ans)=>{ /* eslint no-loop-func:0 */
                        if (err) {
                            if (portName)
                                raft.engine.closeConnection(portName);
                            raft.peers[peerName].forget();
                        } else if (js.type!=='REPLY') {
                            io.o.write({type:   'REPLY',
                                        id:     peerName,
                                        from:   raft.id,
                                        call:   js.type,
                                        result: ans});
                        }
                    });
            });
        } else
            io.i.end();
    });
    io.o.write({type:'HELLO',id:util.format("%s:%d",addr.address,addr.port)});
};

Raft.prototype.broadcast = function(js) {
    const raft = this;
    // randomise order?
    Object.keys(raft.peers).forEach((p)=>{
        if (raft.peers[p].io)
            raft.peers[p].io.o.write(js);
    });
};

Raft.prototype.start = function() {
    const   raft = this;
    const reconn = ()=>{
        for (const k in raft.peers) {
            const p = raft.peers[k];
            if (p.io===null) {
                raft.connectToPeer(k,(e,io)=>{
                    if (!e && p.io===null)
                        raft._installPeer(io,null);
                });
            }
        }
    };
    for (const i in raft.engine.options.peers) {
        const p = raft.engine.options.peers[i];
        // +++ canonicalise `p` +++
        raft.peers[p] = new Peer(raft);
    }
    reconn();
    raft.reconnInterval = raft.setInterval(reconn,raft.timeouts.connectRetry);
    raft.become('follower');
    raft.setElectionTimeout();
    console.log("raft cluster with %d members",raft.clusterSize());
};

Raft.prototype.stop = function() {
    const raft = this;
    for (const k in raft.peers) {
        if (raft.peers[k].io)
            raft.peers[k].io.i.end();
    }
    raft.peers = {};
    if (raft.reconnInterval) {
        raft.clearInterval(raft.reconnInterval);
        raft.reconnInterval = null;
    }
};

Raft.prototype.connectToPeer = function(peerName,cb) {
    const raft = this;
    const  url = util.format("%s://%s/raft%s",raft.protocol,peerName,raft.wsSuffix);
    const sock = new SockJS(url);
    sock.onerror = (err)=>{
        console.log("!!! websock err: %j",err);
    };
    sock.onopen = ()=>{
        const io = {
            type: 'raft',
            i:    new stream.PassThrough({objectMode:true}),
            o:    new stream.PassThrough({objectMode:true})
        };
        sock.onmessage = (msg)=>{
            //console.log("*** SockJS.msg: %j",msg);
            io.i.write(JSON.parse(msg.data));
        };
        io.o.on('data',(js)=>{
            if (js!==null)
                sock.send(JSON.stringify(js)+'\n');
        });
        io.i.on('end',()=>{
            sock.close();
        });
        io.o.on('end',()=>{
            sock.close();
        });
        cb(null,io);
    };
    sock.onclose = ()=>{
        // +++
        if (raft.peers[peerName].io) {
            raft.peers[peerName].io.i.end();
            raft.peers[peerName].io.o.end();
            raft.peers[peerName].io = null;
        }
    };
};

Raft.prototype.startElection = function() {
    const raft = this;
    assert.strictEqual(raft.mode,'candidate');
    raft.currentTerm++;
    raft.voteFor = raft.id;
    raft.votesWon.add(raft.id);
    raft.persistState();        // !!! use cb !!!
    raft.setElectionTimeout();
    raft.broadcast({
        type:         'RequestVote',
        term:         raft.currentTerm,
        candidateId:  raft.id,
        lastLogIndex: raft.commitIndex,
        lastLogTerm:  raft.currentTerm
    });
};

Raft.prototype.stopElection = function(restart) {
    const raft = this;
    raft.voteFor  = null;
    raft.votesWon.clear();
    raft.persistState();        // !!!
};

Raft.prototype.become = function(mode) {
    const raft = this;
    const prev = raft.mode;
    assert(['follower','candidate','leader'].indexOf(mode)!==-1);
    if (mode==='leader')
        assert.strictEqual(raft.mode,'candidate');
    raft.mode = mode;
    if (prev!==mode)
        raft.emit('mode',mode);
};

Raft.prototype.clusterSize = function() {
    return Object.keys(this.peers).length+1; // +1 for me
};

Raft.prototype.activeCount = function() {
    const raft = this;
    let      n = 1;             // I am alive
    for (const p in raft.peers)
        if (raft.peers[p].io)
            n++;
    return n;
};

Raft.prototype.setElectionTimeout = function() {
    const  raft = this;
    const tOuts = raft.timeouts.election;
    if (raft.electionTimeout!==null)
        raft.clearTimeout(raft.electionTimeout);
    raft.leaderSeen      = false;
    raft.electionTimeout = raft.setTimeout(()=>{
        raft.electionTimeout = null;
        if (raft.mode==='follower' && !raft.leaderSeen) {
            raft.become('candidate');
            raft.startElection();
        } else if (raft.mode==='candidate') {
            if (raft.votesWon.size>raft.clusterSize()/2) {
                raft.become('leader');
            } else                                    // election over, no winner
                raft.become('candidate');
                raft.startElection();
        }
        else
            raft.setElectionTimeout();
    },tOuts[0]+Math.random()*(tOuts[1]-tOuts[0]));
};

Raft.prototype.getState = function() {
    const raft = this;
    return {currentTerm:raft.currentTerm,
            votedFor:   raft.votedFor};
};

Raft.prototype.persistState = function(cb) {
    const raft = this;
    raft.engine.journalise('raft',raft.getState(),cb);
};

Raft.prototype.command = function(js,cb) { // RAFT protocol command
    const raft = this;
    // msg format:   {type,id,...}
    // reply format: {type:'REPLY',id,result}
    if (raft.currentTerm<js.term) {
        raft.currentTerm = js.term;
        raft.votedFor    = null;
        raft.persistState();    // !!!
        raft.become('follower');
        raft.setElectionTimeout();
    }
    switch (js.type) {
    case 'AppendEntries':
        raft.leaderSeen = true;
        cb(new VError("NYI: raft AppendEntries"));
        break;
    case 'RequestVote':
        if (raft.votedFor===null || raft.votedFor===js.candidateId) {
            raft.leaderSeen = true;
            if (raft.currentTerm===js.lastLogTerm &&
                raft.commitIndex<=js.lastLogIndex) {
                raft.votedFor = js.candidateId;
                raft.persistState((e)=>{
                    if (e)
                        cb(e);
                    else {
                        raft.setElectionTimeout();
                        cb(null,{term:raft.currentTerm,voteGranted:true});
                    }
                });
            }
            else
                cb(null,{term:raft.currentTerm,voteGranted:false});
        } else
            cb(null,{term:raft.currentTerm,voteGranted:false});
        break;
    case 'InstallSnapshot':     // save the world
        cb(new VError("NYI RAFT msg type: %s"%js.type));
        break;
    case 'REPLY':
        if (js.call==='RequestVote') {
            if (js.result) {
                if (js.result.term>raft.currentTerm) {
                    raft.currentTerm = js.result.term;
                    raft.become('follower');
                    raft.stopElection();
                } else if (js.result.voteGranted) {
                    raft.votesWon.add(js.from);
                    if (raft.votesWon.size>raft.clusterSize()/2) {
                        raft.become('leader');
                        raft.stopElection();
                    }
                }
            }
            cb();
        } else
            cb(new VError("NYI RAFT msg type: %s %s",js.type,js.call));
        break;
    default:
        cb(new VError("unknown RAFT msg: %s",js));
        break;
    }
};

Raft.prototype.update  = function(js,cb) { // CHRJS
    const raft = this;
    const  eng = raft.engine;
    cb = cb || (()=>{});
    switch (eng.mode) {
    case 'leader':
        cb(new VError("NYI: raft update: %s",eng.mode));
        break;
    case 'follower':
        cb(new VError("NYI: raft update: %s",eng.mode));
        break;
    case 'candidate':
        cb(new VError("NYI: raft update: %s",eng.mode));
        break;
    default:
        cb(new VError("command in wrong mode: %s",eng.mode));
        break;
    }
};

const Engine = exports.Engine = function(options) {
    engine.Engine.call(this,options);

    const eng = this;
    eng.raft           = new Raft(eng);
    eng.connTypes.raft = {
        makeIO:        (conn,io)=>{
            io.type = 'raft';
            io.i    = new whiskey.JSONParseStream();
            io.o    = new whiskey.StringifyJSONStream();
        },
        connectionAdd: (portName,io)=>{
            eng.raft._installPeer(io,portName);
        }
    };
    eng.on('mode',(mode)=>{
        switch (mode) {
        case 'master':
            eng.raft.start();
            break;
        case 'idle':
            eng.raft.stop();
        }
    });
};

util.inherits(Engine,engine.Engine);

Engine.prototype._saveWorldInitJournal = function(jfn) {
    const  eng = this;
    const item = [this.timestamp(),'raft',eng.raft.getState()];
    fs.appendFileSync(jfn,util.serialise(item)+'\n');
};

Engine.prototype._startPrevalenceJournalItem = function(js) {
    const eng = this;

    if (js[1]==='raft') {
        eng.raft.currentTerm = js[2].currentTerm;
        eng.raft.votedFor    = js[2].votedFor;
    }
};