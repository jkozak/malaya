var    idb = require('../idb.js');
var assert = require('assert');
var events = require('events');
var stream = require('stream');
var   util = require('malaya').util;

describe("FE3",function() {
    var   ee = new events.EventEmitter();
    var ibuf = '';
    var  xml = '<q c="2"/>';
    var obuf = new Buffer(idb.FE3_HDR_LENGTH+4+xml.length+1);
    var sock;
    var  fe3;

    before(function() {
        sock = {on:   ee.on.bind(ee),
                write:function(s){ibuf+=s;}};

        fe3  = new idb.FE3(sock);
        fe3.write({p:{a:1,b:2}});

        obuf.writeInt32LE(idb.AP_XML2A, 0); // type
        obuf.writeInt32LE(0,            4); // drain
        obuf.writeInt32LE(0,            8); // ticks
        obuf.writeInt32LE(xml.length+5,12); // cbData (inc trailing NUL plus 4 leading bytes of crap)
        obuf.writeInt32LE(0,           16); // seqNo
        obuf.writeInt32LE(0,           20); // dummy
        obuf.writeInt32LE(0,           24); // dummy
        obuf.write(xml,                28,'ascii');
    });
    
    it("should encode json as XML in FE3",function() {
        assert.strictEqual(ibuf.slice(idb.FE3_HDR_LENGTH),'<p a="1" b="2"/>\0'); //N.B. trailing zero
    });

    it("should convert FE3 XML to json",function(done) {
        fe3.once('data',function(js) {
            assert.deepEqual(js,['q',{c:'2'}]);
            done();
        });
        ee.emit('data',obuf);
    });

    it("should convert fragmented header FE3 XML to json",function(done) {
        fe3.once('data',function(js) {
            assert.deepEqual(js,['q',{c:'2'}]);
            done();
        });
        ee.emit('data',obuf.slice(0,10));
        ee.emit('data',obuf.slice(10));
    });

    it("should convert fragmented content FE3 XML to json",function(done) {
        fe3.once('data',function(js) {
            assert.deepEqual(js,['q',{c:'2'}]);
            done();
        });
        ee.emit('data',obuf.slice(0,30));
        ee.emit('data',obuf.slice(30));
    });
});
