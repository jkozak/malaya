// ... where STREAMS of WHISKEY are flowing ...
"use strict";

var             _ = require('underscore');
var        stream = require('stream');
var     _through2 = require('through2');
var StringDecoder = require('string_decoder').StringDecoder;
var        VError = require('verror');

var through2 = function(options,transform) {
    var pt = _through2.apply(this,arguments);
    // dodgy workaround for lack of {readable,writable}ObjectMode
    if (options.readableObjectMode && !pt._readableState.objectMode)
        pt._readableState.objectMode = true;
    if (options.writableObjectMode && !pt._writableState.objectMode)
        pt._writableState.objectMode = true;
    return pt;
};
exports.through2 = through2;

// JSONParseStream gets \n-delimited JSON string data, and emits the parsed objects
exports.JSONParseStream = function() {
    var ans = through2({readableObjectMode:true},function(chunk,encoding,cb) {
        this._buffer += this._decoder.write(chunk);
        var lines = this._buffer.split(/\r?\n/); // split on newlines
        this._buffer = lines.pop();              // keep the last partial line buffered
        for (var l=0;l<lines.length;l++) {
            var line = lines[l];
            var  obj;
            try {
                obj = JSON.parse(line);
            } catch (err) {
                this.emit('error',err);
                return;
            }
            if (obj===null)
                this.emit('error',"null can't be sent to a node stream");
            else
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
    var ans = through2({writableObjectMode:true},function(chunk,encoding,cb) {
        var s;
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
    var swo = stream.PassThrough(options);
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
    options = _.extend({},options,{readableObjectMode:true});
    var os = through2(options,function(chunk,encoding,cb) {
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
    options = _.extend({},options||{},{writableObjectMode:true});
    var ds = through2(options,function(chunk,encoding,cb) {
        this.push(chunk[1]);
        cb();
    });
    return ds;
};

// returns stream which passes objects from `stream1` until an object
// is given which matches the first from `stream2` from which point that
// will be returned instead.  
exports.createBackFillStream = function(stream1,stream2,options) {
    var   output = new stream.PassThrough({objectMode:true,allowHalfOpen:false});
    var streamId = 1;
    var  lastOn1 = null;
    var firstOn2 = null;
    options = options || {readAfterSwitch:false};
    stream2.on('readable',function() {
        for (;;) {
            var datum;
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
                    var datum = stream1.read();
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
