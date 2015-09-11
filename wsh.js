// barely enough of a shell to use GNU make for nodejs under windows
// 
// should be a module by itself

"use strict";

var   glob = require('glob');
var   rmRF = require('rimraf');
var  child = require('child_process');
var     sq = require('shell-quote');
var VError = require('verror');

// +++ check argv[1] too +++
if (process.argv[0]!=='node' || process.argv[2]!=='-c') {
    throw new Error("unexpected call: %j",process.argv);
}

var doCmd = function(tokens) {
    var     env = {};
    var     exe = null;
    var comment = false;
    var    rest = [];

    tokens.forEach(function(token) {
        if (exe===null) {
            var m = token.match(/^([^=]+)=([^=]+)$/);
            if (m) 
                env[m[1]] = m[2];
            else 
                exe = token;
        } else if (token[0]==='#') {
            comment = true;
        } else if (comment) {
            /* eslint no-empty:0 */
        } else if ((typeof token)==='string') {
            // +++ $ENVVAR expansion +++
            rest.push(token);
        } else if (token.op==='glob') {
            rest = rest.concat(glob.sync(token.pattern));
        } else {
            throw new VError("unknown token: %j",token);
        }
    });

    if (exe[0]==='#') {
        // nothing to do
    } else if (exe==='rm') {
        rest.forEach(function(d) {
            rmRF.sync(d);
        });
    } else {
        try {
            child.execSync(sq.quote([exe].concat(rest)),{stdio:'inherit',env:env});
            return 0;
        } catch (e) {
            return e.status;
        }
    }
};

process.exit(doCmd(sq.parse(process.argv[3])));    /* eslint no-process-exit:0 */

