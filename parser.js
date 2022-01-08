"use strict";

const  acorn = require("acorn");
const recast = require('recast');

const acornParser = acorn.Parser.extend(
    require('./acorn-plugin.js')
);

const LEGACY = true;            // use current compiler ESTree variant

const visit = exports.visit = (function() {
    var types = recast.types;
    var  Type = types.Type;
    var   def = Type.def;
    var    or = Type.or;
    def('StoreDeclaration')
        .bases('Declaration')
        .build('id', 'body')
        .field('id',   or(def('Identifier'),null))
        .field('body', [or(def('Statement'),def('ArrayExpression'),def('ObjectExpression'))]);
    def('StoreExpression')
        .bases('Expression')
        .build('body')
        .field('body', [def('Statement')]);
    def('RuleStatement')
        .bases('Statement')
        .build('id', 'items')
        .field('id',   or(def("Identifier"),null))
        .field('items',[def('ItemExpression')]);
    def("ItemExpression")
        .bases('Expression')
        .build('op','expr')
        .field('op',   or('+','-','M','=','?'))
        .field('expr', def('Expression'))
        .field('t',    or(def('Identifier'),null))
        .field('rank', or(def('Expression'),null));
    def('BindRest')
        .bases('Expression')
        .build('id')
        .field('id',   or(def('Identifier'),null));
    def('QueryStatement')
        .bases('Statement')
        .build('id','args','init','items','accum')
        .field('id',   def('Identifier'))
        .field('args', [def('Identifier')])
        .field('init', def('AssignmentExpression'))
        .field('items',[def('ItemExpression')])
        .field('accum',def('Expression'));
    def('SnapExpression')
        .bases('Expression')
        .build('id','init','items','accum')
        .field('id',   def('Identifier'))
        .field('init', def('Expression'))
        .field('items',[def('ItemExpression')])
        .field('accum',def('Expression'));
    def('WhereExpression')
        .bases('Expression')
        .build('id','element','items')
        .field('id',     def('Identifier'))
        .field('element',def('Expression'))
        .field('items',  [def('ItemExpression')]);
    def('QueryWhereStatement')
        .bases('FunctionDeclaration')
        .build('id','args','body')
        .field('id',     def('Identifier'))
        .field('args',   [def('Identifier')])
        .field('body',   def('ConditionalExpression'));
    def('InvariantStatement')
        .bases('FunctionDeclaration')
        .build('id','body')
        .field('id',     def('Identifier'))
        .field('body',   def('ConditionalExpression'));
    def('TypeSpecifier')
        .bases('Expression')
        .build('id','specs')
        .field('id',   def('Identifier'))
        .field('specs',[def('Identifier')]); // +++ not just primitive and union types +++
    types.finalize();
    return function(ast,methods) {
        return types.visit(ast,methods);
    };
})();

const parse = (s,opts)=>acornParser.parse(s,{ecmaVersion:2022}); // ignore opts

exports.parse = LEGACY ? (s,opts)=>{
    const prog = parse(s,opts);
    const    b = recast.types.builders;
    visit(prog,{
        context: [],
        visitObjectExpression(path) {
            this.context.push('object');
            this.traverse(path);
            this.context.pop();
        },
        visitArrayExpression(path) {
            this.context.push('array');
            this.traverse(path);
            this.context.pop();
        },
        visitBindRest(path) {
            if (this.context.slice(-1)[0]==='object') {
                const node = path.node;
                node.type      = 'Property';
                node.key       = '';
                node.value     = node.id;
                node.kind      = 'bindRest';
                node.method    = false;
                node.computed  = false;
                node.shorthand = false;
                delete node.id;
            }
            return false;
        },
        visitProperty(path) {
            const node = path.node;
            if (node.kind==='init' && node.value.type==='Identifier') {
                node.kind = 'bindOne';
                return false;
            } else
                this.traverse(path);
        },
        visitExpressionStatement(path) {
            const node = path.node;
            if (node.expression.type==='StoreExpression') {
                const bSD = b.storeDeclaration(node.expression.id,
                                               node.expression.body);
                bSD.attrs = {};
                path.replace(bSD);
                this.traverse(path);
            } else
                return false;
        }
    });
    return prog;
} : parse;

exports.namedTypes = require('recast').types.namedTypes;
