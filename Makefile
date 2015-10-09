init:
	(cd wsh;npm install;npm link)
	(cd malaya;npm install;npm link)
	(cd examples/chat;npm link malaya;npm install)
	(cd examples/idb;npm link malaya;npm install)
	(cd examples/auction;npm link malaya;npm install)

test:	init
	(cd wsh;npm test)
	(cd malaya;npm test)
	(cd examples/chat;npm test)
	(cd examples/idb;npm test)
	(cd examples/auction;npm test)

benchmark: CHRJSS = $(wildcard malaya/benchmark/*.chrjs examples/*/benchmark/*.chrjs)
benchmark:	init
	$(foreach chrjs,$(CHRJSS),NODE_ENV=benchmark malaya/malaya compile $(chrjs);)
	(cd malaya;npm run benchmark)
	(cd examples/chat;npm run benchmark)
	(cd examples/idb;npm run benchmark)
	(cd examples/auction;npm run benchmark)
	-@rm $(patsubst %.chrjs,%.chrjs.js,$(CHRJSS))

clean:
	(cd wsh;rm -rf node_modules)
	(cd malaya;rm -rf node_modules)
	(cd examples/chat;rm -rf node_modules)
	(cd examples/idb;rm -rf node_modules)
	(cd examples/auction;rm -rf node_modules)
