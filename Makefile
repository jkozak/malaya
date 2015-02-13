export PATH := $(PATH):./node_modules/.bin

all: init

init:
	@npm install

build: 	init

tests:	init
	node_modules/.bin/eslint -c test/eslint.conf -f test/eslint-formatter-comment.js --env node $(filter-out %.chrjs.js,$(wildcard *.js examples/*/*.js))
	NODE_ENV=test mocha -R min --compilers chrjs:compiler -C test examples/*/test #--grep "XXX"

benchmarks: CHRJSS = $(wildcard benchmark/*.chrjs examples/*/benchmark/*.chrjs)
benchmarks:	init
	bin/chrjsc $(CHRJSS)
	NODE_ENV=test matcha -R plain $(sort $(wildcard benchmark/*.js examples/*/benchmark/*.js) $(patsubst %.chrjs,%.chrjs.js,$(CHRJSS)))
	-@rm $(patsubst %.chrjs,%.chrjs.js,$(CHRJSS))

