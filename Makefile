all: init

init:
	@npm install

build: 	init


tests:	init
	NODE_REGIME=test ./node_modules/.bin/mocha -C


