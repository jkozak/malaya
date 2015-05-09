// testing this module is scary as it hacks the `require` plumbing

"use strict";

var noteRequires = require('../note-requires.js');

var      _ = require('underscore');
var   path = require('path');
var assert = require('assert');

describe("note-require",function() {
    var saveExtensions;
    before(function() {
        saveExtensions = require.extensions;
    });
    after(function() {
        try {
            noteRequires.unregister();
        } catch (e) {};
    });
    afterEach(function() {
        require.extensions = saveExtensions;
    });
    it("does little if not enabled",function() {
        assert.deepEqual(_.keys(noteRequires.files),[]);
        noteRequires.register();
        noteRequires.basedir = __dirname;
        require('./data/module0.js');
        assert.deepEqual(_.keys(noteRequires.files),[]);
        noteRequires.unregister();
    });
    it("tracks a `require`d module",function() {
        assert.deepEqual(_.keys(noteRequires.files),[]);
        noteRequires.register();
        noteRequires.basedir = __dirname;
        noteRequires.enabled = true;
        var mod = 'data/module1.js';
        require('./'+mod);
        assert.deepEqual(_.keys(noteRequires.files),[mod]);
        noteRequires.unregister();
    });
    it("tracks `require`d modules transitively",function() {
        assert.deepEqual(_.keys(noteRequires.files),[]);
        noteRequires.register();
        noteRequires.basedir = __dirname;
        noteRequires.enabled = true;
        var mod = 'data/module2.js'; // requires module21
        require('./'+mod);
        assert.deepEqual(_.keys(noteRequires.files).sort(),[mod,'data/module21.js']);
        noteRequires.unregister();
    });
    it("tracks `require`d modules with digest",function() {
        assert.deepEqual(_.keys(noteRequires.files),[]);
        noteRequires.register(path.basename);
        noteRequires.basedir = __dirname;
        noteRequires.enabled = true;
        var mod = 'data/module3.js';
        require('./'+mod);
        var obj = {};
        obj[mod] = 'module3.js';
        assert.deepEqual(noteRequires.files,obj);
        noteRequires.unregister();
    });
});
