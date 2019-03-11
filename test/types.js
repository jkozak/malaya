"use strict";

const  types = require('../types.js');

const assert = require('assert').strict;

describe("types", function() {
    const Js = JSON.stringify;
    describe("stringTo", function() {
        [[    types.Null,                          'Null'],
         [    types.Bool,                          'Bool'],
         [    types.Number,                        'Number'],
         [new types.Int(false,4),                  'UInt4'],
         [    types.UInt4,                         'UInt4'],
         [new types.Int(true,16),                  'Int16'],
         [    types.Int16,                         'Int16'],
         [new types.Or([]),                        'Or()'],
         [new types.Tuple([]),                     'Tuple()'],
         [new types.List(types.Bool),              'List(Bool)'],
         [new types.Map(types.String,types.UInt4), 'Map(String,UInt4)'],
         [new types.Record({p:types.UInt8,q:types.String}),
                                                   'Record(p:UInt8,q:String)']
        ].forEach(([t,n])=>it(`${t} name is ${n}`, ()=>{
            assert.equal(t.toString(),n);
        }));
    });

    describe("instancedBy", function() {

        describe("scalar types", function() {
            [[types.Null,   null],
             [types.Bool,   true],
             [types.Bool,   false],
             [types.Number, 182.1],
             [types.Number, NaN],
             [types.UInt1,  0],
             [types.UInt1,  1],
             [types.String, ''],
             [types.String, '1'],
            ].forEach(([t,v])=>it(`${t} matches ${Js(v)}`,()=>assert.ok(t.instancedBy(v))));
            [[types.Null,   false],
             [types.Bool,   null],
             [types.Number, null],
             [types.UInt1,  2],
             [types.UInt1,  -1],
             [types.UInt1,  NaN],
             [types.String, null],
             [types.String, 1],
             [types.String, []],
             [types.String, [1]],
            ].forEach(([t,v])=>it(`${t} doesn't match ${Js(v)}`,()=>assert.ok(!t.instancedBy(v))));
        });

        describe("Const", function() {
            [[new types.Const(418),  418],
             [new types.Const(null), null],
             [new types.Const([]),   []]
            ].forEach(([t,v])=>it(`${t} matches ${Js(v)}`,()=>assert.ok(t.instancedBy(v))));
            [[new types.Const(418),  419],
             [new types.Const(null), false],
             [new types.Const([]),   [1]]
            ].forEach(([t,v])=>it(`${t} doesn't match ${Js(v)}`,()=>assert.ok(!t.instancedBy(v))));
        });

        describe("Or()", function() {
            const or = new types.Or([]);
            [false,null,true,0,1,2,-1,NaN,'']
                .forEach(v=>it(`doesn't match ${Js(v)}`,()=>assert.ok(!or.instancedBy(v))));
        });

        describe("Or(Null)", function() {
            const orNull = new types.Or([types.Null]);
            it("matches null", function() {
                assert.ok(orNull.instancedBy(null));
            });
            [false,true,0,1,2,-1,NaN,'']
                .forEach(v=>it(`doesn't match ${Js(v)}`,()=>assert.ok(!orNull.instancedBy(v))));
        });

        describe("Tuple()", function() {
            const tupleEmpty = new types.Tuple([]);
            it("matches empty list", function() {
                assert.ok(tupleEmpty.instancedBy([]));
            });
            [false,true,0,1,2,-1,NaN,'',[1],[null],[0]]
                .forEach(v=>it(`doesn't match ${Js(v)}`,()=>assert.ok(!tupleEmpty.instancedBy(v))));
        });

        describe("List(Bool)", function() {
            const listBool = new types.List(types.Bool);
            [[],[false],[true],[false,true],[true,false,false]]
                .forEach(v=>it(`matches ${Js(v)}`,()=>assert.ok(listBool.instancedBy(v))));
            [false,true,0,1,2,-1,NaN,'',[1],[null],[0],[false,true,17]]
                .forEach(v=>it(`does not match ${Js(v)}`,()=>assert.ok(!listBool.instancedBy(v))));
        });

        describe("Map(String,List(Null))", function() {
            const mapSLN = new types.Map(types.String,new types.List(types.Null));
            [{},{fred:[]},{sid:[null]},{sid:[],joan:[null]}]
                .forEach(v=>it(`matches ${Js(v)}`,()=>assert.ok(mapSLN.instancedBy(v))));
            [false,true,0,1,2,-1,NaN,'',[1],[null],{bert:17},{jacqui:null}]
                .forEach(v=>it(`does not match ${Js(v)}`,()=>assert.ok(!mapSLN.instancedBy(v))));
        });

        describe("Record(p:Int)", function() {
            const recPQ = new types.Record({p:types.UInt2,q:types.Bool});
            [{p:1,q:false},{p:1,q:true},{p:0,q:false}]
                .forEach(v=>it(`matches ${Js(v)}`,()=>assert.ok(recPQ.instancedBy(v))));
            [false,[],null,{},{p:1},{q:false},{p:1,q:false,r:null},{p:4,q:true},{p:NaN,q:false}]
                .forEach(v=>it(`does not match ${Js(v)}`,()=>assert.ok(!recPQ.instancedBy(v))));
        });
    });

    describe("equal", function() {
        describe("self-equality of scalar types", function() {
            [types.Bool,types.UInt1,new types.Const(17)]
                .forEach(t=>it(t.toString(),()=>assert.ok(t.equal(t))));
        });
        describe("non-equality of distinct scalar types", function() {
            [[new types.Const(17),new types.Const(18)],
             [    types.Bool,         types.UInt1] ]
                .forEach(([t1,t2])=>it(`${t1}!==${t2}`,()=>assert.ok(!t1.equal(t2))));
        });
        describe("equality of equivalent, non-identical, types", function() {
            [()=>new types.List(types.Bool),
             ()=>new types.Tuple([]),
             ()=>new types.Record([]),
             ()=>new types.Map(types.String,types.Null) ]
                .forEach(fn=>it(`${fn()}`,()=>assert.ok(fn().equal(fn()))));
        });

    });

});
