"use strict";

// attribute grammar

const         _ = require('underscore');
const        fs = require('fs');
const    recast = require('recast');


const      util = require('./util.js');
const    assert = require('assert').strict;
const    parser = require('./parser.js');

const fragments = parser.parse(fs.readFileSync('./code-fragments.js','utf8'));

const b = exports.b = recast.types.builders;

const mapIdNodeEst = new Map(); // id -> [node,est]
let      idNodeEst = 0;

function clearObjectExcept(o,saves) {
    Object.keys(o).forEach(k=>{
        if (!saves.includes(k) && o.hasOwnProperty(k))
            delete o[k];
    });
}

const walk = exports.walk = (est,fn)=>{
    const est1 = Object.assign({},fn(est));
    clearObjectExcept(est,['_id']);
    Object.assign(est,est1);
    Object.keys(est).forEach(k=>{
        const v = est[k];
        if (Array.isArray(v))
            v.forEach(w=>walk(w,fn));
        else if (v && typeof v==='object')
            walk(v,fn);
    });
    return est;
};

// code fragment tools

const makeCodeFragment = exports.makeCodeFragment = (name,substs,frags)=>{ // eslint-disable-line no-unused-vars
    let frag;
    if (!frags)
        frags = fragments;
    frags.body.forEach(st=>{
        // the fragments file can optionally contain a "use strict"
        if (st.type==='ExpressionStatement' && st.expression.type==='ObjectExpression')
            st.expression.properties.forEach(prop=>{
                if ((prop.key.type==='Identifier' && prop.key.name===name) ||
                    (prop.key.type==='Literal'    && prop.key.value===name) ) {
                    if (frag)
                        throw new Error("too many expressions in fragment file");
                    assert.equal(prop.value.type,'FunctionExpression');
                    frag = prop.value.body;
                }
            });
    });
    if (!frag)
        throw new Error(`code fragment ${name} not found`);
    frag = util.deepClone(frag);
    assert.ok(frag);
    walk(frag,est=>{
        if (!est.type)
            return est;
        if (est.type==='Identifier' && est.name.startsWith('REPLACE_')) {
            assert.ok(substs[est.name]);
            return substs[est.name];
        }
        if (est.type==='LabelledStatement' && est.label.name.startsWith('INSERT_')) {
            assert.equal(est.body.type,'EmptyStatement');
            assert.ok(substs[est.label.name]);
            est = substs[est.label.name];
        }
        return est;
    });
    return frag;
};


// attribute grammar tools

const Node = exports.Node = class {
    constructor(est,tree,parent,key,index) {
        const node = this;
        node.parent = parent;     // another Node or null for root
        node.key    = key;        // slot of parent that references this node or null
        node.index  = index;      // index of key slot above (where relevant) or null

        est._id = node._id = idNodeEst++;
        mapIdNodeEst.set(node._id,Object.freeze({node,est}));

        Object.freeze(est);
        Object.freeze(this);
    }
};

const nodeFor = exports.nodeFor = est=>mapIdNodeEst .get(est._id).node;
const estFor  = exports.estFor  = node=>mapIdNodeEst.get(node._id).est;

const partiallyMatchNode = exports.partiallyMatchNode = (node,spec)=>{
    const est = estFor(node);
    if (typeof node!=='object' || typeof spec!=='object')
        return false;
    for (const k in spec) {
        if (Array.isArray(spec[k])) {
            if (!Array.isArray(est[k]))
                return false;
            for (const i in estFor(node)[k])
                if (!partiallyMatchNode(nodeFor(est[k][i]),spec[k][0]))
                    return false;
        } else if (typeof spec[k]==='object') {
            if (typeof est[k]!=='object' ||
                !partiallyMatchNode(nodeFor(est[k]),spec[k]))
                return false;
        } else if (est[k]!==spec[k])
            return false;
    }
    return true;
};

exports.dumpNode = node=>{
    // +++
};

// +++ infiltrate caching of attributes +++
//     Proxy?  defineProperty?  gen code?

const Tree = exports.Tree = class {
    constructor(type2nodeClass,defClass) {
        const tree = this;
        tree.t2nc     = type2nodeClass;
        tree.defClass = defClass;
        tree.root     = null;
    }
    getClassForEstType(type,parent,key) {
        const tree = this;
        if (!type) {
            // these do not have type fields in ESTree, presumably because they're
            // always in one particular slot.  So we award them one.
            if (estFor(parent).type==='ObjectExpression' && key==='properties')
                type = 'ObjectProperty';
        }
        return (type in tree.t2nc) ? tree.t2nc[type] : tree.defClass;
    }
    _build(est,parent=null,key=null,index=null) {
        const tree = this;
        const node = new (tree.getClassForEstType(est.type,parent,key))(est,this,parent,key,index);
        if (!parent)
            tree.root = node;
        Object.keys(est).forEach(k=>{
            if (!['type'].includes(k)) {
                if (Array.isArray(est[k]))
                    est[k].forEach((e,i)=>tree._build(e,node,k,i));
                else if (typeof est[k]==='object')
                    tree._build(est[k],node,k);
            }
        });
    }
    build(est) {
        this._build(est);
        Object.freeze(this);
    }
    map(ests) {return ests.map(est=>nodeFor(est));}

    // the following are for testing
    _walk(fn,node) {
        Object.keys(estFor(node)).forEach(k=>{
            const v = estFor(node)[k];
            if (Array.isArray(v)) {
                v.forEach((e,i)=>{
                    const n = nodeFor(e);
                    fn(n,node,k,i);
                    this._walk(fn,n);
                });
            } else if (typeof v==='object') {
                const n = nodeFor(v);
                fn(n,node,k,null);
                this._walk(fn,n);
            }
        });
    }
    walk(fn,node) {
        node = node || this.root;
        fn(node,null,null);
        this._walk(fn,node);
    }
    find(spec) {
        const ans = [];
        this.walk((node,parent,key,index)=>{
            if (partiallyMatchNode(node,spec))
                ans.push(node);
        });
        return ans;
    }
    findSole(spec) {
        const xs = this.find(spec);
        if (xs.length!==1)
            throw new Error(`bad number of matches: ${xs.length}`);
        return xs[0];
    }
};


// The attribute grammar itself

class MyNode extends Node {

    // the point of it all
    get rewrite() {
        const est = estFor(this);
        return _.object(Object.keys(est)
                        .map(k=>{
                            if (k==='type')
                                return [k,est.type];
                            else if (k==='_id')
                                return null; // delete _id
                            else {
                                const ke = est[k];
                                if (Array.isArray(ke))
                                    return [k,ke.map(e=>nodeFor(e).rewrite)];
                                else if (typeof ke==='object')
                                    return [k,nodeFor(ke).rewrite];
                                else
                                    return [k,ke];
                            }
                        })
                        .filter(x=>x) );
    }

    // default values
    get boundHere() {return null;}

    // inherited attrs
    get accessor() {
        const pa = this.parent.accessor;
        if (Array.isArray(pa)                 &&
            typeof pa[pa.length-1]==='object' &&
            typeof this.index==='number') {
            return pa.slice(0,pa.length-1).concat([{type:pa[pa.length-1].type,index:this.index}]);
        } else
            return this.isInStore ? pa : null;
    }
    get bindings() {
        return this.parent ? this.parent.bindings : {};
    }
    get isInStore() {
        return this.parent ? this.parent.isInStore : false;
    }
    get storeOutsideBindings() {
        return this.isInStore ? this.parent.isInStore : null;
    }
}

// node types extracted by:
//  $ grep -Po "type: *\"([A-Za-z0-9_-]+)\"" parser2.pegjs | grep -Po "\".+\""|sed 's/"//g'|sort|uniq

exports.makeTree = ()=>new Tree({
    AddItem:class extends MyNode {},
    ArrayExpression:class extends MyNode {
        get accessor() {
            return this.parent.accessor.concat([{type:'Array'}]);
        }
    },
    AssignmentExpression:class extends MyNode {},
    BinaryExpression:class extends MyNode {},
    BindItem:class extends MyNode {
        get boundHere() {
            return [this.est.id];
        }
    },
    BlockStatement:class extends MyNode {
        get body() {
            return this.tree.map(this.est.body);
        }
        get bindings() {
            const bodyN = estFor(this).body.map(e=>nodeFor(e));
            return Object.assign.apply(null,[{}]
                                       .concat([this.parent.bindings])
                                       .concat(bodyN.map(n=>n.boundHere).filter(x=>x) ) );
        }
    },
    BreakStatement:class extends MyNode {},
    CallExpression:class extends MyNode {},
    CatchClause:class extends MyNode {},
    ConditionalExpression:class extends MyNode {},
    ContinueStatement:class extends MyNode {},
    DelItem:class extends MyNode {},
    DoWhileStatement:class extends MyNode {},
    EmptyStatement:class extends MyNode {},
    ExpressionStatement:class extends MyNode {},
    FailItem:class extends MyNode {},
    ForInStatement:class extends MyNode {},
    ForStatement:class extends MyNode {},
    FunctionDeclaration:class extends MyNode {
        get boundHere() {
            return {[estFor(this).id.name]:{}};
        }
    },
    FunctionExpression:class extends MyNode {},
    Identifier:class extends MyNode {
        get mangling() {
            if (this.isInStore) {
                return !Object.keys(this.storeOutsideBindings).includes(estFor(this).name);
            } else
                return false;
        }
        get name() {
            return estFor(this).name+(this.mangling?'_':'');
        }
        get rewrite() {
            return b.identifier(this.name);
        }
    },
    IfStatement:class extends MyNode {},
    InitialValue:class extends MyNode {},
    LabeledStatement:class extends MyNode {},
    Literal:class extends MyNode {},
    LogicalExpression:class extends MyNode {},
    MatchItem:class extends MyNode {},
    MemberExpression:class extends MyNode {},
    NewExpression:class extends MyNode {},
    ObjectExpression:class extends MyNode {
        get accessor() {
            const  pa = this.parent.accessor;
            let   acc = pa;
            const pa0 = pa[pa.length-1];
            if (this.index && !('index' in pa0))
                acc = acc.slice(0,pa.length-1).concat([{type:pa0.type,index:this.index}]);
            return acc.concat([{type:'Object'}]);
        }
    },
    ObjectProperty:class extends MyNode {
        get accessor() {
            const pa = this.parent.accessor;
            return pa.slice(0,pa.length-1).concat([{type:'Object',index:this.index}]);
        }
    },
    Program:class extends MyNode {
        get globals() {
            return {};          // +++ get these from somewhere +++
        }
        get bindings() {
            const bodyN = estFor(this).body.map(e=>nodeFor(e));
            return Object.assign.apply(null,[{}]
                                       .concat([this.globals])
                                       .concat(bodyN.map(n=>n.boundHere).filter(x=>x)) );
        }
    },
    ReturnStatement:class extends MyNode {},
    RuleStatement:class extends MyNode {
        get accessor() {
            return [{type:'Rule'}];
        }
    },
    SequenceExpression:class extends MyNode {},
    StoreExpression:class extends MyNode {
        // get rewrite() {
        //     const cf = makeCodeFragment('store',{

        //     });
        //     // +++
        //     return cf;
        // }
        get storeOutsideBindings() {
            return this.parent ? this.parent.bindings : {};
        }
        get isInStore() {return true;}
    },
    SwitchCase:class extends MyNode {},
    SwitchStatement:class extends MyNode {},
    TestItem:class extends MyNode {},
    ThrowStatement:class extends MyNode {},
    TryStatement:class extends MyNode {},
    UpdateExpression:class extends MyNode {},
    VariableDeclaration:class extends MyNode {
        get boundHere() {
            return _.object(estFor(this).declarations.map(vd=>[vd.id.name,{}]));
        }
    },
    VariableDeclarator:class extends MyNode {},
    WhileStatement:class extends MyNode {},
},MyNode);

if (util.env==='test')
    exports._private = {
        MyNode,
        mapIdNodeEst
    };
