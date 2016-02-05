"use strict";

const whiskey = require('../whiskey.js');

const       _ = require('underscore');
const  stream = require('stream');
const    util = require('util');
const  assert = require("assert");
const resumer = require('resumer');
const  VError = require('verror');

describe("LineStream",function() {
    it("turns '\\n' delimited stream into object stream of strings",function(done) {
        const strs = [];
        const   ls = whiskey.LineStream();
        resumer().queue("1\n2\n3\n").end().pipe(ls);
        ls.on('data',function(s) {
            strs.push(s);
        });
        ls.on('end',function() {
            assert.deepEqual(strs,['1','2','3']);
            done();
        });
    });
    it("keeps last line even if no final '\\n'",function(done) {
        const strs = [];
        const   ls = whiskey.LineStream();
        resumer().queue("1\n2\n3").end().pipe(ls);
        ls.on('data',function(s) {
            strs.push(s);
        });
        ls.on('end',function() {
            assert.deepEqual(strs,['1','2','3']);
            done();
        });
    });
    it("transforms on-the-fly",function(done) {
        const strs = [];
        const   ls = whiskey.LineStream(function(s){return parseInt(s)+1;});
        resumer().queue("1\n2\n3\n").end().pipe(ls);
        ls.on('data',function(s) {
            strs.push(s);
        });
        ls.on('end',function() {
            assert.deepEqual(strs,[2,3,4]);
            done();
        });
    });
});

describe("JSON object streams",function() {
    describe("string -> json",function() {
        const convert = function(js,done) {
            const jps = whiskey.JSONParseStream();
            resumer().queue(JSON.stringify(js)+'\n').end().pipe(jps).on('data',function(chunk) {
                assert.deepEqual(chunk,js);
                done();
            });
        };
        [[],{},['a'],{a:12},[1,2],['£']].forEach(function(js) {
            it(util.format("should convert %j",js),function(done) {
                convert(js,done);
            });
        });
        it("converts multiple strings",function() {
            const   jps = new whiskey.JSONParseStream();
            const rcved = [];
            resumer().queue('[1,2]\n[3,4]\n').end().pipe(jps)
                .on('data',function(chunk) {
                    rcved.push(chunk);
                })
                .on('finish',function() {
                    assert.deepEqual(rcved,[[1,2],[3,4]]);
                });
        });
        it("handles broken JSON gracefully",function() {
            const   jps = new whiskey.JSONParseStream();
            let      ok = false;
            resumer().queue('{{{\n\n').end().pipe(jps)
                .on('error',function() {
                    ok = true;
                })
                .on('finish',function() {
                    assert(ok);
                });
        });
        it("handles nulls gracefully",function() {
            const   jps = new whiskey.JSONParseStream();
            let      ok = false;
            resumer().queue('null\n').end().pipe(jps)
                .on('error',function() {
                    ok = true;
                })
                .on('finish',function() {
                    assert(ok);
                });
        });
    });
    describe("json -> string",function() {
        const convert = function(s,done) {
            const sjs = whiskey.StringifyJSONStream();
            resumer().queue(JSON.parse(s)).end().pipe(sjs).on('data',function(chunk) {
                assert.deepEqual(chunk,s+'\n');
                done();
            });
        };
        ['[]','{}','["a"]','{"a":12}','[1,2]','["£"]'].forEach(function(s) {
            it(util.format("should convert %j",s),function(done) {
                convert(s,done);
            });
        });
        it("converts multiple json objects",function() {
            const   sjs = new whiskey.StringifyJSONStream();
            let   rcved = '';
            resumer().queue([1,2]).queue([3,4]).end().pipe(sjs)
                .on('data',function(chunk) {
                    rcved += chunk;
                })
                .on('finish',function() {
                    assert.deepEqual(rcved,"[1,2]\n[3,4]\n");
                });
        });
    });
    describe("StreamWithOffset",function() {
        [0,10].forEach(function(offset0) {
            it(util.format("tags an object stream with offset counter: %d",offset0),function(done) {
                let   offset = offset0;
                const    swo = whiskey.StreamWithOffset(offset,{objectMode:true});
                const   send = [[],[1]];
                const  rcved = [];
                const   rsmr = resumer();
                send.forEach(function(x) {rsmr.queue(x);});
                rsmr.end().pipe(swo)
                    .on('dataWithOffset',function(data,offset1) {
                        assert.equal(offset1,offset);
                        offset += 1;
                        rcved.push(data);
                    })
                    .on('finish',function() {
                        assert.equal(offset,offset0+send.length);
                        assert.deepEqual(send,rcved);
                        done();
                    });
            });
        });
        [0,1000].forEach(function(offset0) {
            it(util.format("tags a stream with offset counter: %d",offset0),function(done) {
                let   offset = offset0;
                const    swo = whiskey.StreamWithOffset(offset);
                const   send = ["one","two","three"];
                const  rcved = [];
                const   rsmr = resumer();
                swo.setEncoding('utf8');
                send.forEach(function(x) {rsmr.queue(x);});
                rsmr.end().pipe(swo)
                    .on('dataWithOffset',function(chunk,offset1) {
                        assert.equal(offset1,offset);
                        offset += chunk.length;
                        rcved.push(chunk);
                    })
                    .on('finish',function() {
                        assert.equal(offset,offset0+send.join('').length);
                        assert.deepEqual(send,rcved);
                        done();
                    });
            });
        });
    });
    describe("OffsetStream",function() {
        [0,10].forEach(function(offset0) {
            it(util.format("tags an object stream with offset counter: %d",offset0),function(done) {
                let   offset = offset0;
                const     os = whiskey.OffsetStream(offset,{objectMode:true});
                const   send = [[],[1]];
                const  rcved = [];
                const   rsmr = resumer();
                send.forEach(function(x) {rsmr.queue(x);});
                rsmr.end().pipe(os)
                    .on('data',function(data) {
                        assert.deepEqual(data[0],offset);
                        offset += 1;
                        rcved.push(data[1]);
                    })
                    .on('finish',function() {
                        assert.equal(offset,offset0+send.length);
                        assert.deepEqual(send,rcved);
                        done();
                    });
            });
        });
        [0,1000].forEach(function(offset0) {
            it(util.format("tags a stream with offset counter: %d",offset0),function(done) {
                let   offset = offset0;
                const     os = whiskey.OffsetStream(offset);
                const   send = ["one","two","three"];
                const  rcved = [];
                const   rsmr = resumer();
                send.forEach(function(x) {rsmr.queue(x);});
                rsmr.end().pipe(os)
                    .on('data',function(chunk) {
                        assert.equal(chunk[0],offset);
                        offset += chunk[1].length;
                        rcved.push(chunk[1].toString('utf8'));
                    })
                    .on('finish',function() {
                        assert.equal(offset,offset0+send.join('').length);
                        assert.deepEqual(send,rcved);
                        done();
                    });
            });
        });
    });
});

const createObjectReadableStream = function(objs) {
    const input = new stream.Readable({objectMode:true});
    objs.forEach(function(o){input.push(o);});
    input.push(null);
    return input;
};

const createEmptyObjectReadableStream = function() {
    return createObjectReadableStream([]);
};

const createDevNullStream = function() {
    const output = new stream.Writable({objectMode:true});
    output._write = function(chunk,enc,cb){cb(null);};
    return output;
};

const checkReadableStreamContents = function(stream0,data,done) {
    let i = 0;
    stream0.on('readable',function() {
        for (;;) {
            const datum = stream0.read();
            if (datum===null)
                break;
            else if (!_.isEqual(data[i],datum))
                throw new VError("unexpected data: wanted %j got %j",data[i],datum);
            i++;
        }
    });
    stream0.on('end',function() {
        assert(i===data.length,util.format("not all data read: %j %j",i,data.length));
        done();
    });
};

describe("trivial streams",function() {
    describe("EmptyObjectReadableStream",function() {
        it("ends without reading much",function(done) {
            checkReadableStreamContents(createEmptyObjectReadableStream(),[],done);
        });
    });
    describe("ObjectReadableStream",function() {
        it("reads its data",function(done) {
            const data = [['one'],'two',[[3]],4];
            const  str = createObjectReadableStream(data);
            checkReadableStreamContents(str,data,done);
        });
    });
});

describe("BackFillStream",function() {
    it("simplest case",function(done) {
        const bfs = whiskey.createBackFillStream(createObjectReadableStream([1]),
                                               createObjectReadableStream([1,2]) );
        checkReadableStreamContents(bfs,[1,2],done);
    });
    it("next simplest case",function(done) {
        const bfs = whiskey.createBackFillStream(createObjectReadableStream([1,'two']),
                                               createObjectReadableStream([1,2]) );
        checkReadableStreamContents(bfs,[1,2],done);
    });
    it("non-common prefix",function(done) {
        const bfs = whiskey.createBackFillStream(createObjectReadableStream([1,['two'],3]),
                                               createObjectReadableStream([['two'],'III','IV']) );
        checkReadableStreamContents(bfs,[1,['two'],'III','IV'],done);
    });
    it("fails when streams cannot be synced",function(done) {
        const bfs = whiskey.createBackFillStream(createObjectReadableStream([2,3]),
                                               createObjectReadableStream([1,2]) );
        bfs.on('error',function(e) {
            done();
        });
        bfs.pipe(createDevNullStream());
    });
    it("fails when first stream is empty",function(done) {
        const bfs = whiskey.createBackFillStream(createEmptyObjectReadableStream(),
                                               createObjectReadableStream([1,2]) );
        bfs.on('error',function(e) {
            done();
        });
        bfs.pipe(createDevNullStream());
    });
    // +++ readAfterSwitch +++
});
