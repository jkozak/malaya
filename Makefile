ifeq ($(OS),Windows_NT)
  SHELL = c:/Utils/zsh.exe
  RM    = c:/Utils/rm.py
  export PATH := $(PATH);.\node_modules\.bin
else
  RM    = rm
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
	NODE_ENV=benchmark bin/chrjsc $(CHRJSS)
	NODE_ENV=benchmark matcha -R plain $(sort $(wildcard benchmark/*.js examples/*/benchmark/*.js) $(patsubst %.chrjs,%.chrjs.js,$(CHRJSS)))
	-@$(RM) $(patsubst %.chrjs,%.chrjs.js,$(CHRJSS))

clean:
	$(RM) -rf node_modules/* examples/*/node_modules/*

