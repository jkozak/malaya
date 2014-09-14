var root;

exports.init = function() {
    root = [];
};
exports.get_root = function() {
    return root;
};

exports.set_root = function(r) {
    root = r;
};

exports.query = function(q) {
    return root[q];
};

exports.update = function(u) {
    root.append(u);
};
