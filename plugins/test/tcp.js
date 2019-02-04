"use strict";

const   engine = require('../../engine.js');

const     path = require('path');
const     temp = require('temp').track();

describe("tcp plugin",function(){
    const   dir = temp.mkdirSync();
    let     eng;
    this.bail(true);
    after(done=>{
        eng.become('idle');
        eng.stop(true,done);
    });
    it("creates and starts engine with plugin", function(done) {
        eng = new engine.Engine({
            prevalenceDir: path.join(dir,'.prevalence'),
            businessLogic: 'plugins/test/bl/tcp.malaya'
        });
        eng.init();
        eng.start();
        eng.become('master',done);
    });
});
