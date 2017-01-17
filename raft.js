// RAFT implementation

"use strict";

const        util = require('./util.js');
const      events = require('events');
const      VError = require('verror');
const      assert = require('assert');
const      SockJS = require('node-sockjs-client');
const      stream = require('stream');
const          ip = require('ip');

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
    raft.id              = util.format("%s:%d",ip.address(),eng.options.ports.www);
    raft.peers           = {};            // peerName -> Peer
    raft.leader          = null;
    raft.currentTerm     = 0;             // persistent
    raft.votedFor        = null;          // persistent
    raft.log             = [];            // persistent
    raft.commitIndex     = 0;
    raft.lastApplied     = 0;
    raft.leaderSeen      = false;
    raft.electionTimeout = null;
    raft.timeouts        = {
        election:    [150,300],
        connectRetry:5000,
        connectFail: 1000
    };
};

util.inherits(Raft,events.EventEmitter);

Raft.prototype._installPeer = function(io,portName) {
    const   raft = this;
    const   addr = raft.engine.http.address();
    let peerName = null;
    const   tOut = setTimeout(()=>{
        io.i.end();
    },raft.timeouts.connectFail);
    io.i.once('data',(js0)=>{
        console.log("*** reading... %j",js0);
        io.i.once('end',()=>{
            console.log("peer %s disconnected",peerName);
            if (peerName) {
                raft.peers[peerName].io       = null;
                raft.peers[peerName].portName = null;
            }
        });
        if (js0!==null && js0.type==='HELLO' && raft.peers[js0.id]) {
            peerName = js0.id;
            raft.peers[peerName].io       = io;
            raft.peers[peerName].portName = portName;
            clearTimeout(tOut);
            console.log("peer %s connected",peerName);
            io.i.on('readable',function() {
                for (;;) {
                    const js = io.i.read();
                    if (js===null)
                        break;
                    raft.command(js,(err,ans)=>{ /* eslint no-loop-func:0 */
                        if (err) {
                            if (portName)
                                raft.engine.closeConnection(portName);
                            raft.peers[peerName].forget();
                        } else {
                            io.o.write({type:'REPLY',id:peerName,result:ans});
                        }
                    });
                }
            });
        } else
            io.i.end();
    });
    io.o.write({type:'HELLO',id:util.format("%s:%d",addr.address,addr.port)});
};

Raft.prototype.start = function() {
    const raft = this;
    for (const i in raft.engine.options.peers) {
        const p = raft.engine.options.peers[i];
        // +++ canonicalise `p` +++
        raft.peers[p] = new Peer(raft);
    }
    setInterval(()=>{
        for (const k in raft.peers) {
            const p = raft.peers[k];
            if (p.io===null) {
                raft.connectToPeer(k,(e,io)=>{
                    if (!e && p.io===null)
                        raft._installPeer(io,null);
                });
            }
        }
    },raft.timeouts.connectRetry);
};

Raft.prototype.stop = function() {
    const raft = this;
    for (const k in raft.peers) {
        if (raft.peers[k].io)
            raft.peers[k].io.i.end();
    }
    raft.peers = {};
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
            console.log("*** SockJS.msg: %j",msg);
            io.i.write(JSON.parse(msg.data));
        };
        io.o.on('readable',()=>{
            for (;;) {
                const js = io.o.read();
                if (js===null)
                    break;
                sock.send(JSON.stringify(js)+'\n');
            }
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
    if (raft.electionTimeout!==null)
        clearTimeout(raft.electionTimeout);
    raft.become('candidate');
    raft.currentTerm++;
    raft.voteFor = raft.id;
    raft.setElectionTimeout();
};

Raft.prototype.become = function(mode) {
    const raft = this;
    raft.mode = mode;
    raft.emit('mode',mode);
};

Raft.prototype.setElectionTimeout = function() {
    const raft = this;
    raft.leaderSeen      = false;
    raft.electionTimeout = setTimeout(()=>{
        raft.electionTimeout = null;
        if (raft.mode==='follower' && !raft.leaderSeen) {
            raft.become('candidate');
            raft.startElection();
            // +++
        } else if (raft.mode==='candidate') {
            // +++
            raft.startElection();
        }
        else
            raft.setElectionTimeout();
    },raft.timeouts[0]+Math.random()*(raft.timeouts[1]-raft.timeouts[0]));
};

Raft.prototype.persistMetadata = function(cb) {
    const raft = this;
    raft.engine.journalise('raft',{currentTerm:raft.currentTerm,
                                   votedFor:   raft.votedFor,
                                   log:        raft.log},cb);
};

Raft.prototype.command = function(js,cb0) { // RAFT protocol command
    const raft = this;
    let   save = false;
    let    nCB = 1;
    const   cb = (()=>{
        let err,res;
        return (e,r)=>{
            err = err || e || null;
            res = res || r || null;
            if (--nCB===0)
                cb0(err,res);
        };
    })();
    // msg format:   {type,id,...}
    // reply format: {type:'REPLY',id,result}
    switch (js.type) {
    case 'AppendEntries':
        raft.leaderSeen = true;
        cb(new VError("NYI: raft AppendEntries"));
        break;
    case 'RequestVote':
        if (js.term<raft.currentTerm)
            cb(null,false);
        else if (raft.votedFor===null || raft.votedFor===js.candidateId) {
            if (raft.term===js.lastLogTerm && raft.commitIndex<=js.lastLogIndex) {
                raft.votedFor = js.candidateId;
                save          = true;
                nCB++;
                cb(null,{term:raft.currentTerm,voteGranted:true});
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
        cb(new VError("NYI RAFT msg type: %s"%js.type));
        break;
    default:
        cb(new VError("unknown RAFT msg type: %s"%js.type));
        break;
    }
    if (save)
        raft.persistMetadata(cb);
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
