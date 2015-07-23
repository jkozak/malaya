var util    = require("../util.js");

var fs      = require("fs");
var temp    = require("temp").track();
var path    = require("path");
var assert  = require("assert");

describe('constants',function() {
    it("`env` will always be 'test' when testing",function() {
        assert.strictEqual(util.env,"test");
    });
    it("`source_version` will be a string",function() {
        assert.strictEqual(typeof util.sourceVersion,'string');
    });
});

describe('deserialise',function() {
    it("should handle http journal entries",function() {
        util.deserialise('[1433080456517,":http",[":/home/jk/malaya/examples/idb/www/index.html",":31bdc7b5c80ff5e8e2daa218faf40e567143121e"]]');
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
    fs.writeFileSync(fn,lines.join('\n')+'\n');
    it("should read a file linewise",function() {
        var i = 0;
        util.readFileLinesSync(fn,function(l) {
            assert.strictEqual(l,lines[i++]);
            return true;
        });
        assert.strictEqual(i,lines.length);
    });
    it("should give up if asked",function() {
        var i = 0;
        util.readFileLinesSync(fn,function(l) {
            i++;
            return i!=2;
        });
        assert.strictEqual(i,2);
    });
    it("should return '' for well-formatted file",function() {
        assert.strictEqual('',util.readFileLinesSync(fn,function(l) {return true;}));
    });
    it("should return fragment after last '\n' for ill-formed file",function() {
        var  fn2 = path.join(tdir,"2.txt");
        var junk = "this is some junk left over at the end";
        var    n = 0;
        fs.writeFileSync(fn2,lines.join('\n')+'\n');
        fs.appendFileSync(fn2,junk);
        assert.strictEqual(junk,util.readFileLinesSync(fn2,function(l) {n++;return true;}));
        assert.strictEqual(n,lines.length);
    });
    it("should return lots after last '\n' for ill-formed file",function() {
        var  fn2 = path.join(tdir,"2.txt");
        var junk = (new Array(16*1024)).join("x"); //N.B. should be bigger than readFileLinesSync's buffer
        var    n = 0;
        fs.writeFileSync(fn2,lines.join('\n')+'\n');
        fs.appendFileSync(fn2,junk);
        assert.strictEqual(junk,util.readFileLinesSync(fn2,function(l) {n++;return true;}));
        assert.strictEqual(n,lines.length);
    });
});

describe("string utils",function() {
    describe('startsWith',function() {
        it("matches at start of string",function() {
            assert(util.startsWith("abcdef","abc"));
        });
        it("matches if exact fit",function() {
            assert(util.startsWith("abc","abc"));
        });
    });
    describe('endsWith',function() {
        it("matches at end of string",function() {
            assert(util.endsWith("abcdef","def"));
        });
        it("matches if exact fit",function() {
            assert(util.endsWith("abc","abc"));
        });
    });
});
