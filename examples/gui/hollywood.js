// requires pixi.dev.js to be loaded

var compiler = require('../../compiler.js');

var graphics;

var codeDraws = {};		// <name> -> [[[<x>,<y>],<draw>],...]

function installBunny(target) {
    var    stage = new PIXI.Stage(0x66FF99);
    var renderer = new PIXI.WebGLRenderer(400,300);

    target.append(renderer.view);
    
    var texture = PIXI.Texture.fromImage("node_modules/pixi.js/test/textures/bunny.png");
    var   bunny = new PIXI.Sprite(texture);
    
    bunny.anchor.x   = 0.5;
    bunny.anchor.y   = 0.5;
    bunny.position.x = 200;
    bunny.position.y = 150;
    
    stage.addChild(bunny);
    
    requestAnimationFrame(animate);
    
    function animate() {
	requestAnimationFrame(animate);
	bunny.rotation += 0.1;
	renderer.render(stage);
    }
}

var lineWidth = 2;
function initStanzas(sourcePath) {
    var x =  0;
    var y = 10;
    
    compiler.getStanzas(sourcePath).forEach(function(stanza) {
	stanza.draws.forEach(function(draw) {
	    if (codeDraws[draw.node.id.name]===undefined)
		codeDraws[draw.node.id.name] = [];
	    codeDraws[draw.node.id.name].push([[x,y,Date.now()],draw]);
	});
	y += 3*lineWidth+stanza.draws[stanza.draws.length-1].y*(lineWidth+1);
    });
    
    //webGLStart(codeDraws);
}

function updateCodeDraw(name) {
    var now = Date.now();
    codeDraws[name].forEach(function(cd) {
	cd[0][2] = Date.now();
    });
}

function drawCode(name) {
    var    now = Date.now();
    var tDecay = 500.0;		// ms

    // ??? why don't these work? ???
    //     (loses most of the code lines)
    //graphics.beginFill(0x202020);
    //graphics.drawRect(0,0,220,800);

    codeDraws[name].forEach(function(cd) {
	var   xy = cd[0];
	var now0 = cd[0][2];
	var draw = cd[1];
	var   ts = 1-Math.max(Math.min(now-now0,tDecay),0)/tDecay;
	var setLineStyle = function(r0,r1,g0,g1,b0,b1) {
	    var r = r0+(r1-r0)*ts;
	    var g = g0+(g1-g0)*ts;
	    var b = b0+(b1-b0)*ts;
	    graphics.lineStyle(lineWidth,(r<<16)+(g<<8)+b);
	};
	switch (draw.ch) {
	case 'R':
	    setLineStyle(0x80,0x80,0xA0,0xC0,0xC0,0xF0);
	    break;
	case 'Q':
	    setLineStyle(0xC0,0xF0,0xA0,0xC0,0x80,0x80);
	    break;
	case '+':
	    setLineStyle(0x80,0x00,0x80,0xC0,0x80,0x00);
	    break;
	case '-':
	    setLineStyle(0x80,0xC0,0x80,0x00,0x80,0x00);
	    break;
	case 'M':
	    setLineStyle(0x80,0xF0,0x80,0xF0,0x80,0x00);
	    break;
	default:
	    setLineStyle(0x80,0xC0,0x80,0xC0,0x80,0xC0);
	    break;
	}
	graphics.moveTo(xy[0]+draw.x*lineWidth,                 xy[1]+draw.y*(lineWidth+1));
	graphics.lineTo(xy[0]+draw.x*lineWidth+draw.n*lineWidth,xy[1]+draw.y*(lineWidth+1));
    });
}

var       factDim;
var   factsOffset = 220;
var freeFactSlots;
var  displayFacts = {};		// <t>:<DisplayFact>,...

function addFact(t) {
    var sprite;			// +++ create sprite
    //var    pos = freeFactSlots.slice(0,1);
    //sprite.position(pos[0],pos[1]);
    //graphics.add(sprite);
}

function delFact(t) {
}

function drawFacts() {
}

function installHollywood() {
    // setup `freeFactSlots`
    freeFactSlots = [];
}
