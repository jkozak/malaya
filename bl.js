// specimen business logic

// Die Welt ist alles, was der Fall ist.

var root;

function update(datum) {
    switch (datum[0]) {
    case 'I_AM':
	if (datum[2]=='a')
	    return ['HI',datum[1]];
	return ['ERR',"nope"];
    case 'TICK':
	if (datum)
	    root.user = datum[2].user;
	root.n++;
	return ['TICK',n];
    case 'REQUEST_CONTEXT':
	return ['ERR','NYI'];
    default:
	return ['ERR',"??? "+JSON.stringify(datum)];
    }
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

exports.update = function(datum) {
    return update(datum);
}

