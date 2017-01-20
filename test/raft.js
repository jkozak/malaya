"use strict";

const     raft = require('../raft.js');
const     Raft = raft.Raft;
const   engine = require('../engine.js');

const   assert = require("assert");
const     util = require('../util.js');
const testutil = require('../testutil.js');
const   events = require('events');
const    sinon = require('sinon');
const       ip = require('ip');

describe("engine.Raft XXX",function() {
    it("customises timestamps",function(){
        const eng = new raft.Engine({chrjs:engine.makeInertChrjs()});
        const  ts = eng.timestamp();
        assert.strictEqual(ts[0],eng.raft.currentTerm);
    });
});

const          host = ip.address();
const makeIPAddress = (p)=>{
    return {family:'IPv4',address:host,port:p};
};

const TestEngine = function(port,peerPorts) {
    const eng = this;
    eng.raft    = null;
    eng.options = {
        ports: {http:port},
        peers: peerPorts.map((p)=>util.format('%s:%d',host,p)) };
    eng.journal = [];
    eng.http    = {address:()=>makeIPAddress(port)};
    eng._ts     = 0;
    eng.raft    = new Raft(eng);
};
util.inherits(TestEngine,events.EventEmitter);
TestEngine.prototype.journalise = function(type,data,cb) {
    const eng = this;
    eng.journal.push([eng._ts++,type,data]);
    if (cb) cb();
};
TestEngine.prototype.closeConnection = function(portName) {
    this.emit('connectionClose',portName,'raft');
};

describe("Raft protocol XXX",function() {
    let eng,clock,peer;
    const RaftConnectToPeer = Raft.prototype.connectToPeer;

    before(function() {clock=sinon.useFakeTimers();});
    after( function() {clock.restore();});
    before(function() {
        Raft.prototype.connectToPeer = function(peerName,cb) {
            const r = this;
            r.peers[peerName].io = testutil.createIO('raft');
            cb();
        };
    });
    after( function() {Raft.prototype.connectToPeer=RaftConnectToPeer;});

    it("gets created with TestEngine",function(){
        eng = new TestEngine(1,[2]);
        assert(eng.raft instanceof Raft);
        eng.raft.timeouts.election = [10,10]; // make non-random for testing
    });
    it("starts",function(){
        eng.raft.start();
        peer = eng.raft.peers[eng.options.peers[0]];
        assert(peer);
    });
    it("starts as a follower",function(){
        assert.strictEqual(eng.raft.mode,'follower');
    });
    it("remains a follower during election timer",function(){
        clock.tick(9);
        assert.strictEqual(eng.raft.mode,'follower');
        assert.strictEqual(peer.io.rcved.length,0);
    });
    it("becomes a candidate after election timer expires",function(){
        clock.tick(1);
        assert.strictEqual(eng.raft.mode,'candidate');
        const rcved = peer.io.rcved;
        assert.strictEqual(rcved.length,1);
        assert.strictEqual(rcved[0].type,        'RequestVote');
        assert.strictEqual(rcved[0].term,        1);
        assert.strictEqual(rcved[0].candidateId, util.format('%s:1',host));
        assert.strictEqual(rcved[0].lastLogIndex,0);
        assert.strictEqual(rcved[0].lastLogTerm, 1);
    });
    it("remains a candidate, restarting elections",function(cb){
        clock.tick(9);
        assert.strictEqual(eng.raft.mode,'candidate');
        assert.strictEqual(peer.io.rcved.length,1);
        eng.raft.command({
            type:   'REPLY',
            from:   eng.options.peers[0],
            call:   'RequestVote',
            result: {term:eng.raft.currentTerm,voteGranted:false}
        },(err)=>{
            if (err)
                cb(err);
            else {
                clock.tick(1);
                assert.strictEqual(eng.raft.mode,'candidate');
                assert.strictEqual(peer.io.rcved.length,2);
                cb();
            }
        });
    });
    it("becomes leader if it wins an election",function(cb){
        eng.raft.command({
            type:   'REPLY',
            from:   eng.options.peers[0],
            call:   'RequestVote',
            result: {term:eng.raft.currentTerm,voteGranted:true}
        },(err)=>{
            if (err)
                cb(err);
            else {
                assert.strictEqual(eng.raft.mode,'leader');
                cb();
            }
        });
    });
});
