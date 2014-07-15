// specimen business logic

// Die Welt ist alles, was der Fall ist.

var root;

function process(datum) {
    root.user = datum[2].user;
    root.n++;
    return root.n;
}

exports.init = function() {
    root = {user:null,
	    n:   0};
}

exports.get_root = function() {
    return root;
}

exports.set_root = function(root0) {
    root = root0;
}

exports.process = function(datum) {
    return process(datum);
}
