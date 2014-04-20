var INHERIT = require('inherit');

var Rule = module.exports = INHERIT({

    __constructor : function(rawString) {
        var parsedRule;

        if (rawString && typeof rawString === 'string') {
            parsedRule = Rule.parse(rawString);

            if ( ! parsedRule) {
                throw(new Error('Rule parsing failed'));
            }

            this.selector = parsedRule.selector;

            this._declarationsCount = 0;
            this.declarations = [];

            if (Array.isArray(parsedRule.declarations)) {
                parsedRule.declarations.forEach(this.add.bind(this), this);
            }
        }
    },

    _declarationsCount : 0,

    _isInRangePosition : function(position) {
        return typeof position === 'number' &&
            position >= 0 &&
            position < this._declarationsCount;
    },

    get : function(property) {
        var decls = [];

        if (typeof property === 'number' && this._isInRangePosition(property)) {
            decls = [ this.declarations[property] ];
        } else if (typeof property === 'string') {
            decls = this.declarations.filter(function(decl) {
                return decl.property === property;
            });
        }

        return decls;
    },

    getPosition : function(decl) {
        return typeof decl === 'object' && decl ?
            this.declarations.indexOf(decl) :
            -1;
    },

    add : function(decl, position) {
        if ( ! decl) {
            return false;
        }
        if (this.getPosition(decl) !== -1) {
            return true;
        }

        typeof position === 'undefined' && (position = this._declarationsCount);

        if (position <= 0) {
            this.declarations.unshift(decl);
        } else if (position >= this._declarationsCount) {
            this.declarations.push(decl);
        } else {
            this.declarations.splice(position, 0, decl);
        }

        this._declarationsCount += 1;

        return true;
    },

    remove : function(position) {
        if (typeof position === 'object' && position) {
            position = this.getPosition(position);
        }

        if ( ! this._isInRangePosition(position)) {
            return false;
        }

        position.splice(position, 1);

        this._declarationsCount -= 1;

        return true;
    },

    replace : function(position, newDecl) {
        var decls = this.declarations;

        if (typeof position === 'object' && position) {
            position = this.getPosition(position);
        }

        if ( ! this._isInRangePosition(position)) {
            return false;
        }

        if (typeof newDecl === 'number') {
            newDecl = decls[newDecl];
            if (typeof newDecl === 'object' && newDecl) {
                this.remove(newDecl);
            }
        }

        if (typeof newDecl === 'object' && newDecl) {
            return false;
        }

        decls.splice(position, 1, newDecl);

        return true;
    },

    prepend : function(decl) {
        this.add(decl, 0);
    },

    append : function(decl) {
        this.add(decl);
    },

    before : function(decl, target) {
        var position = this.getPosition(target);

        if (position === -1) {
            return false;
        }

        return this.add(decl, position - 1);
    },

    after : function(decl, target) {
        var position = this.getPosition(target);

        if (position === -1) {
            return false;
        }

        return this.add(decl, position + 1);
    },

    toString : function() {
        return [
            this._selectorToString(),
            '\n{\n',
                this._declarationsToString(),
            '\n}'
        ].join('');
    },

    _selectorToString : function() {
        return this.selector;
    },

    _declarationsToString : function() {
        return this.declarations
            .map(function(decl) {
                return [ '\t', decl.property, ': ', decl.value, ';' ].join('');
            })
            .join('\n');
    }

}, {

    parse : function(content) {
        var found = new RegExp(this.getRuleRe(true), 'mg').exec(content),
            rule = null;

        if (found && found[1] && found[2]) {
            rule = {
                full : found[0],
                selector : found[1].trim(),
                declarations : this.parseDeclarations(found[2])
            };
        }

        return rule;
    },

    parseDeclarations : function(content) {
        var decls = [];

        if (content && typeof content === 'string') {
            content
                .split(';')
                .forEach(function(decl) {
                    var declParts;

                    decl = decl.trim();

                    if (decl !== '') {
                        declParts = decl.split(':');
                        decls.push({
                            full : decl,
                            property : declParts[0].trim(),
                            value : declParts[1].trim()
                        });
                    }
                });
        }

        return decls;
    },

    getRuleRe : function(isCaptured, selector, declaration) {
        selector || (selector = this.getSelectorRe());
        declaration || (declaration = this.getDeclarationRe() + ';');

        if (isCaptured) {
            selector = '(' + selector + ')';
            declaration = '(' + declaration + ')';
        }

        return selector + '\\s*' +
            '{\\s*' +
                '(?:' + declaration + ')*' +
            '\\s*}';
    },

    getSelectorRe : function() {
        return '(?:[^{}\\*\\/]|(?:\\*(?!\\/)))+?';
    },

    getDeclarationRe : function() {
        return this.getDeclarationPropertyRe() +
            '\\s*:\\s*' +
            this.getDeclarationValueRe()
    },

    getDeclarationPropertyRe : function() {
        return '(?:[^{}]+;)?[^{}:]+';
    },

    getDeclarationValueRe : function() {
        return '[^{};]+?';
    }

});
