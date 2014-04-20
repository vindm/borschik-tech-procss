var INHERIT = require('inherit'),
    VOW = require('vow'),
    Rule = require('./rule'),
    Task = require('./task'),
    cssbase = require('../../borschik').getTech('css');

exports.Tech = INHERIT(cssbase.Tech, {

    process : function(path, out) {
        var _this = this;

        return this
            .postProcess(this.createFile(path, 'include').process(path))
            .then(function(result) {
                return _this.write(out, _this.opts.minimize ? _this.minimize(result) : result);
            });
    },

    postProcess : function(processResult) {
        var _this = this,
            postProcessTasks = this.postProcessTasks,
            postProcessResult = VOW.promise(processResult);

        if (postProcessTasks) {
            postProcessResult = Object
                .keys(postProcessTasks)
                .reduce(function(postProcessResult, taskName) {
                    var task = postProcessTasks[taskName];

                    if ( ! task instanceof _this.Task) {
                        console.log('Bad postProcessTask: ',
                            'Task ' + taskName + ' is not defined');
                    }

                    postProcessResult = postProcessResult
                        .then(task.process.bind(task));

                    return postProcessResult;

                }, postProcessResult)
        }

        return postProcessResult;
    },

    File : exports.File = INHERIT(cssbase.File, {

        parseInclude : function(content) {
            var ruleWithCmdRx = new RegExp('^' + this.tech.Rule.getRuleWithCommandRe(true), 'mg'),
                chunks = [],
                found;

            if (Buffer.isBuffer(content)) {
                content = content.toString('utf8');
            }

            while (found = ruleWithCmdRx.exec(content)) {
                if (found && found[0]) {
                    var result = this.processRule(found[0]);

                    if (result) {
                        chunks.push({
                            range : [ found.index, ruleWithCmdRx.lastIndex ],
                            result : result
                        });
                    }
                }
            }

            return this.__base(this.makeParsed(chunks, content));
        },

        processRule : function(rule) {
            var task = null,
                cmd;

            if (typeof rule === 'string') {
                rule = new this.tech.Rule(rule);
            }

            if ( ! (rule && rule instanceof this.tech.Rule)) {
                return task;
            }


            while (cmd = rule.getCommand()) {
                task = new this.tech.Task(this,
                    { plugin : cmd.name },
                    {
                        file : this,
                        rule : rule,
                        commandDecl : cmd.decl
                    });

                task && task.process(cmd.params);
            }

            return rule.toString();

        },

        makeParsed : function(items, content) {
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

    Rule : exports.Rule = INHERIT(Rule, {

        getCommand : function() {
            var decls = this.declarations,
                command;

            decls.some(function(decl) {
                if (decl.value.indexOf('/*') !== -1) {
                    command = this.__self.parseCommand(decl.value);

                    if (command) {
                        decl.value = decl.value.replace(command.full, '').trim();
                        command.decl = decl;

                        return true;
                    }

                    return false;
                }
            }, this);

            return command;
        }

    }, {

        getKeyWordRe : function() {
            return 'borschik';
        },

        getRuleWithCommandRe : function(isCaptured, selector, declaration) {
            return this.getRuleRe(
                isCaptured,
                selector,
                (declaration || this.getDeclarationRe()) + '\\s*' +
                    this.getCommentRe(this.getKeyWordRe() + '\\.[^;]+?') + ';'
            );
        },

        parseCommand : function(str) {
            var commandRx = new RegExp(this.getCommentRe(
                        this.getKeyWordRe() + '\\.' +
                        '(' + this.getCommandNameRe() + ')' +
                        '\\(\\s*(.*)\\s*\\)'
                )),
                parsed = commandRx.exec(str),
                command;

            if (parsed && parsed[1]) {
                command = {
                    full : parsed[0],
                    name : parsed[1].trim(),
                    params : parsed[2] ? this.parseCommandParams(parsed[2]) : []
                };
            }

            return command;
        },

        parseCommandParams : function(str) {
            var paramsRx = new RegExp(this.getCommandParamsRe(), 'g'),
                params = [],
                parsed;

            while ((parsed = paramsRx.exec(str))[0]) {
                if (parsed[1]) {
                    parsed[1] = parsed[1].trim();
                    parsed[1] === '' || params.push(parsed[1]);
                }
            }

            return params;
        },

        getCommentRe : function(content) {
            return '\\/\\*[\\s\\S]+?\\s*' + (content || '') + '\\s*(?:[^*]|(?:\\*(?=[^\\/])))*\\*\\/';
        },

        getCommandNameRe : function() {
            return '[^\\s(]+?';
        },

        getCommandParamsRe : function() {
            return '(?:\\s*([^,]*?)\\s*(?:(?:,\\s*)|$))?';
        }

    }),

    Task : exports.Task = Task

});
