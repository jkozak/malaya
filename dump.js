#!/usr/bin/env node

"use strict";

var   argv = require('minimist')(process.argv.slice(2));
var   util = require('./util.js');
var     fs = require('fs');
var parser = require('./parser.js');
var      _ = require('underscore');

function fmtLoc(node) {
    if (node.loc===undefined)
	return "???";
    else {
	return util.format("%d:%d-%d:%d",
			   node.loc.start.line,node.loc.start.column,
			   node.loc.end.line,  node.loc.end.column);
    }
}

if (false)
    parser.visit(parser.parse(fs.readFileSync(argv._[0]),{loc:true}),{
	visitStoreExpression: function(path) {
	    var node = path.node;
	    console.log("store %j %s",node.id,fmtLoc(node));
	    this.traverse(path);
	},
	visitRuleStatement: function(path) {
	    var node = path.node;
	    console.log(" rule %j %s",node.id,fmtLoc(node));
	    this.traverse(path);
	},
	visitQueryStatement: function(path) {
	    var node = path.node;
	    console.log(" query %j %s",node.id.name,fmtLoc(node));
	    this.traverse(path);
	}, 
	visitItemExpression: function(path) {
	    var node = path.node;
	    console.log("  item %s %s",node.op,fmtLoc(node));
	    this.traverse(path);
	}
    });

function setCharAt(str,index,chr) {
    if (index>str.length-1)
	return str;
    return str.substr(0,index)+chr+str.substr(index+1);
}

function buildCodeStanzas(path) {
    var   code = fs.readFileSync(path,'utf8').replace(/\t/g,'        ');
    var  lines = [""].concat(code.split('\n')); // make zero-based
    var lines1 = _.map(lines,function(s) {
	return Array(s.length).join(' ');       // initially a blank copy
    });
    var stanzas = [];
    var sources = {};		                // {<line>:{<column>:<source>,...},...}
    var findTag = function(l) {
	for (;l>0;l--) {
	    var m = lines[l].match(/ *\/\/ +([^: ]+)/);
	    if (m!==null && m[1]!=='+++') 
		return m[1];
	    m = lines[l].match(/([^ ]+)/);      // line neither comment nor blank
	    if (m!==null)
		break;
	}
	return null;
    };
    var noteSource = function(node) {
	if (sources[node.loc.start.line]===undefined)
	    sources[node.loc.start.line] = {};
	sources[node.loc.start.line][node.loc.start.column] = node;
    }
    parser.visit(parser.parse(code,{loc:true}),{
	visitRuleStatement: function(path) {
	    var node = path.node;
	    for (var i=0;i<'rule'.length;i++)
		lines1[node.loc.start.line] = setCharAt(lines1[node.loc.start.line],node.loc.start.column+i,'R');
	    noteSource(node);
	    this.traverse(path);
	},
	visitQueryStatement: function(path) {
	    var node = path.node;
	    for (var i=0;i<'query'.length;i++)
		lines1[node.loc.start.line] = setCharAt(lines1[node.loc.start.line],node.loc.start.column+i,'Q');
	    noteSource(node);
	    this.traverse(path);
	}, 
	visitItemExpression: function(path) {
	    var node = path.node;
	    for (var l=node.loc.start.line;l<=node.loc.end.line;l++)
		for (var c=node.loc.start.column;c<node.loc.end.column;c++) {
		    lines1[l] = setCharAt(lines1[l],c,node.op);
		}
	    noteSource(node);
	    this.traverse(path);
	}
    });
    var stanza = null;
    var    tag = null;
    for (var l=0;l<lines1.length;l++) {
	var  blank = (lines[l].search(/[^ ]/)===-1);
	var blank1 = (lines1[l].search(/[^ ]/)===-1);
	if (l>0) {
	    var m = lines[l-1].match(/ *\/\/ +([^: ]+)/);
	    if (m!=null && m[1]!=='+++')
		tag = m[1];
	}
	if (stanza===null) {
	    if (!blank1) {
		stanza = {lines:[lines1[l]],tag:tag,line:l}
		tag    = null;
	    }
	} else {
	    if (!blank1)
		stanza.lines.push(lines1[l]);
	    else if (blank) {
		stanzas.push(stanza);
		stanza = null;
	    }
	    else
		stanza.lines.push(''); // to keep line numbers aligned with source
	}
    }
    if (stanza!==null)
	stanzas.push(stanza);
    stanzas.forEach(function(stanza) {
	var addDraw = function(l,c,n) {
	    if (n>0 && stanza.lines[l][c]!=' ') {
		if (sources[stanza.line+l]===undefined)
		    console.log("!!! bugger1(%d): %j %j %j %j %j",stanza.line,l,c,n,stanza.lines[l][c],stanza.line+l);
		else if (sources[stanza.line+l][c]===undefined)
		    console.log("!!! bugger2(%d): %j %j %j %j",stanza.line,l,c,n,stanza.lines[l][c]);
	    }
	};
	// +++ run-length encode stanzas to get line drawing primitives +++
	for (var l=0;l<stanza.lines.length;l++) {
	    var line = stanza.lines[l];
	    var   ch = null;
	    var    c = 0;
	    var    n = 0;
	    for (var i=0;i<line.length;i++) {
		if (ch!==line[i]) {
		    addDraw(l,c,n);
		    ch = line[i];
		    c  = i;
		    n  = 0;
		}
		else
		    n++;
	    }
	    addDraw(l,c,n);
	}
    });
    return stanzas;
}

var cs = buildCodeStanzas(argv._[0]);
for (var i in cs)
    console.log(cs[i]);
