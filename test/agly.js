"use strict";

const   agly = require('../agly.js');

const   util = require('../util.js');
const parser = require('../esprima.js');

const assert = require('assert').strict;

const  {estFor,nodeFor,b} = agly;

//N.B. esprima parser does not return parse trees
//     compatible with their JSON equivalants.
//     The difference is not shown by `util.inspect`
const parse = s=>JSON.parse(JSON.stringify(parser.parse(s)));

function estStrip(est) {        // remove stuff that gets in the way when testing
    est = util.deepClone(est);
    agly.walk(est,e=>{
        delete e._id;
        delete e.comments;
        delete e.loc;
        delete e.typeAnnotation;
        return e;
    });
    return est;
}

describe("agly", function() {
    describe("simple case", function() {
        it("defines an agly context", function() {
            new agly.Tree({
                Program: agly.Node,
            });
        });
    });

    describe("walk", function() {
        it("copies", function() {
            assert.deepEqual(agly.walk({p:'a'},est=>est),{p:'a'});
        });
        it("does replacement", function() {
            assert.deepEqual(agly.walk({p:'a'},est=>({a:2})),{a:2});
        });
    });

    describe("estStrip", function() {
        it("shallow strips _id tags", function() {
            assert.deepEqual(estStrip({type:'Empty',_id:88}),
                             {type:'Empty'} );
        });
        it("deep strips _id tags", function() {
            assert.deepEqual(estStrip({type:'Node',_id:88,node2:{type:'Node2',_id:89}}),
                             {type:'Node',node2:{type:'Node2'}} );
        });
        it("handles absense of _id gracefully", function() {
            assert.deepEqual(estStrip({type:'Node',node2:{type:'Node2'}}),
                             {type:'Node',node2:{type:'Node2'}} );
        });
        it("deep strips _id tags in arrays", function() {
            assert.deepEqual(estStrip({type:'Node',_id:88,elems:[{type:'Node2',_id:90},{type:'Node3',_id:91}]}),
                             {type:'Node',elems:[{type:'Node2'},{type:'Node3'}]} );
        });
    });

    describe("code fragment handling", function() {
        const frags = parse(`({
            rep:function(){return REPLACE_VALUE;},
            ins:function(){INSERT_STUFF:;}
        })`);
        it("fails if needed substitution unspecified", function() {
            assert.throws(()=>agly.makeCodeFragment('rep',{},frags));
        });
        it("does simple replacement", function() {
            const frag = agly.makeCodeFragment('rep',{REPLACE_VALUE:b.literal(1985)},frags);
            assert.deepEqual(estStrip(frag),
                             estStrip(b.blockStatement([b.returnStatement(b.literal(1985))])) );
        });
        it("does simple insertion", function() {
            const frag = agly.makeCodeFragment('ins',{INSERT_STUFF:b.returnStatement(b.literal(44))},frags);
            assert.deepEqual(estStrip(frag),
                             estStrip(b.blockStatement([b.returnStatement(b.literal(44))])) );
        });
    });


    describe("agly", function() {
        let  est;
        let tree;
        before(()=>{est=parse(`function fred(){const i=3;log(i);}`);});
        it("creates a tree", function() {
            tree = agly.makeTree();
        });
        it("attaches to code", function() {
            tree.build(est);
        });
        it("attaches root nicely", function() {
            assert.deepEqual(nodeFor(estFor(tree.root)),tree.root);
        });
        it("attaches first body element nicely", function() {
            assert.deepEqual(estFor(nodeFor(estFor(tree.root).body[0])),
                             estFor(tree.root).body[0]);
        });
        it("does a null rewrite", function() {
            assert.deepEqual(estStrip(tree.root.rewrite),
                             estStrip(estFor(tree.root)) );
        });
        it("finds top-level bindings", function() {
            assert.deepEqual(Object.keys(tree.root.bindings),['fred']);
        });
        it("finds bindings in fred", function() {
            const bodyN = nodeFor(estFor(tree.root).body[0].body.body[0]);
            assert.deepEqual(bodyN.bindings,{fred:{},i:{}});
        });
    });
    describe("utilities find js code", function() {
        let  est;
        let tree;
        before(()=>{
            est  = parse(`function fred(){const i=3;log(i);}`);
            tree = agly.makeTree();
            tree.build(est);
            assert(tree.root);
        });
        describe("partiallyMatchNode", function() {
            it("matches top-level", function() {
                assert(agly.partiallyMatchNode(tree.root,{type:'Program'}));
            });
            it("detects mismatch at top-level", function() {
                assert(!agly.partiallyMatchNode(tree.root,{type:'Programme'}));
            });
        });
        describe("tree.find(Sole)?", function() {
            it("finds the top level", function() {
                const ans = tree.find({type:'Program'});
                assert.equal(ans.length,1);
                assert.equal(estFor(ans[0]).type,'Program');
            });
            it("finds the function", function() {
                const ans = tree.find({type:'FunctionDeclaration'});
                assert.equal(ans.length,1);
                assert.equal(estFor(ans[0]).type,'FunctionDeclaration');
            });
            it("finds the sole function", function() {
                const ans = tree.findSole({type:'FunctionDeclaration'});
                assert.equal(estFor(ans).type,'FunctionDeclaration');
            });
            it("finds the function another way", function() {
                const ans = tree.findSole({params:[]});
                assert.equal(estFor(ans).type,'FunctionDeclaration');
            });
            it("finds multiple things", function() {
                const ans = tree.find({type:'Identifier',name:'i'});
                assert.equal(ans.length,2);
            });
            it("finds by value", function() {
                assert.deepEqual(estStrip(estFor(tree.findSole({value:3}))),
                                 {type:'Literal',value:3,raw:'3'});
            });
            it("finds nested structure", function() {
                const ans = tree.findSole({type:'VariableDeclarator',id:{name:'i'}});
                assert.equal(estFor(ans).type,'VariableDeclarator');
                assert.equal(estFor(ans).id.name,'i');
            });
        });
    });

    describe("utilities find malaya code", function() {
        let tree;
        describe("match and find", function() {
            before(()=>{
                tree = agly.makeTree();
                tree.build(parse(`store {rule (-[a]);}`));
            });
            it("matches an array element", function() {
                const est = estFor(tree.root).body[0].expression.body[0].body[0].expression;
                assert(est);
                assert(agly.partiallyMatchNode(nodeFor(est),
                                               {elements:[{name:'a'}]}));
            });
            it("finds an array element", function() {
                const ans = tree.findSole({elements:[{name:'a'}]});
                //console.log("*** ans %j",ans.est);
            });
        });
        describe("tree.find(Sole)?", function() {
            before(()=>{
                tree = agly.makeTree();
                tree.build(parse(`store {rule (-['a',{p:[v],w}]);}`));
            });
            it("finds `w`", function() {
                assert.deepEqual(estStrip(estFor(tree.findSole({value:{name:'w'}}))),
                                 {key:       {type:'Identifier',name:'w'},
                                  value:     {type:'Identifier',name:'w'},
                                  kind:      'init',
                                  method:    false,
                                  type:      'Property',
                                  shorthand: true} );
            });
        });
    });

    describe("agly on trivial store", function() {
        let  est;
        let tree;
        let ruleOrig;
        before(()=>{est=parse(`store {rule (a);}`);});
        it("creates a tree", function() {
            tree = agly.makeTree();
        });
        it("attaches to code", function() {
            tree.build(est);
        });
        it("does a non-null rewrite", function() {
            assert.notDeepEqual(estStrip(tree.root.rewrite),
                                estStrip(estFor(tree.root)) );
        });
        it("mangles", function() {
            const rule = tree.root.rewrite.body[0].expression.body[0];
            assert.equal(rule.type,'RuleStatement');
            assert.equal(rule.body[0].expression.name,'a_'); // mangled
        });
        it("finds original rule", function() {
            ruleOrig = estFor(tree.root).body[0].expression.body[0];
        });
        it("doesn't mangle original", function() {
            assert.equal(ruleOrig.body[0].expression.name,'a');
        });
        it("mangling noted in node", function() {
            assert.equal(nodeFor(ruleOrig.body[0].expression).name,'a_');
        });
    });

    describe("accessors", function() {
        let tree;
        before(()=>{
            tree = agly.makeTree();
            tree.build(parse(`store {rule (-['a',{p:[v],w}]);}`));
        });
        it("w accessor is simple", function() {
            const w = tree.findSole({value:{name:'w'}});
            assert.deepEqual(w.accessor,
                             [{type:'Rule',  index:0},
                              {type:'Array', index:1},
                              {type:'Object',index:1} ] );
        });
        it("v accessor is less simple", function() {
            const els = tree.findSole({elements:[{name:'v'}]});
            const   v = nodeFor(estFor(els).elements[0]);
            assert.deepEqual(v.accessor,
                             [{type:'Rule',  index:0},
                              {type:'Array', index:1},
                              {type:'Object',index:0},
                              {type:'Array', index:0} ] );
        });
    });

});
