"use strict";

const       util = require('malaya/util.js');
const     Engine = require('malaya/engine.js').Engine;
const    express = require('malaya/engine.js').express;
const bodyParser = require('body-parser');
const     minify = require('express-minify');

function WebEngine(options) {
    const eng = this;
    options.bundles = {
    };
    options.logging = true;
    Engine.call(eng,options);
    eng.addMagicOutput('_resp');
    return eng;
}
util.inherits(WebEngine,Engine);

// completely replace the engine's express app
WebEngine.prototype.createExpressApp = function() {
    const eng = this;
    const app = express();
    app.use(minify());
    app.use('/static/',express.static('www'));
    app.use(bodyParser.urlencoded({extended:true}));
    app.use(bodyParser.json());
    app.all('/REST/*',function(req,res){
        eng.update(['_req',{method:req.method,
                            url:   req.url,
                            params:req.params,
                            body:  req.body}],
                   (resp) => {
                       console.log("*** got resp: %j",resp);
                       if (resp[0]==='_resp') {
                           res.setHeader('Content-Type','application/json');
                           res.status(resp[1].code);
                           res.end(JSON.stringify(resp[1].body));
                       } } );
    });
    app.get('/',function(req,res){
        res.redirect('/static/index.html');
    });

    return app;
};


exports.Engine = WebEngine;
