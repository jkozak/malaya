var parser = require("../parser.js");

var       _ = require('underscore');
var  assert = require("assert");
var    temp = require('temp');
var    util = require('../util.js');
var    path = require('path');
var      fs = require('fs');
var      vm = require('vm');

temp.track();

var chrjsTestFixture = {	// see esprima/test/test.js for format
    'ChrJS expressions': {
        'store{};': {
	    type: 'StoreDeclaration',
	    id: null,
	    body: [],
	    range: [0, 7],
	    loc: {
		start: { line: 1, column: 0 },
		end: { line: 1, column: 7 }
	    }
	},
        'store{[]};': {
            type: 'StoreDeclaration',
	    id: null,
            body: [
		{
		    type: 'ArrayExpression',
		    elements: [],
		    range: [6,8],
		    loc: {
			start: {line:1,column:6},
			end: {line:1,column:8},
		    } } ],
            range: [0, 9],
            loc: {
                start: { line: 1, column: 0 },
                end: { line: 1, column: 9 }
            }
        },
        'store{{}};': {
            type: 'StoreDeclaration',
	    id: null,
            body: [
		{
		    type: 'ObjectExpression',
		    properties: [],
		    range: [6,8],
		    loc: {
			start: {line:1,column:6},
			end: {line:1,column:8},
		    } } ],
            range: [0, 9],
            loc: {
                start: { line: 1, column: 0 },
                end: { line: 1, column: 9 }
            }
        },
	'x=>1;': {
	    type: 'ExpressionStatement',
	    expression: {
		type: 'FunctionExpression',
		id: null,
		params: [{type:'Identifier',
			  name:'x',
			  range:[0,1],
			  loc:{start:{line:1,column:0},end:{line:1,column:1}} }],
		defaults: [],
		body: {
		    type: "BlockStatement",
		    body: [
			{
			    type: "ReturnStatement",
			    argument: {
				range: [3,4],
				loc: {
				    start: {line: 1, column: 3},
				    end: {line: 1,column: 4}
				},
				type: "Literal",
				value: 1,
				raw: "1"
			    }
			}
		    ]
		},
		rest: null,
		generator: false,
		expression: false,
		range: [0, 4],
		loc: {
		    start: { line:1, column: 0},
		    end: { line:1, column: 4},
		}
	    },
	    range: [0, 5],
	    loc: {
		start: { line:1, column: 0},
		end: { line:1, column: 5},
	    }
	},
	'(x)=>1;': {
	    type: 'ExpressionStatement',
	    expression: {
		type: 'FunctionExpression',
		id: null,
		params: [{type:'Identifier',
			  name:'x',
			  range:[1,2],
			  loc:{start:{line:1,column:1},end:{line:1,column:2}} }],
		defaults: [],
		body: {
		    type: "BlockStatement",
		    body: [
			{
			    type: "ReturnStatement",
			    argument: {
				range: [5,6],
				loc: {
				    start: {line: 1, column: 5},
				    end: {line: 1,column: 6}
				},
				type: "Literal",
				value: 1,
				raw: "1"
			    }
			}
		    ]
		},
		rest: null,
		generator: false,
		expression: false,
		range: [0, 6],
		loc: {
		    start: { line:1, column: 0},
		    end: { line:1, column: 6}
		}
	    },
	    range: [0, 7],
	    loc: {
		start: { line:1, column: 0},
		end: { line:1, column: 7}
	    }
	},
	'(x,y)=>1;': {
	    type: 'ExpressionStatement',
	    expression: {
		type: 'FunctionExpression',
		id: null,
		params: [{type:'Identifier',
			  name:'x',
			  range:[1,2],
			  loc:{start:{line:1,column:1},end:{line:1,column:2}} },
			 {type:'Identifier',
			  name:'y',
			  range:[3,4],
			  loc:{start:{line:1,column:3},end:{line:1,column:4}} }
			],
		defaults: [],
		body: {
		    type: "BlockStatement",
		    body: [
			{
			    type: "ReturnStatement",
			    argument: {
				range: [7,8],
				loc: {
				    start: {line: 1, column: 7},
				    end: {line: 1,column: 8}
				},
				type: "Literal",
				value: 1,
				raw: "1"
			    }
			}
		    ]
		},
		rest: null,
		generator: false,
		expression: false,
		range: [0, 8],
		loc: {
		    start: { line:1, column: 0},
		    end: { line:1, column: 8}
		}
	    },
	    range: [0, 9],
	    loc: {
		start: { line:1, column: 0},
		end: { line:1, column: 9}
	    }
	}
    }
};

describe("esprima-based parser",function() {
    it("should pass original javascript tests",function() {
	var total    = 0;
	var failures = [];
	vm.runInThisContext(fs.readFileSync(__dirname+'/../node_modules/esprima/test/test.js','utf-8'));
	// this code largely taken from the esprima test runner
	var adjustRegexLiteral = function(key,value) {
	    if (key === 'value' && value instanceof RegExp) {
		value = value.toString();
	    }
	    return value;
	};
	var NotMatchingError = function(expected,actual) {
	    Error.call(this, 'Expected ');
	    this.expected = expected;
	    this.actual = actual;
	}
	NotMatchingError.prototype = new Error();
	var errorToObject = function(e) {
	    var msg = e.toString();

	    // Opera 9.64 produces an non-standard string in toString().
	    if (msg.substr(0, 6) !== 'Error:') {
		if (typeof e.message === 'string') {
		    msg = 'Error: ' + e.message;
		}
	    }
	    
	    return {
		index: e.index,
		lineNumber: e.lineNumber,
		column: e.column,
		message: msg
	    };
	};
	var sortedObject = function(o) {
	    if (o === null) {
		return o;
	    }
	    if (o instanceof Array) {
		return o.map(sortedObject);
	    }
	    if (typeof o !== 'object') {
		return o;
	    }
	    if (o instanceof RegExp) {
		return o;
	    }
	    var keys = Object.keys(o);
	    var result = {
		range: undefined,
		loc: undefined
	    };
	    keys.forEach(function (key) {
		if (o.hasOwnProperty(key)){
		    result[key] = sortedObject(o[key]);
		}
	    });
	    return result;
	}
	var hasAttachedComment = function(syntax) {
	    var key;
	    for (key in syntax) {
		if (key === 'leadingComments' || key === 'trailingComments') {
		    return true;
		}
		if (typeof syntax[key] === 'object' && syntax[key] !== null) {
		    if (hasAttachedComment(syntax[key])) {
			return true;
		    }
		}
	    }
	    return false;
	}
	var testParse = function(esprima,code,syntax) {
	    var expected, tree, actual, options, StringObject, i, len, err;

	    // alias, so that JSLint does not complain.
	    StringObject = String;

	    options = {
		comment: (typeof syntax.comments !== 'undefined'),
		range: true,
		loc: true,
		tokens: (typeof syntax.tokens !== 'undefined'),
		raw: true,
		tolerant: (typeof syntax.errors !== 'undefined'),
		source: null
	    };

	    if (options.comment) {
		options.attachComment = hasAttachedComment(syntax);
	    }

	    if (typeof syntax.tokens !== 'undefined') {
		if (syntax.tokens.length > 0) {
		    options.range = (typeof syntax.tokens[0].range !== 'undefined');
		    options.loc = (typeof syntax.tokens[0].loc !== 'undefined');
		}
	    }

	    if (typeof syntax.comments !== 'undefined') {
		if (syntax.comments.length > 0) {
		    options.range = (typeof syntax.comments[0].range !== 'undefined');
		    options.loc = (typeof syntax.comments[0].loc !== 'undefined');
		}
	    }

	    if (options.loc) {
		options.source = syntax.loc.source;
	    }

	    syntax = sortedObject(syntax);
	    expected = JSON.stringify(syntax, null, 4);
	    try {
		// Some variations of the options.
		tree = esprima.parse(code, { tolerant: options.tolerant });
		tree = esprima.parse(code, { tolerant: options.tolerant, range: true });
		tree = esprima.parse(code, { tolerant: options.tolerant, loc: true });

		tree = esprima.parse(code, options);
		tree = (options.comment || options.tokens || options.tolerant) ? tree : tree.body[0];

		if (options.tolerant) {
		    for (i = 0, len = tree.errors.length; i < len; i += 1) {
			tree.errors[i] = errorToObject(tree.errors[i]);
		    }
		}
		tree = sortedObject(tree);
		actual = JSON.stringify(tree, adjustRegexLiteral, 4);

		// Only to ensure that there is no error when using string object.
		esprima.parse(new StringObject(code), options);

	    } catch (e) {
		throw new NotMatchingError(expected, e.toString());
	    }
	    if (expected !== actual) {
		throw new NotMatchingError(expected, actual);
	    }

	    function filter(key, value) {
		if (key === 'value' && value instanceof RegExp) {
		    value = value.toString();
		}
		return (key === 'loc' || key === 'range') ? undefined : value;
	    }

	    if (options.tolerant) {
		return;
	    }


	    // Check again without any location info.
	    options.range = false;
	    options.loc = false;
	    syntax = sortedObject(syntax);
	    expected = JSON.stringify(syntax, filter, 4);
	    try {
		tree = esprima.parse(code, options);
		tree = (options.comment || options.tokens) ? tree : tree.body[0];

		if (options.tolerant) {
		    for (i = 0, len = tree.errors.length; i < len; i += 1) {
			tree.errors[i] = errorToObject(tree.errors[i]);
		    }
		}
		tree = sortedObject(tree);
		actual = JSON.stringify(tree, filter, 4);
	    } catch (e) {
		throw new NotMatchingError(expected, e.toString());
	    }
	    if (expected !== actual) {
		throw new NotMatchingError(expected, actual);
	    }
	};

	var testTokenize = function(esprima,code,tokens) {
	    var options, expected, actual, tree;

	    options = {
		comment: true,
		tolerant: true,
		loc: true,
		range: true
	    };

	    expected = JSON.stringify(tokens, null, 4);

	    try {
		tree = esprima.tokenize(code, options);
		actual = JSON.stringify(tree, null, 4);
	    } catch (e) {
		throw new NotMatchingError(expected, e.toString());
	    }
	    if (expected !== actual) {
		throw new NotMatchingError(expected, actual);
	    }
	};

	var testError = function(esprima,code,exception) {
	    var i, options, expected, actual, err, handleInvalidRegexFlag, tokenize;

	    // Different parsing options should give the same error.
	    options = [
		{},
		{ comment: true },
		{ raw: true },
		{ raw: true, comment: true }
	    ];

	    // If handleInvalidRegexFlag is true, an invalid flag in a regular expression
	    // will throw an exception. In some old version V8, this is not the case
	    // and hence handleInvalidRegexFlag is false.
	    handleInvalidRegexFlag = false;
	    try {
		'test'.match(new RegExp('[a-z]', 'x'));
	    } catch (e) {
		handleInvalidRegexFlag = true;
	    }

	    exception.description = exception.message.replace(/Error: Line [0-9]+: /, '');

	    if (exception.tokenize) {
		tokenize = true;
		exception.tokenize = undefined;
	    }
	    expected = JSON.stringify(exception);

	    for (i = 0; i < options.length; i += 1) {

		try {
		    if (tokenize) {
			esprima.tokenize(code, options[i])
		    } else {
			esprima.parse(code, options[i]);
		    }
		} catch (e) {
		    err = errorToObject(e);
		    err.description = e.description;
		    actual = JSON.stringify(err);
		}

		if (expected !== actual) {

		    // Compensate for old V8 which does not handle invalid flag.
		    if (exception.message.indexOf('Invalid regular expression') > 0) {
			if (typeof actual === 'undefined' && !handleInvalidRegexFlag) {
			    return;
			}
		    }

		    throw new NotMatchingError(expected, actual);
		}

	    }
	};
	var testAPI = function(esprima,code,result) {
	    var expected, res, actual;
	    expected = JSON.stringify(result.result, null, 4);
	    try {
		if (typeof result.property !== 'undefined') {
		    res = esprima[result.property];
		} else {
		    res = esprima[result.call].apply(esprima, result.args);
		}
		actual = JSON.stringify(res, adjustRegexLiteral, 4);
	    } catch (e) {
		throw new NotMatchingError(expected, e.toString());
	    }
	    if (expected !== actual) {
		throw new NotMatchingError(expected, actual);
	    }
	};
	var runTest = function(esprima,code,result) {
	    if (result.hasOwnProperty('lineNumber')) {
		testError(esprima, code, result);
	    } else if (result.hasOwnProperty('result')) {
		testAPI(esprima, code, result);
	    } else if (result instanceof Array) {
		testTokenize(esprima, code, result);
	    } else {
		testParse(esprima, code, result);
	    }
	};
	delete testFixture['Invalid syntax']['i #= 42']; // not invalid now
	delete testFixture['API']['Syntax'];		 // we have added to `Syntax`
	_.extend(testFixture,chrjsTestFixture);          // add in tests for chrJS
	Object.keys(testFixture).forEach(function(category) {
            Object.keys(testFixture[category]).forEach(function(source) {
                var expected = testFixture[category][source];
                total += 1;
		try {
		    runTest(parser,source,expected);
		} catch (e) {
		    console.log("!!! "+e);
		    e.source = source;
		    // massage this into something I can actually read
		    console.log(util.format("\n%s.%s fails:\n wanted: %s\n got:    %s",
					    category,source,e.expected,e.actual));
		    failures.push(e);
		}
            });
	});
	assert.strictEqual(failures.length,0);
    });
});

describe("visit",function() {
    it("should visit StoreDeclaration",function(){
	var ok = false;
	parser.visit(parser.parse("store {}"),
		      {
			  visitStoreDeclaration: function(node) {
			      ok = true;
			      return false;
			  } });
	assert(ok);
    });
    it("should visit RuleStatement",function(){
	var n = 0;
	parser.visit(parser.parse("store {rule (['a'])}"),
		      {
			  visitStoreDeclaration: function(node) {
			      n++;
			      this.traverse(node);
			  },
			  visitRuleStatement: function(node) {
			      n++;
			      this.traverse(node);
			  } });
	assert.equal(n,2);
    });
    it("should visit ItemExpressions",function(){
	var n = 0;
	parser.visit(parser.parse("store {rule (['a',a],['b',a])}"),
		      {
			  visitStoreDeclaration: function(node) {
			      n++;
			      this.traverse(node);
			  },
			  visitRuleStatement: function(node) {
			      n++;
			      this.traverse(node);
			  },
		      	  visitItemExpression: function(node) {
			      n++;
			      this.traverse(node);
			  }});
	assert.equal(n,4);
    });
});
