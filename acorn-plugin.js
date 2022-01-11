"use strict";

const acorn = require('acorn');

const tt = acorn.tokTypes;

class Node extends acorn.Node {
    constructor(opts,pos,extensions) {
        super(opts,pos,extensions);
        this.attrs = {};
    }
}

module.exports = function malaya(Parser) {
    return class extends Parser {
        constructor(opts,pos,extensions) {
            super(opts,pos,extensions);
            this.inStore = opts.inStore || false;
            this.inRule  = opts.inRule  || false;
            this.genId   = 1;
        }
        genIdent(kind) {
            const node = this.startNode();
            node.name = `%${kind}-${this.genId++}`;
            return this.finishNode(node,'Identifier');
        }
        parseOrGenIdent(kind) {
            if (this.type===tt.name)
                return this.parseIdent(false,false);
            else
                return this.genIdent(kind);
        }
        readToken(code) {
            super.readToken(code);
            //console.log(`*** read `,this.type.label);
        }
        startNode() {
            return new Node(this,this.start,this.loc);
        }
        startNodeAt(pos,loc) {
            return new Node(this,pos,loc);
        }
        copyNode(node) {
            let newNode = new Node(this,node.start,this.startLoc)
            for (let prop in node)
                newNode[prop] = node[prop];
            return newNode;
        }
        parseArrayOrWhereExpression(node,allowTrailingComma,allowEmpty,rDE) {
            node.elements = [];
            if (allowTrailingComma || allowEmpty)
                throw new Error(`NYI`);
            if (this.type!==tt.bracketL)
                throw new Error(`SNO`);
            this.next();
            for (let first=true;;first=false) {
                let elt;
                if (this.eat(tt.bracketR))
                    return this.finishNode(node,'ArrayExpression');
                if (this.inStore && !this.inRule &&
                    this.type===tt.name && this.value==='where') {
                    if (node.elements.length!==1)
                        throw new Error(`NYI: other than one thing before 'where'`);
                    else {
                        node.element = node.elements[0];
                        delete node.elements;
                    }
                    this.next();
                    node.id    = this.genIdent('where');
                    node.items = this.parseRuleStatementBody(this.startNode());
                    this.next();
                    return this.finishNode(node,'WhereExpression');
                }
                if (!first)
                    this.expect(tt.comma);
                if (this.type===tt.ellipsis)
                    elt = this.parseSpread(rDE);
                 else
                    elt = this.parseMaybeAssign(false,rDE)
                node.elements.push(elt)
            }
        }
        parseExprAtom(rDE,fI) {
            if (this.inStore && this.type===tt.bracketL) {
                return this.parseArrayOrWhereExpression(this.startNode(),false,false,rDE);
            } else {
                const node = super.parseExprAtom(rDE,fI);
                if (node.type==='Identifier')
                    switch (node.name) {
                    case 'store': {
                        let id = null;
                        if (this.type===tt.name)
                            id = this.parseIdent();
                        const se = this.parseStoreBody(this.startNode(),0);
                        se.id = id;
                        return se;
                    }
                    case 'fail': {
                        node.op   = 'F';
                        node.expr = this.parseExpression();
                        return this.finishNode(node,'ItemExpression');
                    }
                }
                return node;
            }
        }
        parseStoreBody(node,statement) {
            let inside = true;
            node.id   = null;
            node.body = [];
            this.expect(tt.braceL);
            this.inStore = true;
            while (inside) {
                switch (this.type) {
                case tt.braceR:
                    inside = false;
                    break;
                case tt.name:
                    if (this.value==='rule')
                        node.body.push(this.parseRuleStatement(this.startNode()));
                    else if (this.value==='query')
                        node.body.push(this.parseQueryWhereStatement(this.startNode()));
                    else if (this.value==='invariant')
                        node.body.push(this.parseInvariantStatement(this.startNode()));
                    else
                        throw new Error(`??? ${JSON.stringify(this.type)}`);
                    //console.log(`*** pSB: ${this.value}`,this.type)
                    this.expect(tt.semi);
                    break;
                default:
                    node.body.push(this.parseExpression(false));
                    this.expect(tt.semi);
                }
            }
            this.inStore = false;
            this.expect(tt.braceR);
            return this.finishNode(node,'StoreExpression');
        }
        checkPropClash(prop,propHash,rDE) {
            if (this.inStore)
                return;
            return super.checkPropClash(prop,propHash,rDE);
        }
        parseBindRest(node) {
            this.next();
            node.id = this.type===tt.name ? this.parseIdent() : null;
            return this.finishNode(node,'BindRest');
        }
        parseProperty(iP,rDE) {
            if (this.inStore && this.type===tt.ellipsis)
                return this.parseBindRest(this.startNode());
            const node = super.parseProperty(iP,rDE);
            node.shorthand = false; // ??? WTF do I need to set this? ???
            return node;
        }
        parseSpread(rDE) {
            if (this.inStore)
                return this.parseBindRest(this.startNode());
            else
                return super.parseSpread(rDE);
        }
        importItemExpression(node) {
            const n = new Node(this,node.start,node.loc);
            n.type = 'ItemExpression';
            n.t    = null;      // WTF was this for?  +++ remove +++
            n.rank = null;
            if (node.type==='BinaryExpression' && node.operator==='^') {
                n.rank = node.right;
                node   = node.left;
            }
            switch (node.type) {
            case 'UnaryExpression':
                if ('+-'.includes(node.operator)) {
                    n.op   = node.operator;
                    n.expr = node.argument;
                } else if (node.operator==='!') {
                    n.op   = '?';
                    n.expr = node;
                } else
                    throw new Error(`SNO: ${node.operator}`);
                break;
            case 'AssignmentExpression':
                n.op   = '=';
                n.expr = node;
                break;
            case 'ArrayExpression':
            case 'ObjectExpression':
                n.op   = 'M';
                n.expr = node;
                break;
            case 'BinaryExpression':
            case 'Identifier':
            case 'LogicalExpression':
                n.op   = '?';
                n.expr = node;
                break;
            case 'CallExpression':
                n.op   = (node.callee.type==='Identifier' && node.callee.name==='out') ? 'O' : '?';
                n.expr = node;
                break;
            case 'ItemExpression':
                n.op   = node.op;
                n.expr = node.expr;
                break;
            default:
                console.log(node);
                throw new Error(`NYI: ${node.type}`);
            }
            return n;
        }
        parseItemExpression(node) {
            return this.importItemExpression(this.parseExpression(false));
        }
        parseRuleStatementBody() {
            const expr = this.parseExpression(false);
            if (expr.type==='SequenceExpression')
                return expr.expressions.map(this.importItemExpression.bind(this));
            else
                return [this.importItemExpression(expr)];
        }
        parseRuleStatement(node) {
            this.next();
            node.id = this.parseOrGenIdent('rule');
            this.expect(tt.parenL);
            this.inRule = true;
            node.items  = this.parseRuleStatementBody();
            this.inRule = false;
            this.expect(tt.parenR);
            return this.finishNode(node,'RuleStatement');
        }
        parseQueryWhereStatement(node) {
            this.next();
            node.id = this.parseOrGenIdent('query');
            this.expect(tt.parenL);
            node.args = this.parseExprList(tt.parenR);
            node.body = this.parseExpression(this.startNode());
            return this.finishNode(node,'QueryWhereStatement');
        }
        parseInvariantStatement(node) {
            this.next();
            node.id   = this.parseOrGenIdent('invariant');
            node.body = this.parseExpression(false);
            return this.finishNode(node,'InvariantStatement');
        }
    };
};
