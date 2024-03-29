"use strict";

const  tracing = require("../tracing.js");

const   assert = require("assert").strict;
const    chalk = require("chalk");
const     util = require("util");

const compiler = require("../compiler.js");


describe("summariseJSON",function() {
    it("preserves basic structure",function(){
        assert.strictEqual(tracing.summariseJSON([]),'[]');
    });
    it("preserves more complex structure",function(){
        assert.strictEqual(tracing.summariseJSON([[{},{}]]),'[[{},{}]]');
    });
    it("truncates strings",function(){
        assert.strictEqual(tracing.summariseJSON('123456789012345678901234567890'),
                           "'123456789012...'");
    });
    it("doesn't truncate short strings",function(){
        assert.strictEqual(tracing.summariseJSON('123456789',{n:10}),
                           "'123456789'");
    });
    it("doesn't truncate just-right strings",function(){
        assert.strictEqual(tracing.summariseJSON('1234567890',{n:10}),
                           "'1234567890'");
    });
    it("truncates long strings",function(){
        assert.strictEqual(tracing.summariseJSON('12345678901',{n:10}),
                           "'1234567890...'");
    });
    it("preserves long strings if asked",function(){
        assert.strictEqual(tracing.summariseJSON('12345678901',{n:10,long:true}),
                           '"12345678901"');
    });
    it("is nice to src ports",function(){
        assert.strictEqual(tracing.summariseJSON({src:'ws://127.0.0.1:51594/data'}),
                           "{src:'ws://127.0.0.1:51594/data'}");
    });
    it("is nice to dst ports",function(){
        assert.strictEqual(tracing.summariseJSON({dst:'ws://127.0.0.1:51594/data'}),
                           "{dst:'ws://127.0.0.1:51594/data'}");
    });
    it("is bored easily",function(){
        assert.strictEqual(tracing.summariseJSON({boring:"I can go on for hours you know"},{
            isKeyInteresting: k=>k!=='boring'
        }),
                           "{boring:'...'}");
    });
    it("is bored indirectly",function(){
        assert.strictEqual(tracing.summariseJSON([{boring:"You see, I'm just more patient"}],{
            isKeyInteresting: k=>k!=='boring'
        }),
                           "[{boring:'...'}]");
    });
});

describe("tracing of compiled code",function(){
    const saveDebug = compiler.debug;
    const saveChalk = chalk.enabled;
    before(()=>{compiler.debug=true;chalk.enabled=false;});
    after(()=>{compiler.debug=saveDebug;chalk.enabled=saveChalk;});
    it("traces execution",function(){
        const st = require("./bl/pingpong.malaya");
        let  out = '';
        tracing.trace(st,'dummy.malaya',{print:(...rest)=>{
            out += util.format.apply(null,rest);
        }});
        st.update(['ping',{p:'q'},{src:'?????port?????'}]);
        assert(out.includes('?????port?????'));
        assert(out.includes('ping'));
        assert(out.includes('pong'));
    });
});

describe("tracing of compiled code, discarding of output",function(){
    const saveDebug = compiler.debug;
    const saveChalk = chalk.enabled;
    before(()=>{compiler.debug=true;chalk.enabled=false;});
    after(()=>{compiler.debug=saveDebug;chalk.enabled=saveChalk;});
    it("traces execution, discarding output",function(){
        const st = require("./bl/pingpong.malaya");
        let  out = '';
        tracing.trace(st,'dummy.malaya',{
            isFactInteresting: f=>false, // everything bores me
            print:             (...rest)=>{
                out += util.format.apply(null,rest);
            }} );
        st.update(['ping',{p:'q'},{src:'?????port?????'}]);
        assert.equal(out,'');
    });
});

describe("tracing of compiled code,deactivation of output",function(){
    const saveDebug = compiler.debug;
    const saveChalk = chalk.enabled;
    let          st;
    let         off;
    let         out = '';
    before(()=>{compiler.debug=true;chalk.enabled=false;});
    after(()=>{compiler.debug=saveDebug;chalk.enabled=saveChalk;});
    before(()=>{st=require("./bl/pingpong.malaya");});
    it("enables tracing",function(){
        off = tracing.trace(st,'./bl/pingpong.malaya',{print:(...rest)=>{
            out += util.format.apply(null,rest);
        }});
    });
    it("traces execution",function(){
        st.update(['ping',{p:'q'},{src:'?????port?????'}]);
        assert(out.includes('?????port?????'));
        assert(out.includes('ping'));
        assert(out.includes('pong'));
        out = '';
    });
    it("disables tracing",function(){
        off();
    });
    it("doesn't trace execution",function(){
        st.update(['ping',{p:'q'},{src:'?????port?????'}]);
        assert.equal(out,'');
    });
});
