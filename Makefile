export PATH := $(PATH):./node_modules/.bin

all: init

init:
	@npm install

build: 	init

tests:	init
	NODE_ENV=test mocha --compilers chrjs:compiler -C test examples/*/test #--grep "XXX"

benchmarks: CHRJSS = $(wildcard benchmark/*.chrjs examples/*/benchmark/*.chrjs)
benchmarks:	init
	bin/chrjsc $(CHRJSS)
	NODE_ENV=test matcha -R plain $(sort $(wildcard benchmark/*.js examples/*/benchmark/*.js) $(patsubst %.chrjs,%.chrjs.js,$(CHRJSS)))
	-@rm $(patsubst %.chrjs,%.chrjs.js,$(CHRJSS))
