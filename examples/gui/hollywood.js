// requires pixi.dev.js to be loaded

function installHollywood(target) {
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
