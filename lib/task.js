var INHERIT = require('inherit'),
    PATH = require('path'),
    FS = require('fs');

module.exports = INHERIT({

    __constructor : function(tech, config, scope) {
        this.tech = tech;
        this.plugin = config.plugin;
        this.type = config && config.type || this._DEFAULT_PROCESS_TYPE;
        this.scope = scope || {};
    },

    _DEFAULT_PROCESS_TYPE : 'process',

    _prepareScope : function() {
        var scope = this.scope || {};

        scope.tech = this.tech;
        scope.taskId = this.id;

        return scope;
    },

    process : function() {
        var pluginName = this.plugin,
            processType = this.type,
            plugin,
            handler,
            result;

        try {
            plugin = this.__self.getPlugin(pluginName);
            if ( ! plugin) {
                throw new Error(pluginName + ' plugin is not found.');
            }

            handler = plugin[processType];
            if (typeof handler !== 'function') {
                if (processType === this._DEFAULT_PROCESS_TYPE && typeof plugin === 'function') {
                    handler = plugin;
                } else {
                    throw new Error(processType + ' handler is not defined in ' + pluginName + ' plugin.');
                }
            }

            result = handler.apply(this._prepareScope(), arguments || []);
            if ( ! result) {
                throw new Error(pluginName + '#' + processType + ' handler result is bad. Task: ' + this);
            }
        } catch (err) {
            console.log('Task processing failed: ', err + '\n', err.stack);
        }

        this.result = result;

        return result;
    }

}, {

    _pluginsPath : './lib/plugins',

    _plugins : null,

    _loadPlugins : function(pluginsPath) {
        var resolvedPluginsPath = FS.realpathSync(pluginsPath),
            files = FS.readdirSync(resolvedPluginsPath),
            plugins = {};

        if (files) {
            files.forEach(function(file) {
                var resolvedPluginPath = PATH.resolve(resolvedPluginsPath,  file),
                    plugin;

                try {
                    if (FS.realpathSync(resolvedPluginPath)) {
                        plugin = require(resolvedPluginPath);
                    }
                    if (
                        plugin && typeof plugin === 'function' ||
                        typeof plugin.process === 'function' ||
                        typeof plugin.post_process === 'function'
                    ) {
                        plugins[file.replace('.js', '')] = plugin;
                    }
                } catch(e) {
                    console.warn(e)
                }
            }, this);
        }

        return plugins;
    },

    getPlugins : function() {
        return this._plugins || (this._plugins = this._loadPlugins(this._pluginsPath));
    },

    getPlugin : function(pluginName) {
        var plugins = this.getPlugins(),
            plugin = null;

        if (plugins && plugins[pluginName]) {
            plugin = plugins[pluginName];
        }

        return plugin;
    }

});
