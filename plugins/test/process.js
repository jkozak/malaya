"use strict";

const   engine = require('../../engine.js');
const   plugin = require('../../plugin.js');

const       fs = require('fs');
const     path = require('path');
const     temp = require('temp').track();
const   assert = require('assert').strict;

describe("process plugin",function(){
    const   dir = temp.mkdirSync();
    let     eng;
    this.bail(true);
    after(()=>{
        eng.stopPrevalence();
        eng.stop();
    });
    after(()=>{plugin._private.reset();});
    it("creates and starts engine with plugin", function() {
        const src = path.join(dir,'proc.malaya');
        fs.writeFileSync(src,`
module.exports = store {
    rule (-['restart',{...},{...}],
          +['spawn',{command:'ls',args:['-al','${dir}'],opts:{}},{dst:'process'}] );
}
    .plugin('restart')
    .plugin('process');
`);
        eng = new engine.Engine({
            prevalenceDir: path.join(dir,'.prevalence'),
            magic:         [],
            ports:         {},
            debug:         true,
            businessLogic: src
        });
        eng.init();
        eng.start();
        eng.become('master');
    });
    it("has listed files in test dir",function() {
        const facts = eng.chrjs._private.orderedFacts;
        assert.equal(facts.length,7);
        assert.equal(facts[0][0],'start');
        assert.equal(facts[1][0],'stdout'); assert(facts[1][1].data.startsWith('total '));
        assert.equal(facts[2][0],'stdout'); assert(facts[2][1].data.endsWith(' .'));
        assert.equal(facts[3][0],'stdout'); assert(facts[3][1].data.endsWith(' ..'));
        assert.equal(facts[4][0],'stdout'); assert(facts[4][1].data.endsWith(' .prevalence'));
        assert.equal(facts[5][0],'stdout'); assert(facts[5][1].data.endsWith(' proc.malaya'));
        assert.equal(facts[6][0],'exit');   assert.equal(facts[6][1].code,0);
    });
});
