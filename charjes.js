// parser for javascript extended with CHR

// example:
//
//  store facts() {
//      rule (['update-instrument',name,new_name];-['instrument',name]) {
//  	    +['instrument',new_name];
//      }
//  }
//  facts.add(['instrument','5T18']);

"use strict";


