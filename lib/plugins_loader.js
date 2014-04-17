var PATH = require('path'),
    FS = require('fs');

var PluginsLoader = function(pluginsPath) {
    this.plugins = {};

    this.load(pluginsPath);
};

PluginsLoader.prototype.plugins = {};

PluginsLoader.prototype.load = function(pluginsPath) {
    var resolvedPath = FS.realpathSync(pluginsPath),
        files = FS.readdirSync(resolvedPath),
        plugin;

    if (files) {
        files.forEach(function(file) {
            try {
                plugin = require(PATH.resolve(resolvedPath,  file));

                if (
                    plugin &&
                    typeof plugin.process === 'function' ||
                    typeof plugin.post_process === 'function'
                ) {
                    this.plugins[file.replace('.js', '')] = plugin;
                }
            } catch(e) {
                console.warn(e)
            }
        }, this);
    }
};

module.exports = PluginsLoader;
