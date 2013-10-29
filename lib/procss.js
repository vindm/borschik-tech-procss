var INHERIT = require('inherit'),
    VOW = require('vow'),
    cssbase = require('borschik').getTech('css'),

    keyword = 'borschik',
    commandRe = '\\/\\*\\s*' + keyword + '\\.((?:\\S)*?)\\(([^)]*?)\\)' + '\\s*\\*\\/',
    selectorRe = '[^{;}\\/]*?',
    simpleDeclRe = '[^}]*?',
    simpleRuleRe = '\\s*(' + selectorRe + ')\\s*{([^}]*?)}',
    declPropRe = '\\S+?',
    declValueRe = '[^;]*?',
    declRe = '\\s*' + declPropRe + '\\s*:\\s*' + declValueRe + '\\s*';

exports.Tech = INHERIT(cssbase.Tech, {

    process: function(path, out) {
        var _this = this;

        return this
            .postProcess(this.createFile(path, 'include').process(path))
            .then(function(result) {
                return _this.write(out, _this.opts.minimize ? _this.minimize(result) : result);
            });
    },

    postProcess: function(processResult) {
        var _this = this,
            postProcessTasks = this.postProcessTasks,
            postProcessResult = VOW.promise(processResult);

        if (postProcessTasks) {
            postProcessResult = Object.keys(postProcessTasks)
                .reduce(function(postProcessResult, taskName) {
                    var task = postProcessTasks[taskName];

                    if (task && task instanceof _this.Task) {
                        postProcessResult = postProcessResult
                            .then(task.process.bind(task));
                    } else {
                        console.log('Bad postProcessTask: ', task ||
                            'Task ' + taskName + ' is not defined');
                    }

                    return postProcessResult;

                }, postProcessResult)
        }

        return postProcessResult;
    },

    createTask: function(taskName, params) {
        var task = null;

        if (taskName) {
            task = new this.Task(this, taskName, params);
        }

        return task;
    },

    createPostProcessTask: function(taskName, params) {
        params || (params = {});
        params.type = 'post_process';

        this.postProcessTasks || (this.postProcessTasks = {});
        this.postProcessTasks[taskName] = this
            .createTask(taskName, params);

        return this.postProcessTasks[taskName];
    },

    createRule: function(ruleStr) {
        var rule;

        if (ruleStr && typeof ruleStr === 'string') {
            ruleStr = ruleStr.trim();

            if (ruleStr !== '') {
                rule = new this.Rule(ruleStr);
            }
        }

        return rule;
    },

    createTaskFromRule: function(rule, params) {
        if (typeof rule === 'string') {
            rule = this.createRule(rule);
        }

        if (rule && rule instanceof this.Rule && rule.command) {
            params && typeof params === 'object' || (params = {});

            params.rule = rule;
            params.parsed = rule.command.params;
            params.commandDecl = rule.command.decl;

            return this.createTask(rule.command.name, params);
        }
    },

    File: exports.File = INHERIT(cssbase.File, {

        parseInclude: function(content) {
            var ruleWithCommandRe = '\\s*(' + this.__self.selectorRe + ')\\s*' +
                    '{(' +
                    '[^}]*?' +
                    '\\s*' + this.__self.declRe + '\\s*;\\s*' + this.__self.commandRe + '\\s*' +
                    '[^}]*?' +
                    ')}',
                declsBlockWithCmdRx = new RegExp('^' + ruleWithCommandRe, 'mg'),
                found = [],
                m;

            if (Buffer.isBuffer(content)) {
                content = content.toString('utf8');
            }

            while (m = declsBlockWithCmdRx.exec(content)) {
                var rule = m && m[0],
                    task = rule && this.tech.createTaskFromRule(rule, {
                        filePath: this.path
                    }),
                    result = task && task.process.apply(task);

                if (result) {
                    found.push({
                        range: [m.index, declsBlockWithCmdRx.lastIndex],
                        result: result
                    });
                }
            }

            return this.__base(this.__self.makeParsed(found, content));
        }

    }, {

        keyword: keyword,
        commandRe: commandRe,
        selectorRe: selectorRe,
        simpleDeclRe: simpleDeclRe,
        simpleRuleRe: simpleRuleRe,
        declRe: declRe,

        makeParsed: function(items, content) {
            var result = [],
                lastInd = 0;

            items.forEach(function(item) {
                if (lastInd > item.range[0]) throw 'index out of range';
                if (lastInd < item.range[0]) {
                    result.push(content.substring(lastInd, item.range[0]));
                }

                result.push(item.result);
                lastInd = item.range[1];
            });

            if (content && lastInd < content.length) {
                result.push(content.substring(lastInd));
            }

            return result.join('');
        }

    }),

    Rule: exports.Rule = INHERIT({

        __constructor: function(rawString) {
            try {
                var ruleRx = new RegExp(simpleRuleRe, 'm'),
                    found = ruleRx.exec(rawString);

                if (found && found[1] && found[2]) {
                    this.selector = found[1];
                    this.decls = this.parseDeclarations(found[2]);
                    this.command = this.getCommandFromDecl();
                } else {
                    throw new Error('Rule not found');
                }
            } catch (err) {
                console.log('Rule constructing failed', err);

                return null;
            }
        },

        parseDeclarations: function(content) {
            var decls = {};

            if (typeof content === 'string') {
                decls = content.split('\n')
                    .reduce(function(decls, decl) {
                        decl = decl.trim();
                        if (decl === '') return decls;

                        decl = decl.split(':');

                        var prop = decl[0].trim(),
                            valueParts = decl[1].trim().split(';'),
                            value = valueParts[0],
                            tail = valueParts[1] || '';

                        decls[prop] = {
                            prop: prop,
                            value: value,
                            tail: tail
                        };

                        return decls;
                    }, {});
            }

            return decls;
        },

        getCommandFromDecl: function(decl) {
            var rule = this,
                decls = this.decls,
                str,
                command;

            if (
                typeof decl === 'object' &&
                    typeof decl.tail === 'string'
                ) {
                str = decl.tail;
            } else if (typeof decl === 'string') {
                str = decl;
            }

            if (str && str.indexOf('/*') !== -1) {
                command = this.parseCommand(str);
            } else {
                decls && Object.keys(decls).some(function(declName) {
                    decl = decls[declName];
                    if (decl.tail && decl.tail.indexOf('/*') !== -1) {
                        command = rule.parseCommand(decl.tail);

                        if (command) {
                            command.decl = decl.prop;
                        }

                        return command;
                    }
                });
            }

            return command;
        },

        parseCommand: function(str) {
            var commandRx = new RegExp(commandRe),
                cmd = commandRx.exec(str),
                command;

            if (cmd && cmd[1]) {
                command = {
                    full: cmd[0],
                    name: cmd[1],
                    params: cmd[2]
                };
            }

            return command;
        },

        toString: function() {
            var rule = this;

            return rule.selector +
                ' {' +
                Object.keys(rule.decls)
                    .reduce(function(str, decl) {
                        decl = rule.decls[decl];

                        var tail = decl.tail;

                        if (rule.command && rule.command.decl === decl.prop) {
                            tail = tail
                                .replace(rule.command.full, '').trim();
                        }

                        return str + '\n\t' +
                            decl.prop + ': ' + decl.value + ';' + tail;
                    }, '') +
                '\n}';
        },

        get: function(prop) {
            return this.decls[prop] && this.decls[prop].value;
        },

        set: function(prop, value, tail) {
            if (this.decls[prop]) {
                this.decls[prop].value = value;
                tail &&
                (this.decls[prop].tail = tail);
            } else {
                this.decls[prop] = {
                    prop: prop,
                    value: value,
                    tail: tail || ''
                };
            }

        },

        del: function(prop) {
            if (this.decls[prop]) {
                delete this.decls[prop];
            }
        }

    }),

    Task: exports.Task = INHERIT({

        __constructor: function(tech, commandName, params) {
            this.id = (Math.random() + '').substring(2, 10);
            this.type = params && params.type || 'process';
            this.tech = tech;
            this.command = commandName;
            this.params = params;
        },

        process: function() {
            var command = this.command,
                params,
                handler,
                result;

            try {
                if (typeof command === 'string') {
                    var handlerName = this.type + '_' + command;
                    handler = this[handlerName];
                }

                if (!handler) {
                    throw new Error(handlerName + ' handler is not defined.');
                }

                params = arguments;

                if (!params[0]) {
                    params = this.params.parsed;
                    if (params && params !== '') {
                        params = params.split(',');

                        params = params.map(function(param) {
                            return param.trim();
                        });
                    }
                }

                result = handler.apply(this, params || []);

                if (!result) {
                    throw new Error(handlerName + ' handler result is bad. Task: ' + this);
                }

            } catch (err) {
                console.log('Task processing failed: ', err + '\n' +'Task: ' + this);
            }

            return result;
        }

    })

});
