"use strict";

const parser = require("../esprima.js");

const     fs = require('fs');
const assert = require('assert').strict;

//N.B. esprima parser does not return parse trees
//     compatible with their JSON equivalants.
//     The difference is not shown by `util.inspect`
const parse = s=>JSON.parse(JSON.stringify(parser.parse(s)));

describe("parser for malaya language XXX", function() {

    it("parses very simple javascript", function() {
        const js = parse("const i=17;");
        assert.deepEqual(js,{type:"Program",body:[
            {type:"VariableDeclaration",
             declarations:[
                 {
                     type:"VariableDeclarator",
                     id:  {type:"Identifier",name:"i"},
                     init:{type:"Literal",value:17,raw:'17'} } ],
             kind:"const"} ]});
    });

    describe("main entry point", function() {
        it("parses empty store statement", function() {
            assert.deepEqual(parse("store {}"),
                             {type:"Program",body:[
                                 {type:'ExpressionStatement',
                                  expression:{type:"StoreExpression",body:[]} } ]});
        });
        it("parses standard empty store statement module", function() {
            assert.deepEqual(parse("exports.main = store {}"),
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
            assert.deepEqual(parse("store {['a',{}];}"),
                             {type:"Program",body:[
                                 {type:'ExpressionStatement',
                                  expression:{type:"StoreExpression",body:[
                                      {type:"ArrayExpression",elements:[
                                          {type:"Literal",value:"a",raw:"'a'"},
                                          {type:"ObjectExpression",properties:[]} ]} ]} } ]});
        });
        it("parses store statement with datum and rule", function() {
            assert.deepEqual(parse("store {['a',{}];\nrule (-['a',{}]);}").body[0].expression,
                             {type:"StoreExpression",body:[
                                 {type:"ArrayExpression",elements:[
                                     {type:"Literal",value:"a",raw:"'a'"},
                                     {type:"ObjectExpression",properties:[]} ]},
                                 {type:'RuleStatement',name:null,body:[
                                     {type:"DelItem",
                                      expression:{type:'ArrayExpression',elements:[
                                          {type:"Literal",value:'a',raw:"'a'"},
                                          {type:'ObjectExpression',properties:[]} ]} } ]} ]} );
        });
        it("parses simplest rule", function() {
            assert.deepEqual(parse("store {rule (a);}").body[0].expression,
                             {type:"StoreExpression",body:[
                                 {type:"RuleStatement",name:null,body:[
                                     {type:"MatchItem",
                                      expression:{type:"Identifier",name:"a"} } ]} ]} );
        });
        it("parses simpler rule", function() {
            assert.deepEqual(parse("store {rule (a,[b]);}").body[0].expression,
                             {type:"StoreExpression",body:[
                                 {type:"RuleStatement",name:null,body:[
                                     {type:"MatchItem",
                                      expression:{type:"Identifier",name:"a"} },
                                     {type:"MatchItem",
                                      expression:{type:'ArrayExpression',elements:[
                                          {type:"Identifier",name:"b"}]} }]} ]} );
        });
        it("parses delete rule", function() {
            assert.deepEqual(parse("store {rule (a,-[b]);}").body[0].expression,
                             {type:"StoreExpression",body:[
                                 {type:"RuleStatement",name:null,body:[
                                     {type:"MatchItem",
                                      expression:{type:"Identifier",name:"a"} },
                                     {type:"DelItem",
                                      expression:{type:'ArrayExpression',elements:[
                                          {type:"Identifier",name:"b"} ]} } ]} ]} );
        });
        it("parses bind rule", function() {
            assert.deepEqual(parse("store {rule (x = 10);}").body[0].expression,
                             {type:"StoreExpression",body:[
                                 {type:"RuleStatement",name:null,body:[
                                     {type:"BindItem",
                                      id:{type:'Identifier',name:'x'},
                                      expression:{type:"Literal",value:10,raw:"10"} } ]} ]} );
        });
        // regexp name capture not in nodejs as of version 8
        // it("parses malaya code", function() {
        //     const js = parse("store {rule (/(?<xxx>ABC)/);};");
        //     console.log("*** %j",js);
        // });
        it("parses test program", function() {
            parse(fs.readFileSync('test/bl/count.malaya','utf8'));
        });
        it("parses dns example program", function() {
            parse(fs.readFileSync('examples/dns.malaya','utf8'));
        });
    });
});
