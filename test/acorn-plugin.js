"use strict";

const acornPlugin = require('../acorn-plugin.js');

const     fs = require('fs');
const  acorn = require('acorn');
const assert = require('assert').strict;

acorn.defaultOptions.inStore = false;

const parser = acorn.Parser.extend(
    Parser=>class extends acornPlugin(Parser) {
        _parseFrom(nodeType) {
            const node = this.startNode();
            this.nextToken();
            return this[`parse${nodeType}`](node);
        }
        static _parseFrom(nodeType,input,options) {
            return new this(options,input)._parseFrom(nodeType);
        }
    });

const parse = (nt,x,opts)=>parser._parseFrom(nt,x,{ecmaVersion:2022,...opts});

describe("acorn parser plugin XXX",function(){
    describe("item",function(){
        it("list",function(){
            const sb = parse('MalayaItem',"['a',{}]",{inStore:true});
            console.log(sb);
        });
        it("list with ellipsis",function(){
            const sb = parse('MalayaItem',"['a',...]",{inStore:true});
            console.log(sb);
        });
        it("list with named ellipsis",function(){
            const sb = parse('MalayaItem',"['a',...x]",{inStore:true});
            console.log(sb);
        });
        it("list with penultimate ellipsis",function(){
            const sb = parse('MalayaItem',"['a',...,x]",{inStore:true});
            console.log(sb);
        });
        it("object",function(){ //
            const sb = parse('MalayaItem',"{a:2}",{inStore:true});
            console.log(sb);
        });
        it("object with ellipsis",function(){ //
            const sb = parse('MalayaItem',"{a:2,...}",{inStore:true});
            console.log(sb);
        });
        it("object with named ellipsis",function(){ //
            const sb = parse('MalayaItem',"{...x,a:2}",{inStore:true});
            console.log(sb);
        });
        it("object with implicit binding",function(){ //
            const sb = parse('MalayaItem',"{x,a:2}",{inStore:true});
            console.log(sb);
        });
        it("conditional",function(){
            const sb = parse('MalayaItem',"a>18",{inStore:true});
            console.log(sb);
        });
        it("tricky conditional",function(){
            const sb = parse('MalayaItem',"['x','y'].includes(p)",{inStore:true});
            console.log(sb);
        });
    });
    describe("rule body",function(){
        it("bans empty",function(){
            assert.throws(()=>{
                parse('MalayaRuleBody',"",{inStore:true});
            });
        });
        it("only deletes",function(){
            const sb = parse('MalayaRuleBody',"-['a',{}]",{inStore:true});
            assert(Array.isArray(sb));
            assert.equal(sb.length,1);
            assert.equal(sb[0].type,'MalayaItem');
            assert.equal(sb[0].op,  '-');
        });
        it("deletes and adds",function(){
            const sb = parse('MalayaRuleBody',"-['a',{p}],+['b',{p}]",{inStore:true});
            assert(Array.isArray(sb));
            assert.equal(sb.length,2);
            sb.forEach(s=>assert(s.type==='MalayaItem'));
            assert.equal(sb[0].op,'-');
            assert.equal(sb[1].op,'+');
        });
        it("match and bind",function(){
            const sb = parse('MalayaRuleBody',"-['a',{p}],pp=p.p",{inStore:true});
            assert(Array.isArray(sb));
            assert.equal(sb.length,2);
            sb.forEach(s=>assert(s.type==='MalayaItem'));
            assert.equal(sb[0].op,       '-');
            assert.equal(sb[1].op,       '=');
            assert.equal(sb[1].expr.type,'AssignmentExpression');
        });
    });
    describe("rule",function(){
        it("bans empty",function(){
            assert.throws(()=>{
                parse('MalayaRule',"rule ()",{inStore:true});
            });
        });
        it("delete, add, bind, match",function(){
            const sb = parse('MalayaRule',"rule (-['a',{p}],+['b',{p}],pp=p.p,pp>18)",{inStore:true});
            assert.equal(sb.type,'MalayaRule');
            assert(Array.isArray(sb.items));
            const ss = sb.items;
            assert.equal(ss.length,4);
            ss.forEach(s=>assert(s.type==='MalayaItem'));
            assert.equal(ss[0].op,'-');
            assert.equal(ss[1].op,'+');
            assert.equal(ss[2].op,'=');
            assert.equal(ss[3].op,'?');
        });
    });
    describe("where expression XXX",function(){
        it("simple",function(){
            const sb = parse('Expression',"[x where ['what',{x,...}]]",{inStore:true});
            console.log(sb);
        });
    });
    describe("query",function(){
    });
    describe("invariant",function(){
    });
    describe("store",function(){
        it("empty",function(){
            const sb = parse('StoreBody',"{}")
            console.log(sb);
        });
        it("lone fact",function(){
            const sb = parse('StoreBody',"{['a',{p:17}];}");
            console.log(sb);
        });
        it("pre-existing 1",function(){
            const sb = parse('TopLevel',fs.readFileSync('test/bl/count.malaya'));
            console.log(sb);
        });
        it("pre-existing 2",function(){
            const sb = parse('TopLevel',fs.readFileSync('test/bl/middleware.malaya'));
            console.log(sb);
        });
        xit("pre-existing 3",function(){
            const sb = parse('TopLevel',fs.readFileSync('../flatland/index.malaya'));
            console.log(sb);
        });
    });
});
