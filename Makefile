all: init

init:
	@npm install

build: 	init

tests:	init
	NODE_ENV=test ./node_modules/.bin/mocha -C

benchmarks:	init
	NODE_ENV=test ./node_modules/.bin/matcha -R plain
