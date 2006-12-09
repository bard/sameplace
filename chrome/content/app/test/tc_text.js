Cc['@mozilla.org/moz/jssubscript-loader;1']
.getService(Ci.mozIJSSubScriptLoader)
    .loadSubScript('chrome://xmpp4moz/content/lib/module_manager.js');

var module     = new ModuleManager(['chrome://mozlab/content']);
var mozunit    = module.require('package', 'mozunit/package');
var assert     = mozunit.assertions;
var spec       = new mozunit.Specification('Text utilities');


spec.stateThat = {
    'Function can be applied to matches of a string and processed parts are returned as array': function() {
        var src = 'hello :smile: world :wink:!';

        var dst = text.mapMatch(
            src, /:(smile|wink):/g, function(match) {
                switch(match[1]) {
                case 'smile': return ':-)'; break;
                case 'wink':  return ';-)'; break;
                }
            });
        
        assert.equals('object', typeof(dst));
        assert.equals('hello ',  dst[0]);
        assert.equals(':-)',     dst[1]);
        assert.equals(' world ', dst[2]);
        assert.equals(';-)',     dst[3]);
        assert.equals('!',       dst[4]);
        assert.equals(5, dst.length);
    }
};

spec.verify();
