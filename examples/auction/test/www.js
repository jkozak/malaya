"use strict";

var     jsdom = require('jsdom');
var     React = require('react/addons');
var TestUtils = React.addons.TestUtils;

require('node-jsx').install();

var    assert = require('assert');
var        fs = require('fs');
var      path = require('path');
var      util = require('malaya').util;

describe("www",function() {
    var saveWebSocket;
    var setupJsDomGlobally = function() {
        saveWebSocket         = global.WebSocket;
        global.WebSocket      = null;
        global.document       = jsdom.jsdom('<!doctype html><html><body></body></html>');
        global.window         = document.parentWindow;
        global.navigator      = window.navigator = {userAgent:"jsdom"};
        global.sessionStorage = {getItem:function(){return null;}};
    };
    describe("index",function() {
        var onLoad = null;
        var trigger = function(el,ev) {
            var e = document.createEvent('UIEvents');
            e.initEvent(ev,true,true);
            el.dispatchEvent(e);
        };
        
        before(function() {
            // I suspect there's a better way of doing this
            setupJsDomGlobally();
            require('../www/index.jsx');
            onLoad = document.body.onload;
        });
        beforeEach(function() {
            setupJsDomGlobally();
        });
        afterEach(function() {
            global.document  = global.window = global.navigator = global.sessionStorage = undefined;
            global.WebSocket = saveWebSocket;
        });
        
        describe("logon",function() {
            it("starts",function(done) {
                onLoad();
                console.log("*** html: %s",window.document.documentElement.outerHTML);
                var   user = document.getElementsByName('user')[0];
                var     pw = document.getElementsByName('pw')[0];
                var submit = document.getElementById('go');
                var    msg = document.getElementById('msg');
                var   sock;
                user.value = "Jimmy";trigger(user,'change'); // !!! trigger doesn't get to React !!!
                pw.value   = "sdffg";trigger(pw,  'change');
                //console.log("*** go: %s %s %s",user.outerHTML,pw.outerHTML,submit.outerHTML);
                global.WebSocket = function() {
                    var ans = {
                        onopen: function() {
                            console.log("*** open discarded");
                        },
                        send: function(x) {
                            console.log("*** send: %j",x);
                        }
                    };
                    sock = ans;
                    return ans;
                };
                submit.click();
                setImmediate(function() {
                    sock.onopen();
                    //console.log("*** msg: %s",msg.outerHTML);
                    done();
                });
            });
        });
    });
    describe("auction",function() {
        var Auction = require('../www/auction.jsx').Auction;
        beforeEach(function() {
            setupJsDomGlobally();
        });
        afterEach(function() {
            global.document  = global.window = global.navigator = global.sessionStorage = undefined;
            global.WebSocket = saveWebSocket;
        });
        
    });
});


