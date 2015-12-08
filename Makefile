ifeq ($(OS),Windows_NT)
  RM_RF = rd /s /q
else
  RM_RF = rm -rf
endif

APP_DIRS = $(wildcard examples/*)

all:	test

test benchmark:	init

init test benchmark:
	node build.js $@ malaya $(APP_DIRS)

clean:
	$(RM_RF) $(foreach d,$(APP_DIRS) malaya,$(d)/node_modules $(d)/*/*.chrjs.js)
