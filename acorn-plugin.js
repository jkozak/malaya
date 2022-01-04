"use strict";

const acorn = require('acorn');

const tt = acorn.tokTypes;

module.exports = function malaya(Parser) {
    return class extends Parser {
        constructor(opts,pos,extensions) {
            super(opts,pos,extensions);
            this.inStore = false;
        }
        readToken(code) {
            super.readToken(code);
            console.log(`*** read `,this.type.label);
        }
        parseExprAtom(rDE,fI) {
            const r =  super.parseExprAtom(rDE,fI);
            console.log(`pEA: `,r);
            if (r.type==='Identifier' && r.name==='store') {
                const node = this.startNode();
                return this.parseStoreBody(node,0);
            }
            return r;
        }
        parseStoreBody(node,statement) {
            let inside = true;
            node.items = [];
            node.rules = [];
            console.log(`*** store body`);
            this.expect(tt.braceL);
            while (inside) {
                switch (this.type) {
                case tt.braceR:
                    inside = false;
                    break;
                case tt.name:
                    if (this.value==='rule') {
                        node.rules.push(this.parseMalayaRule(this.startNode()));
                        break;
                    } else
                        throw new Error(`??? ${JSON.stringify(this.type)}`);
                case tt.bracketL:
                case tt.braceL:
                    node.items.push(this.parseMalayaItem(this.startNode(),true));
                    this.expect(';');
                    break;
                default:
                    throw new Error(`??? ${JSON.stringify(this.type)} ${JSON.stringify(this.value)}`);
                }
            }
            this.expect(tt.braceR);
            return this.finishNode(node,"StoreExpression");
        }
        parseMalayaItem(node) {
            if (this.type===tt.braceL)
                this.parseObj(true);
            else if (this.type===tt.bracketL)
                this.parseExprList(tt.bracketR,false,true);
            else
                throw new Error(`???`,node);
            return this.finishNode(node,"MalayaItem");
        }
        parseMalayaRule(node) {
            console.log(`*** parseMalayaRule`);
            this.next();
            node.items = [];
            this.expect(tt.parenL);
            for (;;) {
                if (this.type===tt.plusMin) {
                    const op = this.value;
                    this.next();
                    const item = this.parseMalayaItem();
                    item.op = op;
                    node.items.push(item);
                } else if (this.type===tt.parenR) {
                    this.next();
                    break;
                } else if (this.type===tt.braceL || this.type===tt.bracketL) {
                    node.items.push(this.parseMalayaItem(this.startNode()));
                    this.expect(';');
                } else {
                    // +++ logical expr or match +++
                }
                this.next();
                if (this.type!==tt.parenR)
                    this.expect(tt.comma);
            }
            this.expect(tt.semi);
            return this.finishNode(node,"MalayaRule");
        }
    };
};
