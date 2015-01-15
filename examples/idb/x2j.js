// xml2js has proved a bit of a disappointment
// Here's a parser/builder for a minimal subset of XML sufficient unto this project.

// format:
//  <a p='1'>text<node/></a>   <=>  {a:{p:'1',_children:['text',{node:{}}]}}

var assert = require('assert');
var    sax = require('sax');
var parser = sax.parser(true);


exports.parse = function(xml) {
    var       ans;
    var     stack = [];
    var pushChild = function(ch) {
	var keys = Object.keys(stack[0]);
	assert.equal(keys.length,1);
	var insertHere = stack[0][keys[0]];
	if (insertHere._children===undefined)
	    insertHere._children = [];
	insertHere._children.push(ch);
    };
    parser.onerror = function(e) {
	throw new Error(e);
    };
    parser.ontext = function (t) {
	assert(stack.length>0);
	pushChild(t);
    };
    parser.onopentag = function (node) {
	var newnode = {};
	newnode[node.name] = node.attributes;
	if (stack.length>0) {
	    pushChild(newnode);
	}
	stack.unshift(newnode);
    };
    parser.onclosetag = function (node) {
	ans = stack.shift();
    };
    parser.write(xml).close();
    assert.equal(stack.length,0); // check we have run synchronously
    assert(ans);
    return ans;
};

exports.build = function(obj,cb) {
    var ans = '';
    if (cb===undefined)
	cb = function(s) {ans += s;};
    if ((typeof obj)=='string')
	cb(obj);
    else {
	assert.equal((typeof obj),'object');
	Object.keys(obj).forEach(function(k) {
	    if (k==='_XML' && (typeof obj[k])==='string') {
		cb(obj[k]);
	    } else {
		cb("<");
		cb(k);
		Object.keys(obj[k]).forEach(function(a) {
		    if (a!=='_children') {
			if (obj[k][a]===undefined)
			    console.log("*** undef obj: %j  k: %j  a: %j",obj,k,a);
			var s = obj[k][a]===null  ? "" : obj[k][a].toString();
			assert.equal(s.indexOf('"'),-1);
			cb(" ");cb(a);cb('="');cb(s);cb('"');
		    }
		});
		var children = obj[k]['_children'];
		if (children!==undefined) {
		    cb('>');
		    assert(children instanceof Array);
		    for (var i=0;i<children.length;i++)
			exports.build(children[i],cb);
		    cb("</");cb(k);cb('>');
		} else
		    cb('/>');
	    }
	});
    }
    return ans;
};
