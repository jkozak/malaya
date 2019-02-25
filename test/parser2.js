"use strict";

const parser = require("../parser2.js");

const     fs = require('fs');
const assert = require('assert').strict;

describe("PEG parser for malaya language XXX", function() {

    it("parses very simple javascript", function() {
        const js = parser.parse("const i=17;");
        assert.deepEqual(js,{type:"Program",body:[
            {type:"VariableDeclaration",bind:"const",declarations:[
                {
                    type:"VariableDeclarator",
                    id:  {type:"Identifier",name:"i"},
                    init:{"type":"Literal","value":17} } ]} ]});
    });

    describe("arrow functions", function() {
        it("parses an arrow function with no parms", function() {
            const js = parser.parse("()=>1");
            console.log("*** %j",js.body[0].expression);
        });
        it("parses an arrow function with one parm", function() {
            const js = parser.parse("err=>1");
            console.log("*** %j",js.body[0].expression);
        });
        it("parses an arrow function with (one) parm", function() {
            const js = parser.parse("(err)=>1");
            console.log("*** %j",js.body[0].expression);
        });
        it("parses an arrow function with no parms and clunky body", function() {
            const js = parser.parse("()=>{}");
            console.log("*** %j",js.body[0].expression);
        });
        it("parses lovely curry", function() {
            const js = parser.parse("a=>b=>a+b");
            console.log("*** %j",js.body[0].expression);
        });
    });

    describe("JsonMatch rule", function() {
        it("parses array matcher", function() {
            const js = parser.parse("['b']",{startRule:'JsonMatch'});
            assert.deepEqual(js,{type:"JsonArray",elements:[{type:"Literal",value:"b"}]});
        });
        it("parses more complex array matcher", function() {
            const js = parser.parse("['b',['a']]",{startRule:'JsonMatch'});
            assert.deepEqual(js,{type:"JsonArray",elements:[
                {type:"Literal",value:"b"},
                {type:"JsonArray",elements:[{type:"Literal",value:"a"}]} ]});
        });
        it("parses canonical fact format", function() {
            const js = parser.parse("['b',{x:88}]",{startRule:'JsonMatch'});
            assert.deepEqual(js,{type:"JsonArray",elements:[
                {type:"Literal",value:"b"},
                {type:"JsonObject",members:[
                    {type:"KeyValue",
                     key:  {type:'Identifier',name:'x'},
                     value:{type:'Literal',value:88} } ]} ]});
        });
        it("parses array with named ellipsis", function() {
            const js = parser.parse("['b',['a',...rs]]",{startRule:'JsonMatch'});
        });
        it("parses object with named ellipsis", function() {
            const js = parser.parse("['b',{id,...rs}]",{startRule:'JsonMatch'});
        });
        it("parses array with anonymous ellipsis", function() {
            const js = parser.parse("['b',['a',...]]",{startRule:'JsonMatch'});
        });
        it("parses object with anonymous ellipsis", function() {
            const js = parser.parse("['b',{id,...}]",{startRule:'JsonMatch'});
        });
    });

    describe("RuleItem rule", function() {
        it("parses delete rule item", function() {
            const js = parser.parse("-['b']",{startRule:'RuleItem'});
            assert.deepEqual(js,{type:"DelItem",expr:{type:"JsonArray",elements:[{type:"Literal",value:"b"}]}});
        });
        it("parses another delete rule item", function() {
            const js = parser.parse("-['a',{}]",{startRule:'RuleItem'});
            assert.deepEqual(js,{type:"DelItem",expr:{type:"JsonArray",elements:[
                {type:"Literal",value:"a"},
                {type:'JsonObject',members:[]} ]}});
        });
        it("parses eccentric expression", function() {
            const js = parser.parse("['b','c'].includes(a)",{startRule:'RuleItem'});
            assert.deepEqual(js,{type:"TestItem",expr:{
                type:"CallExpression",
                callee:{type:    "MemberExpression",
                        object:  {type:"ArrayExpression",
                                  elements:[{type:"Literal",value:"b"},{type:"Literal",value:"c"}]},
                        property:{type:"Identifier",name:"includes"},
                        computed:false},
                arguments:[{type:"Identifier",name:"a"}] }});
        });
    });

    describe("main entry point", function() {
        it("parses empty store statement", function() {
            const js = parser.parse("store {}");
            assert.deepEqual(js,{type:"Program",body:[
                {type:'ExpressionStatement',
                 expression:{type:"StoreExpression",body:[]} } ]});
        });
        it("parses standard empty store statement module", function() {
            const js = parser.parse("exports.main = store {}");
            assert.deepEqual(js,{type:"Program",body:[
                {type:'ExpressionStatement',
                 expression:{type:    'AssignmentExpression',
                             operator:'=',
                             left:    {type:'MemberExpression',
                                       object:{type:'Identifier',name:'exports'},
                                       property:{type:'Identifier',name:'main'},
                                       computed:false},
                             right:    {type:"StoreExpression",body:[]} } } ]});
        });
        it("parses store statement with datum", function() {
            const js = parser.parse("store {['a',{}];}");
            assert.deepEqual(js,{type:"Program",body:[
                {type:'ExpressionStatement',
                 expression:{type:"StoreExpression",body:[
                     {type:  "InitialValue",
                      value: {type:"ArrayExpression",elements:[
                          {type:"Literal",value:"a"},
                          {type:"ObjectExpression",properties:[]} ]} } ]} } ]});
        });
        it("parses store statement with datum and rule", function() {
            const js = parser.parse("store {['a',{}];\nrule (-['a',{}]);}");
            assert.deepEqual(js,{type:"Program",body:[
                {type:'ExpressionStatement',
                 expression:{type:"StoreExpression",body:[
                     {type:  "InitialValue",
                      value: {type:"ArrayExpression",elements:[
                          {type:"Literal",value:"a"},
                          {type:"ObjectExpression",properties:[]} ]} },
                     {type:'RuleStatement',body:[
                         {type:"DelItem",
                          expr:{type:'JsonArray',elements:[
                              {type:"Literal",value:'a'},
                              {type:'JsonObject',members:[]} ]} }
                     ]} ]} } ]});
        });
        it("parses simplest rule", function() {
            const js = parser.parse("store {rule (a);}");
            assert.deepEqual(js,{type:"Program",body:[
                {type:'ExpressionStatement',
                 expression:{type:"StoreExpression",body:[
                     {type:"RuleStatement",body:[
                         {type:"MatchItem",
                          expr:{type:"Identifier",name:"a"} } ]} ]} } ]});
        });
        it("parses simpler rule", function() {
            const js = parser.parse("store {rule (a,[b]);}");
            assert.deepEqual(js,{type:"Program",body:[
                {type:'ExpressionStatement',
                 expression:{type:"StoreExpression",body:[
                     {type:"RuleStatement",body:[
                         {type:"MatchItem",
                          expr:{type:"Identifier",name:"a"} },
                         {type:"MatchItem",
                          expr:{type:'JsonArray',elements:[{type:"Identifier",name:"b"}]} }]} ]} } ]});
        });
        it("parses delete rule", function() {
            const js = parser.parse("store {rule (a,-[b]);}");
            assert.deepEqual(js,{type:"Program",body:[
                {type:'ExpressionStatement',
                 expression:{type:"StoreExpression",body:[
                     {type:"RuleStatement",body:[
                         {type:"MatchItem",
                          expr:{type:"Identifier",name:"a"} },
                         {type:"DelItem",
                          expr:{type:'JsonArray',elements:[{type:"Identifier",name:"b"}]} }]} ]} } ]});
        });
        it("parses bind rule", function() {
            const js = parser.parse("store {rule (x = 10);}");
            assert.deepEqual(js,{type:"Program",body:[
                {type:'ExpressionStatement',
                 expression:{type:"StoreExpression",body:[
                     {type:"RuleStatement",body:[
                         {type:"BindItem",
                          dest:{type:'Identifier',name:'x'},
                          expr:{type:"Literal",value:10} } ]} ]} } ]});
        });
        // name capture not in nodejs as of version 8
        // it("parses malaya code", function() {
        //     const js = parser.parse("store {rule (/(?<xxx>ABC)/);};");
        //     console.log("*** %j",js);
        // });
        it("parses test program", function() {
            parser.parse(fs.readFileSync('test/bl/count.malaya','utf8'));
        });
        it("parses dns example program", function() {
            this.timeout(20000);
            parser.parse(fs.readFileSync('examples/dns.malaya','utf8'));
        });
    });
});
