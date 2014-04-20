var ASSERT = require("assert");

describe('PROCSS#Base64()', function() {

    var PATH = require('path'),
        FS = require('fs'),
        BORSCHIK = require('borschik');

    const techPath = PATH.resolve(__dirname, '..');
    const basePath = PATH.resolve(__dirname, 'base64');

    afterEach(function(cb) {
        require('child_process').exec('rm -rf ' + basePath + '/*-out.*', function() {
            cb();
        });
    });

    const TESTS = [
        { name : 'should inline png images in css', file : 'png.css' },
        { name : 'should inline gif images in css', file : 'gif.css' },
        { name : 'should inline svf files in css', file : 'svg.css' }
    ];

    TESTS.forEach(function(test) {
        var input = PATH.resolve(basePath, test.file),
            ext = PATH.extname(input),
            output = PATH.resolve(basePath, test.file.replace(ext, '-out' + ext)),
            expect = PATH.resolve(basePath, test.file.replace(ext, '-expect' + ext));

        it(test.name, function(cb) {
            BORSCHIK
                .api({
                    'comments': false,
                    'freeze': true,
                    'input': input,
                    'minimize': false,
                    'output': output,
                    'tech': techPath
                })
                .then(function() {
                    try {
                        ASSERT.equal(
                            FS.readFileSync(output, 'utf-8'),
                            FS.readFileSync(expect, 'utf-8')
                        );
                        cb();
                    } catch(e) {
                        cb(e.toString());
                    }
                })
                .fail(function(e) {
                    cb(e.toString());
                });
        });

    });

});
