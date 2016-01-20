"use strict";

var    path = require('path');
var    util = require('malaya/util.js');
var  Engine = require('malaya/engine.js').Engine;


function AuctionEngine(options) {
    var eng = this;
    options.bundles = {
        "/bundle.js":[path.join(process.cwd(),'www/index.jsx')]
    };
    options.logging = true;
    Engine.call(eng,options);
    eng.iGensym = 0;
    return eng;
}

util.inherits(AuctionEngine,Engine);

AuctionEngine.prototype.gensym = function() {
    return 'id'+(++this.iGensym);
};

AuctionEngine.prototype.nextAuctionId = function() {
    var ans = this.gensym();;
    this.update(['newAuction',{id:ans}]);
    return ans;
};

AuctionEngine.prototype.nextPlayerId = function(auctionId) {
    var ans = this.gensym();
    this.update(['newPlayer',{auctionId:auctionId,id:ans}]);
    return ans;
};

AuctionEngine.prototype.closeConnection = function(portName) {
    var eng = this;
    var  io = eng.conns[portName];
    if (io && !io.closing) { // can be called more than once, allow for that
        eng.update(['logoff',{},{port:portName}],function() {
            Engine.prototype.closeConnection.call(eng,portName);
        });
    }
};

AuctionEngine.prototype.createExpressApp = function() {
    var eng = this;
    var app = Engine.prototype.createExpressApp.call(eng);

    app.get('/new-auction',function(req,res) {
        res.redirect('/auction/'+this.nextAuctionId());
    });

    app.get('/new-player/*',function(req,res) {
        var     parts = req.path.split('/').slice(2);
        var auctionId = parts[0];
        res.redirect('/auction/'+auctionId+'/'+this.nextPlayerId(auctionId));
    });

    app.get('/auction/*',function(req,res) {
        var  parts = req.path.split('/').slice(2);
        //var auctionId = parts[0];
        switch (parts.len) {
        case 1:
            // +++ auction control
            break;
        case 2: {
            //var playerId = parts[1];
            // +++ auction itself
            break;
        }
        default:
            res.status(404);
            res.end();
        }
    });

    return app;
};

exports.Engine = AuctionEngine;
