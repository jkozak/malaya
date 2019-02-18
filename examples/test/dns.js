"use strict";

// dns.malaya has side effects, so we require it in a controlled
// environment below, not here

const   plugin = require('../../plugin.js');
const   malaya = require('../../index.js');
const testutil = require('../../testutil.js');

const   ndns = require('dns');
const   path = require('path');
const   temp = require('temp').track();
const assert = require('assert').strict;

describe("dns example",function() {
    let dns;

    afterEach(()=>plugin._private.reset());

    describe("ancillary functions", function() {
        before(()=>{
            plugin.setOverrides({
                plugins:    [['udp','dummy']],
                parameters: []
            });
        });
        before(()=>{dns=malaya.load('examples/dns.malaya');});

        describe("DNS labels",function() {
            it("packs simplest label", function() {
                const buf = Buffer.alloc(3);
                const off = dns._private.packDNSname(buf,0,['a']);
                assert.equal(off,3);
                assert.equal(buf.readUInt8(0),1);            // one char in first segment
                assert.equal(buf.slice(1,2).toString(),"a");
                assert.equal(buf.readUInt8(2),0);
            });
            it("unpacks simplest label", function() {
                const      buf = Buffer.from([1,'a'.charCodeAt(0),0]);
                const [js,off] = dns._private.unpackDNSname(buf,0);
                assert.equal(off,3);
                assert.deepEqual(js,['a']);
            });
            it("packs simplest label with offset", function() {
                const buf = Buffer.alloc(4);
                const off = dns._private.packDNSname(buf,1,['a']);
                assert.equal(off,4);
                assert.equal(buf.readUInt8(1),1);            // one char in first segment
                assert.equal(buf.slice(2,3).toString(),"a");
                assert.equal(buf.readUInt8(3),0);
            });
            it("unpacks simplest label with offset", function() {
                const      buf = Buffer.from([0,1,'a'.charCodeAt(0),0]);
                const [js,off] = dns._private.unpackDNSname(buf,1);
                assert.equal(off,4);
                assert.deepEqual(js,['a']);
            });
        });
    });

    describe("running as a process", function() {
        this.bail(true);
        const   dir = temp.mkdirSync();
        let saveDNS = ndns.getServers();
        let     srv;

        after(()=>ndns.setServers(saveDNS));
        after(()=>{
            if (srv)
                srv.kill();
        });
        it("inits",function(done) {
            srv = new testutil.ExtServer('malaya',
                                         {
                                             noisy:         false,
                                             preargs:       ['--override','udp.port=0'],
                                             prevalenceDir: path.join(dir,'.prevalence')
                                         });
            srv.init([],done);
        });
        it("runs",function(done) {
            srv.run([path.join(__dirname,'../dns.malaya')],done);
        });
        it("has allocated a udp port",function() {
            assert.equal(typeof srv.plugins['udp'].port,'number');
        });
        it("set node to use this port for DNS", function() {
            ndns.setServers([`127.0.0.1:${srv.plugins['udp'].port}`]);
        });
        it("does a lookup for a known domain",function(done) {
            ndns.resolve('fred.co',(err,ans)=>{
                //console.log("*** %j %j",err,ans);
                done();
            });
        });
    });

});
