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
            assert.deepEqual(js.body[0].expression,
                             {type:  "FunctionExpression",
                              id:    null,
                              params:[],
                              body:  {type:"BlockStatement",body:[
                                  {type:"ReturnStatement",argument:{type:"Literal",value:1}} ]} });
        });
        it("parses an arrow function with one parm", function() {
            const js = parser.parse("err=>1");
            assert.deepEqual(js.body[0].expression,
                             {type:  "FunctionExpression",
                              id:    null,
                              params:[{type:'Identifier',name:'err'}],
                              body:  {type:"BlockStatement",body:[
                                  {type:"ReturnStatement",argument:{type:"Literal",value:1}} ]} });
        });
        it("parses an arrow function with (one) parm", function() {
            const js = parser.parse("(err)=>1");
            assert.deepEqual(js.body[0].expression,
                             {type:  "FunctionExpression",
                              id:    null,
                              params:[{type:'Identifier',name:'err'}],
                              body:  {type:"BlockStatement",body:[
                                  {type:"ReturnStatement",argument:{type:"Literal",value:1}} ]} });
        });
        it("parses an arrow function with no parms and clunky body", function() {
            const js = parser.parse("()=>{}");
            assert.deepEqual(js.body[0].expression,
                             {type:  "FunctionExpression",
                              id:    null,
                              params:[],
                              body:  {type:"BlockStatement",body:[]} });
        });
        it("parses lovely curry", function() {
            const js = parser.parse("a=>b=>a+b");
            assert.deepEqual(js.body[0].expression,
                             {type:"FunctionExpression",
                              id:null,
                              params:[{"type":"Identifier","name":"a"}],
                              body:{type:"BlockStatement",body:[
                                  {type:"ReturnStatement",
                                   argument:{type:"FunctionExpression",
                                             id:  null,
                                             params:[
                                                 {type:"Identifier",
                                                  name:"b"}],
                                             body:{type:"BlockStatement",
                                                   body:[{type:"ReturnStatement",
                                                          argument:{type:"BinaryExpression",
                                                                    operator:"+",
                                                                    left:{type:"Identifier",
                                                                          name:"a"},
                                                                    right:{type:"Identifier",
                                                                           name:"b"} } }] } } } ]} });
        });
    });

    describe("JsonMatch rule", function() {
        it("parses array matcher", function() {
            const js = parser.parse("['b']",{startRule:'JsonMatch'});
            assert.deepEqual(js,{type:"ArrayExpression",elements:[{type:"Literal",value:"b"}]});
        });
        it("parses more complex array matcher", function() {
            const js = parser.parse("['b',['a']]",{startRule:'JsonMatch'});
            assert.deepEqual(js,{type:"ArrayExpression",elements:[
                {type:"Literal",value:"b"},
                {type:"ArrayExpression",elements:[{type:"Literal",value:"a"}]} ]});
        });
        it("parses canonical fact format", function() {
            const js = parser.parse("['b',{x:88}]",{startRule:'JsonMatch'});
            assert.deepEqual(js,{type:"ArrayExpression",elements:[
                {type:"Literal",value:"b"},
                {type:"ObjectExpression",properties:[
                    {key:  {type:'Identifier',name:'x'},
                     value:{type:'Literal',value:88} } ]} ]});
        });
        it("parses array with named ellipsis", function() {
            assert.deepEqual(parser.parse("['b',['a',...rs]]",{startRule:'JsonMatch'}),
                             {type:"ArrayExpression",elements:[
                                 {type:"Literal",value:"b"},
                                 {type:"ArrayExpression",elements:[
                                     {type:"Literal",value:"a"},
                                     {type:"Ellipsis",id:{type:"Identifier",name:"rs"}} ]} ]} );
        });
        it("parses object with named ellipsis", function() {
            assert.deepEqual(parser.parse("['b',{id,...rs}]",{startRule:'JsonMatch'}),
                             {type:"ArrayExpression",elements:[
                                 {type:"Literal",value:"b"},
                                 {type:"ObjectExpression",properties:[
                                     {key:{type:"Identifier",name:"id"},value:{type:"Identifier",name:"id"}},
                                     {key:null,value:{type:"Ellipsis",name:{type:"Identifier",name:"rs"}}} ]} ]} );
        });
        it("parses array with anonymous ellipsis", function() {
            assert.deepEqual(parser.parse("['b',['a',...]]",{startRule:'JsonMatch'}),
                             {type:"ArrayExpression",elements:[
                                 {type:"Literal",value:"b"},
                                 {type:"ArrayExpression",elements:[
                                     {type:"Literal",value:"a"},
                                     {type:"Ellipsis",id:null} ]} ]} );
        });
        it("parses object with anonymous ellipsis", function() {
            assert.deepEqual(parser.parse("['b',{id,...}]",{startRule:'JsonMatch'}),
                             {type:"ArrayExpression",elements:[
                                 {type:"Literal",value:"b"},
                                 {type:"ObjectExpression",properties:[
                                     {key:{type:"Identifier",name:"id"},value:{type:"Identifier",name:"id"}},
                                     {key:null,value:{type:"Ellipsis",name:null}} ]} ]} );
        });
    });

    describe("RuleItem rule", function() {
        it("parses delete rule item", function() {
            const js = parser.parse("-['b']",{startRule:'RuleItem'});
            assert.deepEqual(js,{type:"DelItem",expr:{type:"ArrayExpression",elements:[{type:"Literal",value:"b"}]}});
        });
        it("parses another delete rule item", function() {
            const js = parser.parse("-['a',{}]",{startRule:'RuleItem'});
            assert.deepEqual(js,{type:"DelItem",expr:{type:"ArrayExpression",elements:[
                {type:"Literal",value:"a"},
                {type:'ObjectExpression',properties:[]} ]}});
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
            assert.deepEqual(parser.parse("store {}"),
                             {type:"Program",body:[
                                 {type:'ExpressionStatement',
                                  expression:{type:"StoreExpression",body:[]} } ]});
        });
        it("parses standard empty store statement module", function() {
            assert.deepEqual(parser.parse("exports.main = store {}"),
                             {type:"Program",body:[
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
            assert.deepEqual(parser.parse("store {['a',{}];}"),
                             {type:"Program",body:[
                                 {type:'ExpressionStatement',
                                  expression:{type:"StoreExpression",body:[
                                      {type:  "InitialValue",
                                       value: {type:"ArrayExpression",elements:[
                                           {type:"Literal",value:"a"},
                                           {type:"ObjectExpression",properties:[]} ]} } ]} } ]});
        });
        it("parses store statement with datum and rule", function() {
            assert.deepEqual(parser.parse("store {['a',{}];\nrule (-['a',{}]);}").body[0].expression,
                             {type:"StoreExpression",body:[
                                 {type:  "InitialValue",
                                  value: {type:"ArrayExpression",elements:[
                                      {type:"Literal",value:"a"},
                                      {type:"ObjectExpression",properties:[]} ]} },
                                 {type:'RuleStatement',body:[
                                     {type:"DelItem",
                                      expr:{type:'ArrayExpression',elements:[
                                          {type:"Literal",value:'a'},
                                          {type:'ObjectExpression',properties:[]} ]} } ]} ]} );
        });
        it("parses simplest rule", function() {
            assert.deepEqual(parser.parse("store {rule (a);}").body[0].expression,
                             {type:"StoreExpression",body:[
                                 {type:"RuleStatement",body:[
                                     {type:"MatchItem",
                                      expr:{type:"Identifier",name:"a"} } ]} ]} );
        });
        it("parses simpler rule", function() {
            assert.deepEqual(parser.parse("store {rule (a,[b]);}").body[0].expression,
                             {type:"StoreExpression",body:[
                                 {type:"RuleStatement",body:[
                                     {type:"MatchItem",
                                      expr:{type:"Identifier",name:"a"} },
                                     {type:"MatchItem",
                                      expr:{type:'ArrayExpression',elements:[
                                          {type:"Identifier",name:"b"}]} }]} ]} );
        });
        it("parses delete rule", function() {
            assert.deepEqual(parser.parse("store {rule (a,-[b]);}").body[0].expression,
                             {type:"StoreExpression",body:[
                                 {type:"RuleStatement",body:[
                                     {type:"MatchItem",
                                      expr:{type:"Identifier",name:"a"} },
                                     {type:"DelItem",
                                      expr:{type:'ArrayExpression',elements:[
                                          {type:"Identifier",name:"b"} ]} } ]} ]} );
        });
        it("parses bind rule", function() {
            assert.deepEqual(parser.parse("store {rule (x = 10);}").body[0].expression,
                             {type:"StoreExpression",body:[
                                 {type:"RuleStatement",body:[
                                     {type:"BindItem",
                                      dest:{type:'Identifier',name:'x'},
                                      expr:{type:"Literal",value:10} } ]} ]} );
        });
        // regexp name capture not in nodejs as of version 8
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
