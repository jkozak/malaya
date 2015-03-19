var util   = require("../util.js");

var fs     = require("fs");
var temp   = require("temp");
var path   = require("path");
var assert = require("assert");

temp.track();

describe('constants',function() {
    it("`env` will always be 'test' when testing",function() {
        assert.equal(util.env,"test");
    });
    it("`source_version` will be a string",function() {
        assert.equal(typeof util.sourceVersion,'string');
    });
});

describe('serialise',function() {
    var date = new Date(0);
    it("should encode bare dates nicely",function() {
        assert(util.deserialise(util.serialise(date)) instanceof Date);
    });
    it("should encode dates in arrays nicely",function() {
        assert(util.deserialise(util.serialise([date]))[0] instanceof Date);
    });
    it("should encode dates in objects nicely",function() {
        assert(util.deserialise(util.serialise({d:date})).d instanceof Date);
    });
});

describe("readFileLinesSync",function() {
    var  tdir = temp.mkdirSync();
    var lines = ["line 1","line 2","line 3","line 4"];
    var    fn = path.join(tdir,"1.txt");
        fs.writeFileSync(fn,lines.join('\n'));
    it("should read a file linewise",function() {
        var i = 0;
        util.readFileLinesSync(fn,function(l) {
            assert.equal(l,lines[i++]);
            return true;
        });
    });
    it("should give up if asked",function() {
        var i = 0;
        util.readFileLinesSync(fn,function(l) {
            i++;
            return i!=2;
        });
        assert.equal(i,2);
    });
});
