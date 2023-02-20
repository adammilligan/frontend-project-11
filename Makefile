install: #install
	npm ci

link:
	npm link

publish:
	npm publish --dry-run

lint: #linter
	npx eslint .