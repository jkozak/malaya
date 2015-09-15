// barely enough of a shell to use GNU make for nodejs under windows
// 

"use strict";

var   glob = require('glob');
var rimraf = require('rimraf');
var  child = require('child_process');
var VError = require('verror');

var doCmd = function(tokens,opts) {
    var     env = {};
    var     exe = null;
    var comment = false;
    var    rest = [];

    opts = opts || {
        exec:child.execSync,
        rmRF:rimraf.sync
    };

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
        if (rest[0]!=='-rf')
            throw new VError("rm must specify -rf as first argument");
        rest.slice(1).forEach(function(d) {
            opts.rmRF(d);
        });
    } else {
        var cmd = [exe].concat(rest).join(' ');
        try {
            opts.exec(cmd,{stdio:'inherit',env:env});
        } catch (e) {
            return e.status;
        }
    }
    return 0;
};

if (process.env.NODE_ENV==='test') {
    exports._private = {
        doCmd:    doCmd
    };
} else {
    process.exit(doCmd(process.argv.slice(1)));    /* eslint no-process-exit:0 */
}

