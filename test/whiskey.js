var whiskey = require('../whiskey.js');

var       _ = require('underscore');
var  stream = require('stream');
var    util = require('util'); 
var  assert = require("assert");
var resumer = require('resumer');
var  VError = require('verror');

describe("JSON object streams",function() {
    describe("string -> json",function() {
        var convert = function(js,done) {
            var jps = whiskey.JSONParseStream();
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
            var   jps = new whiskey.JSONParseStream();
            var rcved = [];
            resumer().queue('[1,2]\n[3,4]\n').end().pipe(jps)
                .on('data',function(chunk) {
                    rcved.push(chunk);
                })
                .on('finish',function() {
                    assert.deepEqual(rcved,[[1,2],[3,4]]);
                });
        });
        it("handles broken JSON gracefully",function() {
            var   jps = new whiskey.JSONParseStream();
            var rcved = [];
            var    ok = false;
            resumer().queue('{{{\n\n').end().pipe(jps)
                .on('error',function() {
                    ok = true;
                })
                .on('finish',function() {
                    assert(ok);
                });
        });
        it("handles nulls gracefully",function() {
            var   jps = new whiskey.JSONParseStream();
            var rcved = [];
            var    ok = false;
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
        var convert = function(s,done) {
            var sjs = whiskey.StringifyJSONStream();
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
            var   sjs = new whiskey.StringifyJSONStream();
            var rcved = '';
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
                var offset = offset0;
                var    swo = whiskey.StreamWithOffset(offset,{objectMode:true});
                var   send = [[],[1]];
                var  rcved = [];
                var   rsmr = resumer();
                send.forEach(function(x) {rsmr.queue(x);});
                rsmr.end().pipe(swo)
                    .on('dataWithOffset',function(data,offset0) {
                        assert.equal(offset0,offset);
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
                var offset = offset0;
                var    swo = whiskey.StreamWithOffset(offset);
                var   send = ["one","two","three"];
                var  rcved = [];
                var   rsmr = resumer();
                swo.setEncoding('utf8');
                send.forEach(function(x) {rsmr.queue(x);});
                rsmr.end().pipe(swo)
                    .on('dataWithOffset',function(chunk,offset0) {
                        assert.equal(offset0,offset);
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
                var offset = offset0;
                var     os = whiskey.OffsetStream(offset,{objectMode:true});
                var   send = [[],[1]];
                var  rcved = [];
                var   rsmr = resumer();
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
                var offset = offset0;
                var     os = whiskey.OffsetStream(offset);
                var   send = ["one","two","three"];
                var  rcved = [];
                var   rsmr = resumer();
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

var createObjectReadableStream = function(objs) {
    var input = new stream.Readable({objectMode:true});
    objs.forEach(function(o){input.push(o);});
    input.push(null);
    return input;
};

var createEmptyObjectReadableStream = function() {
    return createObjectReadableStream([]);
};

var createDevNullStream = function() {
    var output = new stream.Writable({objectMode:true});
    output._write = function(chunk,enc,cb){cb(null);};
    return output;
};

var checkReadableStreamContents = function(stream,data,done) {
    var    i = 0;
    stream.on('readable',function() {
        for (;;) {
            var datum = stream.read();
            if (datum===null)
                break;
            else if (!_.isEqual(data[i],datum))
                throw new VError("unexpected data: wanted %j got %j",data[i],datum);
            i++;
        }
    });
    stream.on('end',function() {
        assert(i==data.length,util.format("not all data read: %j %j",i,data.length));
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
            var   data = [['one'],'two',[[3]],4];
            var stream = createObjectReadableStream(data);
            checkReadableStreamContents(stream,data,done);
        });
    });
});

describe("BackFillStream",function() {
    it("simplest case",function(done) {
        var bfs = whiskey.createBackFillStream(createObjectReadableStream([1]),
                                               createObjectReadableStream([1,2]) );
        checkReadableStreamContents(bfs,[1,2],done);
    });
    it("next simplest case",function(done) {
        var bfs = whiskey.createBackFillStream(createObjectReadableStream([1,'two']),
                                               createObjectReadableStream([1,2]) );
        checkReadableStreamContents(bfs,[1,2],done);
    });
    it("non-common prefix",function(done) {
        var bfs = whiskey.createBackFillStream(createObjectReadableStream([1,['two'],3]),
                                               createObjectReadableStream([['two'],'III','IV']) );
        checkReadableStreamContents(bfs,[1,['two'],'III','IV'],done);
    });
    it("fails when streams cannot be synced",function(done) {
        var bfs = whiskey.createBackFillStream(createObjectReadableStream([2,3]),
                                               createObjectReadableStream([1,2]) );
        bfs.on('error',function(e) {
            done();
        });
        bfs.pipe(createDevNullStream());
    });
    it("fails when first stream is empty",function(done) {
        var bfs = whiskey.createBackFillStream(createEmptyObjectReadableStream(),
                                               createObjectReadableStream([1,2]) );
        bfs.on('error',function(e) {
            done();
        });
        bfs.pipe(createDevNullStream());
    });
    // +++ readAfterSwitch +++
});
