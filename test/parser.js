"use strict";

const  parser = require("../parser.js");

const  assert = require('assert').strict;
const    temp = require('temp');
const      fs = require('fs');

temp.track();

describe("parser",function(){
    describe("nasty cases",function(){
        it("handles RWE 1",function(){
            const ast = parser.parse(fs.readFileSync('test/bl/real-world-fail-1.malaya'));
            console.log(ast.body[0].expression.right.body[0].args);
            //console.log(`${JSON.stringify(ast)}`)
        });
    });
    describe("visit",function() {
        it("should visit StoreDeclaration",function(){
            let ok = false;
            parser.visit(parser.parse("store {}"),
                         {
                             visitStoreDeclaration: function(node) {
                                 ok = true;
                                 return false;
                             } });
            assert(ok);
        });
        it("should visit RuleStatement",function(){
            let n = 0;
            parser.visit(parser.parse("store {rule (['a'])}"),
                         {
                             visitStoreDeclaration: function(node) {
                                 n++;
                                 this.traverse(node);
                             },
                             visitRuleStatement: function(node) {
                                 n++;
                                 this.traverse(node);
                             } });
            assert.equal(n,2);
        });
        it("should visit ItemExpressions",function(){
            let n = 0;
            parser.visit(parser.parse("store {rule (['a',a],['b',a])}"),
                         {
                             visitStoreDeclaration: function(node) {
                                 n++;
                                 this.traverse(node);
                             },
                             visitRuleStatement: function(node) {
                                 n++;
                                 this.traverse(node);
                             },
                             visitItemExpression: function(node) {
                                 n++;
                                 this.traverse(node);
                             }});
            assert.equal(n,4);
        });
    });
});
