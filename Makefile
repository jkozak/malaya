all: init

init:
	@npm install

build: 	init

tests:	init
	NODE_ENV=test ./node_modules/.bin/mocha --compilers chrjs:compiler -C #--grep "XXX"

benchmarks:	init
	bin/chrjsc benchmark/*.chrjs
	NODE_ENV=test ./node_modules/.bin/matcha -R plain
	-@rm benchmark/*.chrjs.js
