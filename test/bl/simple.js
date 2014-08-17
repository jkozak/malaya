var root;

exports.init = function() {
    root = {n:100};
};
exports.get_root = function() {
    return root;
};

exports.set_root = function(r) {
    root = r;
};

exports.query = function(q) {
    if (q=='n')
	return root.n;
};

exports.update = function(u) {
    if (u=='tick')
	root.n++;
};
