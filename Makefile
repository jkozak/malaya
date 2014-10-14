export PATH := $(PATH):./node_modules/.bin

all: init

init:
	@npm install

build: 	init

tests:	init
	NODE_ENV=test mocha --compilers chrjs:compiler -C test examples/*/test #--grep "XXX"

benchmarks:	init
	bin/chrjsc benchmark/*.chrjs
	NODE_ENV=test matcha -R plain
	-@rm benchmark/*.chrjs.js
