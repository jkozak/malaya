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

describe("acorn parser plugin",function(){
    describe("item",function(){
        it("list",function(){
            const sb = parse('ItemExpression',"['a',{}]",{inStore:true});
            assert.equal(sb.type,'ItemExpression');
            assert.deepEqual(sb.attrs,{});
            assert.equal(sb.op,'M');
        });
        it("list with ellipsis",function(){
            const sb = parse('ItemExpression',"['a',...]",{inStore:true});
            assert.equal(sb.type,'ItemExpression');
            assert.equal(sb.op,'M');
        });
        it("list with named ellipsis",function(){
            const sb = parse('ItemExpression',"['a',...x]",{inStore:true});
            assert.equal(sb.type,'ItemExpression');
            assert.equal(sb.op,'M');
        });
        it("list with penultimate ellipsis",function(){
            const sb = parse('ItemExpression',"['a',...,x]",{inStore:true});
            assert.equal(sb.type,'ItemExpression');
            assert.equal(sb.op,'M');
        });
        it("object",function(){ //
            const sb = parse('ItemExpression',"{a:2}",{inStore:true});
            assert.equal(sb.type,'ItemExpression');
            assert.equal(sb.op,'M');
        });
        it("object with ellipsis",function(){ //
            const sb = parse('ItemExpression',"{a:2,...}",{inStore:true});
            assert.equal(sb.type,'ItemExpression');
            assert.equal(sb.op,'M');
        });
        it("object with named ellipsis",function(){ //
            const sb = parse('ItemExpression',"{...x,a:2}",{inStore:true});
            assert.equal(sb.type,'ItemExpression');
            assert.equal(sb.op,'M');
        });
        it("object with implicit binding",function(){ //
            const sb = parse('ItemExpression',"{x,a:2}",{inStore:true});
            assert.equal(sb.type,'ItemExpression');
            assert.equal(sb.op,'M');
        });
        it("conditional",function(){
            const sb = parse('ItemExpression',"a>18",{inStore:true});
            assert.equal(sb.type,'ItemExpression');
            assert.equal(sb.op,'?');
        });
        it("tricky conditional",function(){
            const sb = parse('ItemExpression',"['x','y'].includes(p)",{inStore:true});
            assert.equal(sb.type,'ItemExpression');
            assert.equal(sb.op,'?');
        });
        it("shriek conditional",function(){
            const sb = parse('ItemExpression',"!a",{inStore:true});
            assert.equal(sb.type,'ItemExpression');
            assert.equal(sb.op,'?');
        });
        it("subtle ellipsis",function(){
            const sb = parse('ItemExpression',"-['disconnect_me',...,{port}]",{inStore:true});
            assert.equal(sb.type,'ItemExpression');
            assert.equal(sb.op,'-');
            const e = sb.expr;
            assert.equal(e.type,'ArrayExpression');
            assert.equal(e.elements.length,3);
        });
    });
    describe("rule body",function(){
        it("bans empty",function(){
            assert.throws(()=>{
                parse('RuleStatementBody',"",{inStore:true});
            });
        });
        it("only deletes",function(){
            const sb = parse('RuleStatementBody',"-['a',{}]",{inStore:true});
            assert(Array.isArray(sb));
            assert.equal(sb.length,1);
            assert.equal(sb[0].type,'ItemExpression');
            assert.equal(sb[0].op,  '-');
        });
        it("deletes and adds",function(){
            const sb = parse('RuleStatementBody',"-['a',{p}],+['b',{p}]",{inStore:true});
            assert(Array.isArray(sb));
            assert.equal(sb.length,2);
            sb.forEach(s=>assert(s.type==='ItemExpression'));
            assert.equal(sb[0].op,'-');
            assert.equal(sb[1].op,'+');
        });
        it("match and bind",function(){
            const sb = parse('RuleStatementBody',"-['a',{p}],pp=p.p",{inStore:true});
            assert(Array.isArray(sb));
            assert.equal(sb.length,2);
            sb.forEach(s=>assert(s.type==='ItemExpression'));
            assert.equal(sb[0].op,       '-');
            assert.equal(sb[1].op,       '=');
            assert.equal(sb[1].expr.type,'AssignmentExpression');
        });
    });
    describe("rule",function(){
        it("bans empty",function(){
            assert.throws(()=>{
                parse('RuleStatement',"rule ()",{inStore:true});
            });
        });
        it("delete, add, bind, match",function(){
            const sb = parse('RuleStatement',"rule (-['a',{p}],+['b',{p}],pp=p.p,pp>18)",{inStore:true});
            assert.equal(sb.type,'RuleStatement');
            assert(sb.id.name.startsWith('%rule-'));
            assert(Array.isArray(sb.items));
            const ss = sb.items;
            assert.equal(ss.length,4);
            ss.forEach(s=>assert(s.type==='ItemExpression'));
            assert.equal(ss[0].op,'-');
            assert.equal(ss[1].op,'+');
            assert.equal(ss[2].op,'=');
            assert.equal(ss[3].op,'?');
        });
        it("can be named",function(){
            const rs = parse('RuleStatement',"rule rool(-['a',{p}])",{inStore:true});
            assert.equal(rs.type,'RuleStatement');
            assert.equal(rs.id.name,'rool');
        });
    });
    describe("where expression",function(){
        it("simple",function(){
            const sb = parse('Expression',"[x where ['what',{x,...}]]",{inStore:true});
            assert.equal(sb.type,'WhereExpression');
        });
        it("fails if not in store",function(){
            assert.throws(()=>parse('Expression',"[x where ['what',{x,...}]]"));
        });
        it("fails if in rule",function(){
            assert.throws(()=>parse('Expression',"[x where ['what',{x,...}]]",
                                    {inStore:true,inRule:true} ));
        });
    });
    describe("query",function(){
        it("simple",function(){
            const sb = parse('QueryWhereStatement',
                             "query findUserByID(id) [{f,i} where ['user',{id,f,i,...}]]",
                             {inStore:true});
            assert.equal(sb.type,'QueryWhereStatement');
        });
    });
    describe("invariant",function(){
    });
    describe("store",function(){
        it("empty",function(){
            const sb = parse('StoreBody',"{}");
            assert.equal(sb.type,'StoreExpression');
            assert.equal(sb.body.length,0);
        });
        it("lone fact",function(){
            const sb = parse('StoreBody',"{['a',{p:17}];}");
            assert.equal(sb.type,'StoreExpression');
            assert.equal(sb.body.length,1);
            const i0 = sb.body[0];
            assert.equal(i0.type,'ArrayExpression');
            assert.deepEqual(i0.attrs,{});
        });
        it("lone query",function(){
            const sb = parse('StoreBody',"{query q(a) [i where ['a',{a,i}]];}");
            assert.equal(sb.type,'StoreExpression');
            assert.equal(sb.body.length,1);
        });
        it("count",function(){
            const tl = parse('TopLevel',fs.readFileSync('test/bl/count.malaya'));
            assert.deepEqual(tl.attrs,{});
        });
        it("out",function(){
            const tl = parse('TopLevel',fs.readFileSync('test/bl/out.chrjs'));
            assert.deepEqual(tl.attrs,{});
        });
        it("middleware",function(){
            parse('TopLevel',fs.readFileSync('test/bl/middleware.malaya'));
        });
        it("dns demo",function(){
            const tl = parse('TopLevel',fs.readFileSync('examples/dns.malaya'));
            assert.deepEqual(tl.attrs,{});
        });
    });
    describe("plain JS",function(){
        it("engine.js",function(){
            const tl = parse('TopLevel',fs.readFileSync('engine.js'));
            assert.deepEqual(tl.attrs,{});
        });
    });
});
