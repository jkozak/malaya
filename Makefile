APP_DIRS = examples/chat examples/idb examples/auction

init:
	(cd wsh;npm install;npm link)
	(cd malaya;npm install;npm link)
	for d in $(APP_DIRS); do (cd $$d;npm link malaya;npm install); done

test:	init
	for d in wsh malaya $(APP_DIRS); do (cd $$d;npm test); done

benchmark: CHRJSS = $(wildcard malaya/benchmark/*.chrjs examples/*/benchmark/*.chrjs)
benchmark:	init
	$(foreach chrjs,$(CHRJSS),NODE_ENV=benchmark malaya/malaya compile $(chrjs);)
	for d in malaya $(APP_DIRS); do (cd $$d;npm run benchmark); done
	-@rm $(patsubst %.chrjs,%.chrjs.js,$(CHRJSS))

clean:
	for d in $(APP_DIRS) malaya wsh; do (cd $$d;rm -rf node_modules */*.chrjs.js); done
