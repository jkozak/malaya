"use strict";

const util = require('../util.js');

if (util.onWindows) {          // stop windows broken cleanup from making test fail
    const temp = require('temp').track();
    process.removeListener('exit',temp.cleanupSync);
    process.addListener('exit',()=>{
        try {
            temp.cleanupSync();
        } catch (e) {
            console.log("didn't delete some stuff");
        }
    });
}
