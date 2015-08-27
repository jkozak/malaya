ifeq ($(OS),Windows_NT)
  export PATH  := $(PATH);.\node_modules\.bin
  export SHELL := wsh.cmd
else
  export PATH  := $(PATH):./node_modules/.bin
endif

all: init

init:
	@npm install
ifeq (,$(wildcard /usr/bin/env)) # is it guix?
	sed -e 's_^#!/usr/bin/env _#!/run/current-system/profile/bin/env _' -i $(shell find . -type f -and -executable -print)
endif

build: 	init

tests:	init
	eslint -c test/eslint.conf -f test/eslint-formatter-comment.js --env node $(filter-out %.chrjs.js,$(wildcard *.js examples/*/*.js))
	eslint -c test/eslint.conf -f test/eslint-formatter-comment.js --env browser $(filter-out %.chrjs.js,$(wildcard www/*.jsx www/*.jsx examples/*/www/*.js examples/*/www/*.jsx))
	NODE_ENV=test mocha -R min --compilers chrjs:compiler -C test examples/*/test #--grep "XXX"

benchmarks: CHRJSS = $(wildcard benchmark/*.chrjs examples/*/benchmark/*.chrjs)
benchmarks:	init
	$(foreach chrjs,$(CHRJSS),NODE_ENV=benchmark ./malaya compile $(chrjs);)
	NODE_ENV=benchmark matcha -R plain $(sort $(wildcard benchmark/*.js examples/*/benchmark/*.js) $(patsubst %.chrjs,%.chrjs.js,$(CHRJSS)))
	-@rm $(patsubst %.chrjs,%.chrjs.js,$(CHRJSS))

clean:
	rm -rf node_modules/* examples/*/node_modules/*

