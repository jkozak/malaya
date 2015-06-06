ifeq ($(OS),Windows_NT)
  SHELL = bash
  export PATH := $(PATH);.\node_modules\.bin
else
  export PATH := $(PATH):./node_modules/.bin
endif

all: init

init:
	@npm install

build: 	init

tests:	init
	eslint -c test/eslint.conf -f test/eslint-formatter-comment.js --env node $(filter-out %.chrjs.js,$(wildcard *.js examples/*/*.js))
	NODE_ENV=test mocha -R min --compilers chrjs:compiler -C test examples/*/test #--grep "XXX"

benchmarks: CHRJSS = $(wildcard benchmark/*.chrjs examples/*/benchmark/*.chrjs)
benchmarks:	init
	$(foreach chrjs,$(CHRJSS),NODE_ENV=benchmark ./malaya compile $(chrjs);)
	NODE_ENV=benchmark matcha -R plain $(sort $(wildcard benchmark/*.js examples/*/benchmark/*.js) $(patsubst %.chrjs,%.chrjs.js,$(CHRJSS)))
	-@rm $(patsubst %.chrjs,%.chrjs.js,$(CHRJSS))

clean:
	rm -rf node_modules/* examples/*/node_modules/*

