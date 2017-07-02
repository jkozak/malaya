"use strict";

let root;

exports.init = function() {
    root = {n:100};
};
exports.getRoot = function() {
    return root;
};

exports.setRoot = function(r) {
    root = r;
};

exports.query = function(q) {
    if (q==='n')
        return root.n;
    throw new Error(`query doesn't know about '${q}'`);
};

exports.update = function(u) {
    if (u==='tick')
        root.n++;
};
