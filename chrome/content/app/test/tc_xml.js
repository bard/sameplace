Cc['@mozilla.org/moz/jssubscript-loader;1']
.getService(Ci.mozIJSSubScriptLoader)
    .loadSubScript('chrome://xmpp4moz/content/lib/module_manager.js');

var module     = new ModuleManager(['chrome://mozlab/content']);
var mozunit    = module.require('package', 'mozunit/package');
var assert     = mozunit.assertions;
var spec       = new mozunit.Specification('XML utilities');

spec.stateThat = {
    'Function can be applied to text nodes of an XML object and the resulting XML is returned': function() {
        var src = <body xmlns="urn:bar" attr="value">one <span xmlns="urn:foo">two</span> three</body>;
        
        var dst = xml.mapTextNodes(
            src, function(text) { return text.toUpperCase(); });

        assert.equals(
            <body xmlns="urn:bar" attr="value">ONE <span xmlns="urn:foo">TWO</span> THREE</body>,
            dst);
    },

    'Function applied to text nodes can return an array': function() {
        var src = <body xmlns="urn:bar" attr="value">one <span xmlns="urn:foo">two</span> three</body>;
        
        var dst = xml.mapTextNodes(
            src, function(text) { return [text, <a>{text}</a>]; });

        var expected = <body xmlns="urn:bar" attr="value">one <a>one </a><span xmlns="urn:foo">two<a>two</a></span> three<a> three</a></body>;

        repl.print(dst.toXMLString())
        repl.print(expected.toXMLString())
    }
};

spec.verify();
