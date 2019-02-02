"use strict";

const   engine = require('../../engine.js');

const     path = require('path');
const     temp = require('temp').track();

describe("tcp plugin XXX",function(){
    const   dir = temp.mkdirSync();
    let     eng;
    this.bail(true);
    after(()=>{
        eng.become('idle');
        eng.stop();
    });
    it("creates and starts engine with plugin", function() {
        eng = new engine.Engine({
            prevalenceDir: path.join(dir,'.prevalence'),
            businessLogic: 'plugins/test/bl/tcp.malaya'
        });
        eng.init();
        eng.start();
        eng.become('master');
    });
});
