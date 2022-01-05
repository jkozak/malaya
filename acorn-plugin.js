"use strict";

const acorn = require('acorn');

const tt = acorn.tokTypes;

module.exports = function malaya(Parser) {
    return class extends Parser {
        constructor(opts,pos,extensions) {
            super(opts,pos,extensions);
            this.inStore = opts.inStore || false;
            this.inRule  = opts.inRule  || false;
        }
        readToken(code) {
            super.readToken(code);
            //console.log(`*** read `,this.type.label);
        }
        parseArrayOrWhereExpression(node,allowTrailingComma,allowEmpty,rDE) {
            node.elements = []
            if (allowTrailingComma || allowEmpty)
                throw new Error(`NYI`);
            if (this.type!==tt.bracketL)
                throw new Error(`SNO`);
            this.next();
            for (let first=true;;first=false) {
                if (this.eat(tt.bracketR))
                    return this.finishNode(node,'ArrayExpression');
                if (this.inStore && !this.inRule &&
                    this.type===tt.name && this.value==='where') {
                    this.next();
                    node.rules = this.parseMalayaRuleBody(this.startNode());
                    return this.finishNode(node,'WhereExpression');
                }
                if (!first)
                    this.expect(tt.comma);
                let elt;
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
                if (node.type==='Identifier' && node.name==='store')
                    return this.parseStoreBody(this.startNode(),0);
                return node;
            }
        }
        parseStoreBody(node,statement) {
            let inside = true;
            node.items      = [];
            node.rules      = [];
            node.queries    = [];
            node.invariants = [];
            this.expect(tt.braceL);
            this.inStore = true;
            while (inside) {
                switch (this.type) {
                case tt.braceR:
                    inside = false;
                    break;
                case tt.name:
                    if (this.value==='rule')
                        node.rules.push(this.parseMalayaRule(this.startNode()));
                    else if (this.value==='query')
                        node.queries.push(this.parseMalayaQuery(this.startNode()));
                    else if (this.value==='invariant')
                        node.invariants.push(this.parseMalayaInvariant(this.startNode()));
                    else
                        throw new Error(`??? ${JSON.stringify(this.type)}`);
                    this.expect(tt.semi);
                    break;
                default:
                    node.items.push(this.parseExpression(false));
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
        parseMalayaEllipsis(node) {
            this.next();
            node.bind = this.type===tt.name ? this.parseIdent() : null;
            return this.finishNode(node,'MalayaEllipsis');
        }
        parseProperty(iP,rDE) {
            if (this.inStore && this.type===tt.ellipsis)
                return this.parseMalayaEllipsis(this.startNode());
            return super.parseProperty(iP,rDE);
        }
        parseSpread(rDE) {
            if (this.inStore)
                return this.parseMalayaEllipsis(this.startNode());
            else
                return super.parseSpread(rDE);
        }
        importMalayaItem(node) {
            const n = new acorn.Node(this,node.start,node.loc);
            n.type = 'MalayaItem';
            n.rank = null;
            switch (node.type) {
            case 'UnaryExpression':
                n.op   = node.operator;
                n.expr = node.argument;
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
            case 'CallExpression':
                n.op   = '?';
                n.expr = node;
                break;
            default:
                console.log(node);
                throw new Error(`NYI: ${node.type}`);
            }
            return n;
        }
        parseMalayaItem(node) {
            node.item = this.importMalayaItem(this.parseExpression(false));
            return this.finishNode(node,'MalayaItem');
        }
        parseMalayaRuleBody() {
            const expr = this.parseExpression(false);
            if (expr.type==='SequenceExpression')
                return expr.expressions.map(this.importMalayaItem.bind(this));
            else
                return [this.importMalayaItem(expr)];
        }
        parseMalayaRule(node) {
            this.next();
            this.expect(tt.parenL);
            this.inRule = true;
            node.items  = this.parseMalayaRuleBody();
            this.inRule = false;
            this.expect(tt.parenR);
            return this.finishNode(node,'MalayaRule');
        }
        parseMalayaQuery(node) {
            this.next();
            node.id = this.type===tt.name ? this.parseIdent(false,false) : null;
            this.expect(tt.parenL);
            node.args = this.parseExprList(tt.parenR);
            node.body = this.parseExpression(this.startNode());
            return this.finishNode(node,'MalayaQuery');
        }
        parseMalayaInvariant(node) {
            this.next();
            node.id   = this.type===tt.name ? this.parseIdent(false,false) : null;
            node.expr = this.parseExpression(false);
            return this.finishNode(node,'MalayaInvariant');
        }
    };
};
