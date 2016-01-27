"use strict";

const       path = require('path');
const       util = require('malaya/util.js');
const     Engine = require('malaya/engine.js').Engine;
const    express = require('malaya/engine.js').express;
const bodyParser = require('body-parser');

function WebEngine(options) {
    const eng = this;
    options.bundles = {
    };
    options.logging = true;
    Engine.call(eng,options);
    return eng;
}
util.inherits(WebEngine,Engine);

WebEngine.prototype.createExpressApp = function() {
    const eng = this;
    const app = Engine.prototype.createExpressApp.call(eng);

    app.use('/static/',express.static('www'));
    app.use(bodyParser.urlencoded({extended:true}));
    app.use(bodyParser.json());
    app.all('/REST/*',function(req,res){
        console.log("   req: %j %j %j",req.method,req.url,req.params);
        if (req.method==='POST')
            console.log("    body: %j",req.body);
        eng.update(['http',{method:req.method,
                            url:   req.url,
                            params:req.params,
                            body:  req.body}]);
        res.send(200);
    });
    app.get('/',function(res,req){
        res.redirect('/static/index.html');
    });

    // +++ setup output handler for engine +++

    return app;
};


exports.Engine = WebEngine;
