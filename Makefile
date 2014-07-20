all: init

init:
	@npm install

build: 	init


tests:	init
	./node_modules/.bin/mocha -C


