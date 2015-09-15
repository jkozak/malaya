var root;

exports.init = function() {
    root = [];
};
exports.getRoot = function() {
    return root;
};

exports.setRoot = function(r) {
    root = r;
};

exports.query = function(q) {
    return root[q];
};

exports.update = function(u) {
    root.append(u);
};
