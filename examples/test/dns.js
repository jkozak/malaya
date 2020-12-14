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

describe("dns example",function() {
    let dns;

    afterEach(()=>plugin._private.reset());

    describe("ancillary functions", function() {
        before(()=>{
            plugin._private.reset();
            plugin.setOverrides({
                plugins:    [['udp','dummy']],
                parameters: []
            });
        });
        before(()=>{dns=malaya.load('examples/dns.malaya');});

        describe("DNS labels",function() {
            this.bail(true);
            let buf;
            let off;
            let  js;
            it("packs simplest label", function() {
                buf = Buffer.alloc(3);
                off = dns._private.packDNSname(buf,['a'],0);
                assert.equal(off,3);
                assert.equal(buf.readUInt8(0),1);            // one char in first segment
                assert.equal(buf.slice(1,2).toString(),"a");
                assert.equal(buf.readUInt8(2),0);
            });
            it("unpacks simplest label", function() {
                buf      = Buffer.from([1,'a'.charCodeAt(0),0]);
                [js,off] = dns._private.unpackDNSname(buf,0);
                assert.equal(off,3);
                assert.deepEqual(js,['a']);
            });
            it("packs simplest label with offset", function() {
                buf = Buffer.alloc(4);
                off = dns._private.packDNSname(buf,['a'],1);
                assert.equal(off,4);
                assert.equal(buf.readUInt8(1),1);            // one char in first segment
                assert.equal(buf.slice(2,3).toString(),"a");
                assert.equal(buf.readUInt8(3),0);
            });
            it("unpacks simplest label with offset", function() {
                buf      = Buffer.from([0,1,'a'.charCodeAt(0),0]);
                [js,off] = dns._private.unpackDNSname(buf,1);
                assert.equal(off,4);
                assert.deepEqual(js,['a']);
            });
            it("packs more complex label", function() {
                buf = Buffer.alloc(13);
                off = dns._private.packDNSname(buf,['bbc','co','uk'],1);
                assert.equal(off,1+'bbc'.length+1+'co'.length+1+'uk'.length+1+1);
                assert.equal(buf.readUInt8(1),3);            // one char in first segment
                assert.deepEqual(buf.slice(2,5).toString(),'bbc');
                assert.equal(buf.readUInt8(5),2);
                assert.deepEqual(buf.slice(6,8).toString(),'co');
                assert.equal(buf.readUInt8(8),2);
                assert.deepEqual(buf.slice(9,11).toString(),'uk');
                assert.equal(buf.readUInt8(11),0);
            });
            it("unpacks more complex label", function() {
                [js,off] = dns._private.unpackDNSname(buf,1);
                assert.equal(off,12);
                assert.deepEqual(js,['bbc','co','uk']);
            });
            it("unpacks frame from `dig bbc.co.uk`", function() {
                buf = Buffer.from([223,162,1,32,0,1,0,0,0,0,0,1,3,98,98,99,2,99,111,2,117,107,0,0,1,0,1,0,0,41,16,0,0,0,0,0,0,12,0,10,0,8,176,29,204,141,47,110,146,141]);
                js = dns._private.unpackDNS(buf);
                assert.equal(js[0],'query');
                assert.deepEqual(js[1].q,{name:['bbc','co','uk'],cls:1,type:1});
            });
            it("unpacks frame from google DNS's response to `dig bbc.co.uk`", function() {
                buf = Buffer.from([171,147,129,128,0,1,0,4,0,0,0,0,3,98,98,99,2,99,111,2,117,107,0,0,1,0,1,192,12,0,1,0,1,0,0,0,174,0,4,151,101,64,81,192,12,0,1,0,1,0,0,0,174,0,4,151,101,128,81,192,12,0,1,0,1,0,0,0,174,0,4,151,101,192,81,192,12,0,1,0,1,0,0,0,174,0,4,151,101,0,81]);
                js = dns._private.unpackDNS(buf);
                assert.equal(js[0],'response');
                assert.deepEqual(js[1].q,{name:['bbc','co','uk'],cls:1,type:1});
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
            fs.writeFileSync(iniFn,JSON.stringify([['rr',{q:{name:['fred','co'],type:1,cls:1},rds:['6.6.7.7']}]]));
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
