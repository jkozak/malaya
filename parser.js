"use strict";

const   acorn = require("acorn");
const  recast = require('recast');
const XRegExp = require('xregexp');

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
        .build('op','expr','t','rank')
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

const namedTypes = exports.namedTypes = require('recast').types.namedTypes;

const parse = (s,opts)=>acornParser.parse(s,{ecmaVersion:2022}); // ignore opts

const b =  (function(attrs) {
    const b = recast.types.builders;
    // +++ add `attrs` to more things if needed +++
    return Object.assign({},b,{
        identifier:     function(id)      {return Object.assign({attrs},b.identifier(id));},
        itemExpression: function(o,e,t,r) {return Object.assign({attrs},b.itemExpression(o,e,t,r));}
    });
})({});

exports.parse = LEGACY ? (s,opts)=>{
    const prog = parse(s,opts);
    visit(prog,{
        regexps: [],
        visitRuleStatement(path) {
            this.traverse(path);
        },
        visitItemExpression(path) {
            if (this.regexps.length!==0) throw new Error('SNO');
            if ('M-'.includes(path.node.op)) {
                this.regexps.length = 0;
                this.traverse(path);
                for (let i=0;i<this.regexps.length;i++) {
                    const   r = this.regexps[i];
                    const   n = `#rgx_${i}`;
                    const   m = `#rgx_match_${i}`;
                    const  xr = new XRegExp(r.regex.pattern,r.regex.flags);
                    const cns = xr.xregexp.captureNames
                    if (cns)
                        for (let j=cns.length-1;j>=0;j--) {
                            const name = cns[j];
                            path.insertAfter(b.itemExpression('=',
                                b.assignmentExpression('=',
                                                       b.identifier(name),
                                                       b.memberExpression(b.identifier(m),
                                                                          b.literal(j+1),
                                                                          true ) ),
                                null,null));
                        }                 
                    path.insertAfter(b.itemExpression('?',b.identifier(m),null,null));
                    // +++ remove the capture names from the source regexp +++
                    // +++ s/\(\?<.*>)/(?/ - but better +++
                    // +++ really need a proper regwxp parser +++ 
                    path.insertAfter(b.itemExpression('=',
                        b.assignmentExpression(
                            '=',
                            b.identifier(m),
                            b.callExpression(
                                b.memberExpression(
                                    b.identifier(n),
                                    b.identifier('match'),
                                    false),
                                [b.newExpression(
                                    b.identifier('RegExp'),
                                    [b.literal(r.regex.pattern),b.literal(r.regex.flags)] )]) ),
                        null,null));
                }
                this.regexps.length = 0;
            } else
                return false;
        },
        visitProperty(path) {
            this.traverse(path);
        },
        visitLiteral(path) {
            if (path.node.regex) {
                const id = b.identifier(`#rgx_${this.regexps.length}`);
                // +++ remove name tag from regexps +++
                // +++ moan about use of g flag +++
                this.regexps.push(path.node);
                path.replace(id);
            }
            return false;
        }
    });
    visit(prog,{
        context: [],
        visitTemplateLiteral(path) {     // template literals expanded here
            if (path.node.quasis.length!==path.node.expressions.length+1)
                throw new Error('SNO');
            const n = path.node.expressions.length;
            let sub = b.literal(path.node.quasis[n].value.cooked);
            for (let i=n-1;i>=0;i--) {
                sub = b.binaryExpression(
                    '+',
                    b.literal(path.node.quasis[i].value.cooked),
                    b.binaryExpression(
                        '+',
                        path.node.expressions[i],
                        sub));
            }
            path.replace(sub);
            return false;
        },
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
            }
            this.traverse(path);
        }
    });
    namedTypes.Program.assert(prog);
    return prog;
} : parse;
