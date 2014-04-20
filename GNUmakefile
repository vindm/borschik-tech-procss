.PHONY: tests test base64

tests: base64

base64:
	../borschik/bin/borschik -t . -i test/base64/base64.css -o test/base64/_base64.css --minimize no

test:
	./node_modules/.bin/mocha --reporter spec
