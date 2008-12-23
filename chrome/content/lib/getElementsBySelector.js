// Note: most of this code is by Joe Hewitt: http://www.joehewitt.com/blog/ive_noticed_tha.php

function $(first, second) {
    var context, css;
    if(second) {
        context = first;
        css = second;
    } else {
        context = document;
        css = first;
    }

    var xpath = cssToXPath(css);
    return document.evaluate(xpath, context, null,
                             XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        .singleNodeValue;
}

function $$(first, second) {
    var context, css;
    if(second) {
        context = first;
        query = second;
    } else {
        context = document;
        query = first;
    }

    if(query.match(/^\s*$/))
        return {
            forEach: function() {}, 
            map: function() {},
            length: 0,
            toArray: function() { return []; }
        }

    var xpath = query.match(/^(\/|\.\/)/) ?
        query : cssToXPath(query);

    var result = document.evaluate(xpath, context, null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    return {
        forEach: function(action) {
            for(var i=0; i < result.snapshotLength; i++)
                action(result.snapshotItem(i));
        },
        map: function(action) {
            var results = [];
            for(var i=0; i < result.snapshotLength; i++)
                results.push(action(result.snapshotItem(i)));
            return results;
        },
        toArray: function() {
            return this.map(function(item) { return item; })
        }
    }
}

var cssToXPath = let(memo = {})
    function(rule) {
        if(memo[rule])
            return memo[rule];
        
        var regElement = /^([#\.]?)([a-z0-9\\*_-]+)((\|)([a-z0-9\\*_-]*))?/i;
        var regAttr1 = /^\[([^\]]*)\]/i;
        var regAttr2 = /^\[\s*([^~=\s]+)\s*(~?=)\s*"([^\"]+)"\s*\]/i;
        var regPseudo = /^:([a-z_-])+/i;
        var regCombinator = /^(\s*[>^+\s-])?/i;
        var regComma = /^\s*,/i;
        
        var index = 1;
        var parts = rule.match(/^(\s*[>^+\s-])/i) ? ["./"] : [".//", "*"];
        
        var lastRule = null;
        
        while (rule.length && rule != lastRule)
        {
            lastRule = rule;
            
            // Trim leading whitespace
            rule = rule.replace(/^\s*|\s*$/g,"");
            if (!rule.length)
            break;
            
            // Match the element identifier
            var m = regElement.exec(rule);
            if (m)
            {
                if (!m[1])
                {
                    // XXXjoe Namespace ignored for now
                    if (m[5])
                    parts[index] = m[5];
                    else
                    parts[index] = '*[local-name() = "' + m[2] + '"]';
                }
                else if (m[1] == '#')
                parts.push("[@id='" + m[2] + "']"); 
                else if (m[1] == '.')
                    parts.push("[contains(concat(' ', @class, ' '), ' " + m[2] + " ')]");
                //parts.push("[contains(@class, '" + m[2] + "')]");               
                rule = rule.substr(m[0].length);
            }
            
            // Match attribute selectors
            m = regAttr2.exec(rule);
            if (m)
            {
                if (m[2] == "~=")
                parts.push("[contains(@" + m[1] + ", '" + m[3] + "')]");
                else
                parts.push("[@" + m[1] + "='" + m[3] + "']");
                
                rule = rule.substr(m[0].length);
            }
            else
            {
                m = regAttr1.exec(rule);
                if (m)
                {
                    parts.push("[@" + m[1] + "]");
                    rule = rule.substr(m[0].length);
                }
            }
            
            // Skip over pseudo-classes and pseudo-elements, which are of no use to us
            m = regPseudo.exec(rule);
            while (m)
            {
                rule = rule.substr(m[0].length);
                m = regPseudo.exec(rule);
            }
            
            // Match combinators
            m = regCombinator.exec(rule);
            if (m && m[0].length)
            {
                if (m[0].indexOf(">") != -1)
                parts.push("/");
                else if (m[0].indexOf("+") != -1)
                // XXXbard should probably be following-sibling[...][1]
                parts.push("/following-sibling::");
                else if (m[0].indexOf("^") != -1)
                parts.push("/ancestor::");
                else if (m[0].indexOf("-") != -1)
                parts.push("/preceding-sibling::");
                else
                parts.push("//");

                index = parts.length;
                parts.push("*");
                
                rule = rule.substr(m[0].length);
            }
            
            m = regComma.exec(rule);
            if (m)
            {
                // XXXbard maybe needs .//
                parts.push(" | ", "//", "*");
                index = parts.length-1;
                rule = rule.substr(m[0].length);
                
            }

        }

        var xpath = parts.join("");
        memo[rule] = xpath;
        return xpath;
    }

cssToXPath.test = function() {
    if(!('assert' in this))
        Components.classes['@mozilla.org/moz/jssubscript-loader;1']
            .getService(Components.interfaces.mozIJSSubScriptLoader)
            .loadSubScript('chrome://xmpp4moz/content/lib/test.js');

    var tests = {
        'isolated attribute selector': function() {
            assert.equals(
                ".//*[@foo=bar]",
                cssToXPath('[foo=bar]'));
        },

        'tag selector': function() {
            assert.equals(
                './/*[local-name() = "foo"]',
                cssToXPath('foo'));
        },

        'single attribute selector': function() {
            assert.equals(
                ".//*[@id='contacts']//*[contains(concat(' ', @class, ' '), ' contact ')]" +
                    "[@account='bard@sameplace.cc']",
                cssToXPath('#contacts .contact[account="bard@sameplace.cc"]'));
        },

        'multiple attribute selectors': function() {
            assert.equals(
                ".//*[@id='contacts']//*[contains(concat(' ', @class, ' '), ' contact ')]" +
                    "[@account='bard@sameplace.cc'][@address='alyssa@sameplace.cc']",
                cssToXPath('#contacts .contact[account="bard@sameplace.cc"][address="alyssa@sameplace.cc"]'));
        },

        'class attribute': function() {
            assert.equals(
                ".//*[contains(concat(' ', @class, ' '), ' name ')]",
                cssToXPath('.name'));
        }
        
    }
    
    return runTests(tests);
};
