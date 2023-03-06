install: #install
	npm ci

develop:#run
	npx webpack serve

build:#project build
	rm -rf public
	NODE_ENV=production npx webpack

lint: #linter
	npx eslint .
