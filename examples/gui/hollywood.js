// requires pixi.dev.js to be loaded

var compiler = require('../../compiler.js');

var graphics;

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

function drawStanzas(sourcePath) {
    var w =  2;
    var x =  0;
    var y = 10;
    
    // delete: red, create: green

    graphics.beginFill(0x202020);
    graphics.drawRect(0,0,220,800);

    compiler.getStanzas(sourcePath).forEach(function(stanza) {
	console.log(util.format("*** %j",stanza.lines));
	stanza.draws.forEach(function(draw) {
	    switch (draw.ch) {
	    case 'R':
		graphics.lineStyle(w,0x80A0C0);
		break;
	    case 'Q':
		graphics.lineStyle(w,0xC0A080);
		break;
	    default:
		graphics.lineStyle(w,0x808080);
		break;
	    }
	    graphics.moveTo(x+draw.x*w,         y+draw.y*(w+1));
	    graphics.lineTo(x+draw.x*w+draw.n*w,y+draw.y*(w+1));
	});
	y += 3*w+stanza.draws[stanza.draws.length-1].y*(w+1);
    });
}

function installHollywood(target) {
    var    width = 1000;
    var   height =  800;
    var    stage = new PIXI.Stage(0);
    var renderer = new PIXI.WebGLRenderer(width,height);

    graphics = new PIXI.Graphics();

    target.append(renderer.view);
    
    stage.addChild(graphics);
    
    requestAnimationFrame(animate);
    
    function animate() {
	requestAnimationFrame(animate);
	
	renderer.render(stage);
    }
}
