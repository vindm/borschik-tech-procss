var PATH = require('path'),
    FS = require('fs'),

    stringRe = "(?:(?:'[^'\\r\\n]*')|(?:\"[^\"\\r\\n]*\"))",
    urlRe = "(?:(?:url\\(\\s*" + stringRe + "\\s*\\))|(?:url\\(\\s*[^\\s\\r\\n'\"]*\\s*\\)))",

    ORIGIN_TO_URL_PROPERTIES_MAP = {
        background : 'background-image'
    },
    EXTENSION_TO_CONTENTTYPE_MAP = {
    '.gif': 'image/gif',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ttf': 'application/x-font-ttf',
    '.woff': 'application/x-font-woff'
};

var ProcssBase64Plugin = {};

ProcssBase64Plugin.basePath = '/';

ProcssBase64Plugin._isDeclarationProcessable = function(decl) {
    return decl.value.indexOf('url(') !== -1;
};

ProcssBase64Plugin._processDeclaration = function(decl) {
    var plugin = ProcssBase64Plugin,
        urlRx = new RegExp(urlRe, 'g'),
        value = decl.value,
        hasChanges = false,
        processedUrls = [],
        based = null,
        processedUrl,
        url;

    while (url = urlRx.exec(value)) {
        if (url[0]) {
            processedUrl = plugin._processUrl(url[0]);

            hasChanges || (hasChanges = processedUrl !== url[0]);
            processedUrls.push(processedUrl);
        }
    }

    if (hasChanges && processedUrls.length > 0) {
        based = plugin._makeBasedRuleDeclaration(decl.property, processedUrls.join(', '));
    }

    return based;
};

ProcssBase64Plugin._makeBasedRuleDeclaration = function(prop, value) {
    return {
        property : ORIGIN_TO_URL_PROPERTIES_MAP[prop] || prop,
        value : value
    };
};

ProcssBase64Plugin._parseUrl = function(url) {
    if (url) {
        if (url.lastIndexOf('url(', 0) === 0) {
            url = url.replace(/^url\(\s*/, '').replace(/\s*\)$/, '');
        }

        if (url.charAt(0) === '\'' || url.charAt(0) === '"') {
            url = url.substr(1, url.length - 2);
        }
    }

    return url;
};

ProcssBase64Plugin._isUrlProcessable = function(url) {
    var isUrlAllowed = ! (['#', '?', '/'].indexOf(url.charAt(0)) !== -1 || /^\w+:/.test(url)),
        isExtensionAllowed;

    if (isUrlAllowed) {
        isExtensionAllowed = EXTENSION_TO_CONTENTTYPE_MAP.hasOwnProperty(PATH.extname(url));
    }

    return isUrlAllowed && isExtensionAllowed;
};

ProcssBase64Plugin._processUrl = function(url) {
    var plugin = ProcssBase64Plugin,
        parsed,
        resolved,
        processed;

    parsed = plugin._parseUrl(url);

    if (plugin._isUrlProcessable(parsed)) {
        resolved = PATH.resolve(PATH.dirname(plugin.basePath), parsed);

        if (FS.existsSync(resolved)) {
            processed = plugin._makeBase64DataUrl(resolved);
        }
    }

    return processed || url;
};

ProcssBase64Plugin._makeBase64DataUrl = function(url) {
    var based = FS.readFileSync(url, 'base64'),
        contentType = EXTENSION_TO_CONTENTTYPE_MAP[PATH.extname(url)];

    return based && [
        'url(data:', contentType, ';base64,', based, ')'
    ].join('');
};

module.exports = ProcssBase64Plugin
    .api = {
        /**
         * @this {Object} Task scope
         */
        process : function() {
            var task = this,
                originDeclaration = task.commandDecl,
                basedDeclaration;

            // set root path for urls resolving
            ProcssBase64Plugin.basePath = task.file.path;

            // base all urls in declaration
            basedDeclaration = ProcssBase64Plugin._processDeclaration(originDeclaration);

            if (basedDeclaration) {

                // add based declaration after original
                task.rule.after(basedDeclaration, originDeclaration);
            }

            return task.rule.toString();
        }
    };
