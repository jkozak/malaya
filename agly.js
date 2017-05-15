"use strict";

const _ = require('underscore');

class Node {
    constructor(parseNode,parent,grammar) {
        this._parse    = parseNode;
        this._parent   = parent;
        this._children = _.object(Object.keys(parseNode)
                                  .map((k)=>[k,grammar.load(parseNode[k],this)])
                                  .filter((nv)=>nv[1]));
    }
    _ancestral(attr) {
        let n = this;
        while (n) {
            n = n._parent;
            if (n[attr])
                return n[attr];
        }
        return undefined;
    }
}
exports.Node = Node;

exports.Grammar = class {
    constructor() {
        this.types = {};
        this._map  = null;      // parseNode -> agNode
    }
    addNodeDefinition(name,cls) {
        // +++ memoise attrs +++
        // +++ check either synthetic or inherited +++
        this.types[name] = cls;
    }
    load(parseNode,parent) {
        if (this._map===null) {
            this._map = new Map();
            try {
                return this.load(parseNode,null);
            } finally {
                this._map = null;
            }
        } else if (this._map.get(parseNode)) {
            return this._map.get(parseNode);
        } else if (Array.isArray(parseNode)) {
            return parseNode.map(v=>this.load(v,parent,this));
        } else if (parseNode===null) {
            return null;
        } else if (typeof parseNode.type==='string') {
            const cls = this.types[parseNode.type] || Node;
            this._map.set(parseNode,new cls(parseNode,parent,this));
            return this._map.get(parseNode);
        } else {                // it's a constant
            return null;
        }
    }
};
