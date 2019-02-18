"use strict";

// dns.malaya has side effects, so we require it in a controlled
// environment below, not here

const   plugin = require('../../plugin.js');
const   malaya = require('../../index.js');
const testutil = require('../../testutil.js');

const     fs = require('fs');
const   ndns = require('dns');
const   path = require('path');
const   temp = require('temp').track();
const assert = require('assert').strict;

describe("dns example XXX",function() {
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
                const off = dns._private.packDNSname(buf,['a'],0);
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
                const off = dns._private.packDNSname(buf,['a'],1);
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

        describe("IPv4 addresses", function() {
            const ipv4 = '192.168.231.8';
            const  buf = Buffer.alloc(10);
            it("packs IPv4",function() {
                dns._private.packIPv4(buf,ipv4,0);
            });
            it("unpacks IPv4",function() {
                const [quad,off] = dns._private.unpackIPv4(buf,0);
                assert.equal(quad,ipv4);
                assert.equal(off,4);
            });
        });

    });

    describe("running as a process",function() {
        this.bail(true);
        const noisy = false;
        const   dir = temp.mkdirSync();
        let saveDNS = ndns.getServers();
        const srcFn = path.join(__dirname,'../dns.malaya');
        const iniFn = path.join(dir,'init.json');
        let     srv;

        after(()=>ndns.setServers(saveDNS));
        after(()=>{
            if (srv)
                srv.kill();
        });
        it("inits",function(done) {
            fs.writeFileSync(iniFn,JSON.stringify([['rr',{name:['fred','co'],type:1,cls:1,rd:'6.6.7.7'}]]));
            srv = new testutil.ExtServer('malaya',
                                         {
                                             dir,
                                             noisy,
                                             preargs:       ['--override','udp.port=0'],
                                             prevalenceDir: path.join(dir,'.prevalence')
                                         });
            srv.init(['-d',iniFn,srcFn],done);
        });
        it("runs",function(done) {
            const args = noisy ? ['-D'] : [];
            srv.run(args.concat([srcFn]),done);
        });
        it("has allocated a udp port",function() {
            assert.equal(typeof srv.plugins['udp'].port,'number');
        });
        it("set node to use this port for DNS", function() {
            ndns.setServers([`127.0.0.1:${srv.plugins['udp'].port}`]);
        });
        it("does a lookup for a known domain",function(done) {
            ndns.resolve('fred.co',(err,ans)=>{
                assert(!err);
                assert.equal(ans.length,1);
                assert.equal(ans[0],'6.6.7.7');
                done();
            });
        });
    });
});
