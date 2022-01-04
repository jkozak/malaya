"use strict";

const acornPlugin = require('../acorn-plugin.js');

const  acorn = require('acorn');
const assert = require('assert').strict;

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

const parse = (nt,x)=>parser._parseFrom(nt,x,{ecmaVersion:2022});

describe("acorn parser plugin XXX",function(){
    it("handles empty store",function(){
        const sb = parse("StoreBody","{}")
        assert.equal(sb.items.length,0);
        assert.equal(sb.rules.length,0);
    });
});
