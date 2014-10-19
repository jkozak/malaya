export PATH := $(PATH):./node_modules/.bin

all: init

init:
	@npm install

build: 	init

tests:	init
	NODE_ENV=test mocha --compilers chrjs:compiler -C test examples/*/test #--grep "XXX"

benchmarks:	init
	bin/chrjsc $(wildcard benchmark/*.chrjs) $(wildcard examples/*/benchmark/*.chrjs)
	NODE_ENV=test matcha -R plain $(wildcard benchmark/*.js) $(wildcard examples/*/benchmark/*.js)
	-@rm $(wildcard benchmark/*.chrjs.js) $(wildcard examples/*/benchmark/*.chrjs.js)

