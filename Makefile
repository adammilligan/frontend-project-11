install: #install
	npm ci

develop:#run
	npx webpack serve

lint: #linter
	npx eslint .
