window.addEventListener(
    'load', function(event) { sameplace.initOverlay(); }, false);

var sameplace = {};

Components
.classes['@mozilla.org/moz/jssubscript-loader;1']
.getService(Components.interfaces.mozIJSSubScriptLoader)
    .loadSubScript('chrome://sameplace/content/overlay_impl.js', sameplace);
