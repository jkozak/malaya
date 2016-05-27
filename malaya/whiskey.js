// ... where STREAMS of WHISKEY are flowing ...
"use strict";

const             _ = require('underscore');
const        stream = require('stream');
const     _through2 = require('through2');
const StringDecoder = require('string_decoder').StringDecoder;
const        VError = require('verror');

const through2 = function(options,transform) {
    const pt = _through2.apply(this,arguments);
    // dodgy workaround for lack of {readable,writable}ObjectMode
    if (options.readableObjectMode && !pt._readableState.objectMode)
        pt._readableState.objectMode = true;
    if (options.writableObjectMode && !pt._writableState.objectMode)
        pt._writableState.objectMode = true;
    return pt;
};
exports.through2 = through2;

// Stream of lines, maybe transformed
exports.LineStream = function(fn) {
    const send = function(out,x) {
        try {
            if (fn)
                x = fn(x);
        } catch (err) {
            return err;
        }
        if (x===null)
            return new Error("null can't be sent to a node stream");
        else {
            out.push(x);
            return null;
        }
    };
    const  ans = through2({readableObjectMode:true},
                        function(chunk,encoding,cb) {
                            this._buffer += this._decoder.write(chunk);
                            const lines = this._buffer.split(/\r?\n/); // split on newlines
                            this._buffer = lines.pop();              // keep the last partial line buffered
                            for (let l=0;l<lines.length;l++) {
                                const err = send(this,lines[l]);
                                if (err) {
                                    cb(err);
                                    return;
                                }
                            }
                            cb(null);
                        },
                        function(cb) {                               // flush at end
                            const b = this._buffer;
                            this._buffer = '';
                            if (b!=='') {
                                const err = send(this,b);
                                if (err) {
                                    cb(err);
                                    return;
                                }
                            }
                            cb(null);
                        } );
    ans._buffer  = '';
    ans._decoder = new StringDecoder('utf8');
    return ans;
};

// StringifyObjectStreamStream is the inverse of LineStream
exports.StringifyObjectStream = function(fn) {
    const ans = through2({writableObjectMode:true},function(chunk,encoding,cb) {
        let s;
        try {
            s = fn(chunk);
        } catch (err) {
            this.emit('error',err);
        }
        this.push(s+'\n','utf8');
        cb();
    });
    ans.setEncoding('utf8');
    return ans;
};

// JSONParseStream gets \n-delimited JSON string data, and emits the parsed objects
exports.JSONParseStream = function() {
    const ans = through2({readableObjectMode:true},function(chunk,encoding,cb) {
        this._buffer += this._decoder.write(chunk);
        const lines = this._buffer.split(/\r?\n/); // split on newlines
        this._buffer = lines.pop();              // keep the last partial line buffered
        for (let l=0;l<lines.length;l++) {
            const line = lines[l];
            let  obj;
            try {
                obj = JSON.parse(line);
            } catch (err) {
                cb(err);
                return;
            }
            if (obj===null) {
                cb(new Error("null can't be sent to a node stream"));
                return;
            } else
                this.push(obj);                  // push the parsed object out to the readable consumer
        }
        cb();
    });
    ans._buffer  = '';
    ans._decoder = new StringDecoder('utf8');
    return ans;
};

// StringifyJSONStream is the inverse of JSONParseStream
exports.StringifyJSONStream = function() {
    const ans = through2({writableObjectMode:true},function(chunk,encoding,cb) {
        let s;
        try {
            s = JSON.stringify(chunk);
        } catch (err) {
            this.emit('error',err);
        }
        this.push(s+'\n','utf8');
        cb();
    });
    ans.setEncoding('utf8');
    return ans;
};

// Maintain count of offset within stream
exports.StreamWithOffset = function(offset,options) {
    if (offset===undefined)
        offset  = 0;
    if (options===undefined)
        options = {};
    const swo = stream.PassThrough(options);
    if (swo._offset!==undefined)
        throw new Error("_offset field in use");
    swo._offset = offset;
    swo.on('data',function(chunk) {
        swo.emit('dataWithOffset',chunk,swo._offset);
        if (options.objectMode || options.readableObjectMode)
            swo._offset++;
        else
            swo._offset += chunk.length;
    });
    return swo;
};

// Maintain count of offset within object stream
exports.OffsetStream = function(offset,options) {
    if (offset===undefined)
        offset  = 0;
    if (options===undefined)
        options = {};
    options = Object.assign({},options,{readableObjectMode:true});
    const os = through2(options,function(chunk,encoding,cb) {
        this.push([os._offset,chunk]);
        if (options.objectMode || options.writableObjectMode)
            os._offset++;
        else
            os._offset += chunk.length;
        cb();
    });
    os._offset = offset;
    return os;
};

// Remove offset from stream items
exports.DeoffsetStream = function(options) {
    options = Object.assign({},options||{},{writableObjectMode:true});
    const ds = through2(options,function(chunk,encoding,cb) {
        this.push(chunk[1]);
        cb();
    });
    return ds;
};

// returns stream which passes objects from `stream1` until an object
// is given which matches the first from `stream2` from which point that
// will be returned instead.
exports.createBackFillStream = function(stream1,stream2,options) {
    const output = new stream.PassThrough({objectMode:true,allowHalfOpen:false});
    let streamId = 1;
    let  lastOn1 = null;
    let firstOn2 = null;
    options = options || {readAfterSwitch:false};
    stream2.on('readable',function() {
        for (;;) {
            let datum;
            if (streamId===2) {
                datum = stream2.read();
                if (datum===null)
                    break;
                else
                    output.write(datum);
            }
            else if (streamId===1) {
                if (firstOn2===null) {
                    firstOn2 = stream2.read();
                    if (firstOn2!==null)
                        stream1.emit('readable');
                }
                break;
            }
            else
                output.emit('error',new VError("bad streamId: %j",streamId));
        }
    });
    stream2.on('end',function() {
        output.end();
    });
    stream2.on('error',function(err) {
        output.emit('error',new VError(err,"from stream2"));
    });
    stream1.on('readable',function() {
        if (firstOn2!==null)
            for (;;) {
                if (streamId===1) {
                    const datum = stream1.read();
                    if (datum===null)
                        break;
                    else {
                        lastOn1 = datum;
                        output.write(lastOn1);
                        if (_.isEqual(lastOn1,firstOn2)) {
                            streamId = 2;
                            stream2.emit('readable');
                        }
                    }
                }
                else if (options.readAfterSwitch) { // read on, probably to get the stream closed
                    if (stream1.read()===null)
                        break;
                }
                else
                    break;
            }
    });
    stream1.on('end',function() {
        if (lastOn1===null)
            output.emit('error',new VError("stream1 empty, can't sync"));
        else if (lastOn1!==firstOn2)
            output.emit('error',new VError("stream1 doesn't contain sync item: %j",firstOn2));
        else
            stream2.emit('readable');
    });
    stream1.on('error',function(err) {
        output.emit('error',new VError(err,"from stream1"));
    });
    return output;
};
