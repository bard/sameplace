function $() {
    return arguments.callee.impl.$.apply(null, arguments);
}
$.impl = {};

Components
.classes['@mozilla.org/moz/jssubscript-loader;1']
.getService(Components.interfaces.mozIJSSubScriptLoader)
    .loadSubScript('chrome://sameplace/content/lib/css_query.js', $.impl);
