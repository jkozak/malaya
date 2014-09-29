all: init

init:
	@npm install

build: 	init

tests:	init
	NODE_ENV=test ./node_modules/.bin/mocha --compilers chrjs:chrjs -C #--grep "XXX"

benchmarks:	init
	NODE_ENV=test ./node_modules/.bin/matcha -R plain
