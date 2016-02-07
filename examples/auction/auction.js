"use strict";

const   path = require('path');
const   util = require('malaya/util.js');
const Engine = require('malaya/engine.js').Engine;


function AuctionEngine(options) {
    const eng = this;
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
    const ans = this.gensym();;
    this.update(['newAuction',{id:ans}]);
    return ans;
};

AuctionEngine.prototype.nextPlayerId = function(auctionId) {
    const ans = this.gensym();
    this.update(['newPlayer',{auctionId:auctionId,id:ans}]);
    return ans;
};

AuctionEngine.prototype.closeConnection = function(portName) {
    const eng = this;
    const  io = eng.conns[portName];
    if (io && !io.closing) { // can be called more than once, allow for that
        eng.update(['logoff',{},{port:portName}],function() {
            Engine.prototype.closeConnection.call(eng,portName);
        });
    }
};

AuctionEngine.prototype.createExpressApp = function() {
    const eng = this;
    const app = Engine.prototype.createExpressApp.call(eng);

    app.get('/new-auction',function(req,res) {
        res.redirect('/auction/'+this.nextAuctionId());
    });

    app.get('/new-player/*',function(req,res) {
        const     parts = req.path.split('/').slice(2);
        const auctionId = parts[0];
        res.redirect('/auction/'+auctionId+'/'+this.nextPlayerId(auctionId));
    });

    app.get('/auction/*',function(req,res) {
        const  parts = req.path.split('/').slice(2);
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
