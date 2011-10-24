/*
 * Copyright 2009 by Massimiliano Mirra
 * 
 * This file is part of SamePlace.
 * 
 * SamePlace is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 3 of the License, or (at your
 * option) any later version.
 * 
 * SamePlace is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * The interactive user interfaces in modified source and object code
 * versions of this program must display Appropriate Legal Notices, as
 * required under Section 5 of the GNU General Public License version 3.
 *
 * In accordance with Section 7(b) of the GNU General Public License
 * version 3, modified versions must display the "Powered by SamePlace"
 * logo to users in a legible manner and the GPLv3 text must be made
 * available to them.
 * 
 * Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
 *  
 */


/// EXPORTS
// ----------------------------------------------------------------------

var EXPORTED_SYMBOLS = [
    'cssToXPath'
];


/// UTILITIES
// ----------------------------------------------------------------------
/*
function memoize(fn, context) {
    if(typeof(fn) == 'string')
        fn = context[fn];
    
    var m = {__proto__: null};
    fn.__parent__[fn.name] = function(arg) {
        if(arg in m)
            return m[arg];

        m[arg] = fn(arg);
        return m[arg];
    }
} */


function memoize(f) {
  return function (x) {
      f.memo = f.memo || {};
      return (x in f.memo)? f.memo[x] : f.memo[x] = f(x);
  };
}
/// API
// ----------------------------------------------------------------------

function cssToXPath(cssSelector) {
    return selectorObjectToXPath(selectorToSelectorObject(cssSelector));
}
cssToXPath = memoize(cssToXPath);


/// INTERNALS
// ----------------------------------------------------------------------

function selectorToSelectorObject(selector) {
    var re = {
        ID     : /^#([\w\-]+)/,
        CLASS  : /^\.([\w\-]+)/,
        ATTR   : /^\[([^\]]+)\]/,
        TAG    : /^\w+/,
        PSEUDO : /^:([\w-]+)/,
        COMBI  : /\s*\+\s*|\s*\-\s*|\s*>\s*|\s*~\s*|\s*\^\s*|\s*<\s*|\s+/
    };

    if(!selector[0].match(re.COMBI))
        // If no combinator is at the beginning of the selector, make
        // the descendant combinator explicit by prepending a space.
        selector = ' ' + selector;

    var scanner = new Scanner(selector);
    var result = {};
    var cur = result;

    var match;
    while(!scanner.eof()) {
        switch(scanner.peek()) {
        case ' ':
        case '+':
        case '>':
        case '<':
        case '^':
            match = scanner.get(re.COMBI);
            switch(match[0].replace(/(^\s+|\s+$)/g, '')) {
            case '':
                cur.desc = {};
                cur = cur.desc;
                break;
            case '>':
                cur.child = {};
                cur = cur.child;
                break;
            case '+':
                cur.followingSibling = {};
                cur = cur.followingSibling;
                break;
            case '-':
                cur.precedingSibling = {};
                cur = cur.precedingSibling;
                break;
            case '^':
                cur.ancestor = {};
                cur = cur.ancestor;
                break;
            case '<':
                cur.parent = {};
                cur = cur.parent;
                break;
            }

            break;
        case '#':
            match = scanner.get(re.ID);
            cur.hasId = match[1];
            break;
        case '.':
            match = scanner.get(re.CLASS);
            if(!('hasClasses' in cur))
                cur.hasClasses = [];
            cur.hasClasses.push(match[1]);
            break;
        case ':':
            var [, name] = scanner.get(re.PSEUDO);

            if(!('pseudo' in cur))
                cur.pseudo = [];

            switch(name) {
            case 'first-child':
                cur.pseudo.push({ firstChild: true });
                break;
            default:
                throw new Error('Unrecognized pseudo attribute. (' + name + ')');
            }

            break;
        case '[':
            match = scanner.get(re.ATTR);
            var attrData = match[1];
            var name, matcher, pattern;
            if(attrData.indexOf('=') != -1)
                [, name, matcher, pattern] = attrData.match(/^(.+?)(=|\*=|\$=|\^=|~=)["']?(.+?)["']?$/);
            else
                [name, matcher] = [attrData, false];

            if(!('attrs' in cur))
                cur.attrs = [];

            switch(matcher) {
            case '=':
                cur.attrs.push({ name: name, is: pattern });
                break;
            case '*=':
                cur.attrs.push({ name: name, contains: pattern });
                break;
            case '$=':
                cur.attrs.push({ name: name, endsWith: pattern });
                break;
            case '^=':
                cur.attrs.push({ name: name, beginsWith: pattern });
                break;
            case '~=':
                cur.attrs.push({ name: name, includes: pattern });
                break;
            case false:
                cur.attrs.push({ name: name, present: true});
                break;
            }

            break;
        default:
            match = scanner.get(re.TAG);
            cur.is = match[0];
        }
    }

    return result;
}

function selectorObjectToXPath(sel, isContinuation) {
    var path = '';

    if(isContinuation) {
        if(!('is' in sel))
            path += '*';
    }
    else
        path += '.';

    for(var test in sel) {
        switch(test) {
        case 'is':
            path += '*[local-name() = \'' + sel.is + '\']';
            break;

        case 'hasId':
            path += '[@id=\'' + sel.hasId + '\']';
            break;

        case 'attrs':
            for each(var attrSel in sel.attrs) {
                for(var part in attrSel) {
                    switch(part) {
                    case 'name':
                        path += '[@' + attrSel.name;
                        break;
                    case 'is':
                        path += '=\'' + attrSel.is + '\']';
                        break;
                    case 'present':
                        path += ']';
                        break;
                    default:
                        throw new Error('Attribute test not supported yet. (' + part + ')');
                    }
                }
            }
            break;

        case 'hasClasses':
            for each(var cl in sel.hasClasses) {
                path += "[contains(concat(' ', @class, ' '), ' " + cl + " ')]";
            }
            break;

        case 'child':
            path += '/' + selectorObjectToXPath(sel.child, true);
            break;

        case 'desc':
            path += '//' + selectorObjectToXPath(sel.desc, true);
            break;

        case 'followingSibling':
            path += '/following-sibling::' + selectorObjectToXPath(sel.followingSibling, true);
            break;

        case 'precedingSibling':
            path += '/preceding-sibling::' + selectorObjectToXPath(sel.precedingSibling, true);
            break;

        case 'ancestor':
            path += '/ancestor::' + selectorObjectToXPath(sel.ancestor, true);;
            break;

        case 'parent':
            path += '/parent::' + selectorObjectToXPath(sel.parent, true);
            break;
        }
    }

    return path;
}


/// GENERIC STATEFUL STRING SCANNER
// ----------------------------------------------------------------------

function Scanner(s) {
    this._s = s;
    this._pos = 0;
}

Scanner.prototype = {
    peek: function() {
        return this._s[this._pos];
    },

    get: function(srcRE) {
        var re = srcRE.global ?
            new RegExp(srcRE.source) :
            new RegExp(srcRE.source, 'g');

        var match = re.exec(this._s.substr(this._pos));
        if(!match)
            throw new Error('Not matched.');
        this._pos += re.lastIndex;

        return match;
    },

    eof: function() {
        return this._pos == this._s.length;
    }
};


/// TESTS
// ----------------------------------------------------------------------

function test() {
    var mozunit = {};
    Cu.import('resource://mozunit/assertions.jsm', mozunit);

    var tests = {
        'tag': function() {
            mozunit.assert.equals('.//*[local-name() = \'foo\']',
                                  cssToXPath('foo'));
        },

        'attribute': function() {
            mozunit.assert.equals(".//*[@foo='bar']",
                                  cssToXPath('[foo="bar"]'));
        },

        'id': function() {
            mozunit.assert.equals(".//*[@id='foo']",
                                  cssToXPath('#foo'));
        },

        'class': function() {
            mozunit.assert.equals(".//*[contains(concat(' ', @class, ' '), ' foo ')]",
                                  cssToXPath('.foo'));
        },

        'multiple attributes': function() {
            mozunit.assert.equals(".//*[@account='foo@sameplace.cc'][@address='alyssa@sameplace.cc']",
                                  cssToXPath('[account="foo@sameplace.cc"][address="alyssa@sameplace.cc"]'));
        },

        'descendant': function() {
            mozunit.assert.equals(".//*[local-name() = 'foo']//*[local-name() = 'bar']",
                                  cssToXPath('foo bar'));
        },

        'child': function() {
            mozunit.assert.equals(".//*[local-name() = 'foo']/*[local-name() = 'bar']",
                                  cssToXPath('foo > bar'));
        },

        'following sibling': function() {
            mozunit.assert.equals(".//*[local-name() = 'foo']/following-sibling::*[local-name() = 'bar']",
                                  cssToXPath('foo + bar'));
        },

        'preceding sibling': function() {
            mozunit.assert.equals(".//*[local-name() = 'foo']/preceding-sibling::*[local-name() = 'bar']",
                                  cssToXPath('foo - bar'));
            
        },

        'ancestor': function() {
            mozunit.assert.equals(".//*[local-name() = 'foo']/ancestor::*[local-name() = 'bar']",
                                  cssToXPath('foo ^ bar'));
        },

        'parent': function() {
            mozunit.assert.equals(".//*[local-name() = 'foo']/parent::*[local-name() = 'bar']",
                                  cssToXPath('foo < bar'));
        }
    }

    function runTests(tests) {
        for(var n in tests) {
            try {
                tests[n].call();
            } catch(e) {
                repl.print(e + '\n' + e.stack)
            }
        }
    }

    runTests(tests);

    var translations = {
        "> .address":"./*[contains(concat(' ', @class, ' '), ' address ')]",
        "widget":".//*[local-name() = 'widget']",
        "#widgets-toolbar":".//*[@id='widgets-toolbar']",
        "#widgets-toolbar >toolbarspring":".//*[@id='widgets-toolbar']/*[local-name() = 'toolbarspring']",
        "#widgets":".//*[@id='widgets']",
        "#more-widgets":".//*[@id='more-widgets']",
        "#widget-accounts-all-accounts":".//*[@id='widget-accounts-all-accounts']",
        "#accounts .account":".//*[@id='accounts']//*[contains(concat(' ', @class, ' '), ' account ')]",
        "#blueprints > .account":".//*[@id='blueprints']/*[contains(concat(' ', @class, ' '), ' account ')]",
        "#accounts":".//*[@id='accounts']",
        "#widget-contacts-display-mode":".//*[@id='widget-contacts-display-mode']",
        "#widget-contacts .list":".//*[@id='widget-contacts']//*[contains(concat(' ', @class, ' '), ' list ')]",
        "#widget-contacts .list .concrete-contact[account='test@localhost'][address='test@localhost']":".//*[@id='widget-contacts']//*[contains(concat(' ', @class, ' '), ' list ')]//*[contains(concat(' ', @class, ' '), ' concrete-contact ')][@account='test@localhost'][@address='test@localhost']",
        "#widget-contacts .list .concrete-contact[account='test@localhost'][address='fido@localhost']":".//*[@id='widget-contacts']//*[contains(concat(' ', @class, ' '), ' list ')]//*[contains(concat(' ', @class, ' '), ' concrete-contact ')][@account='test@localhost'][@address='fido@localhost']",
        "#widget-contacts .list .contact[name='test.abc@localhost']":".//*[@id='widget-contacts']//*[contains(concat(' ', @class, ' '), ' list ')]//*[contains(concat(' ', @class, ' '), ' contact ')][@name='test.abc@localhost']",
        "#blueprints > .contact":".//*[@id='blueprints']/*[contains(concat(' ', @class, ' '), ' contact ')]",
        ".name":".//*[contains(concat(' ', @class, ' '), ' name ')]",
        ".concrete-contacts":".//*[contains(concat(' ', @class, ' '), ' concrete-contacts ')]",
        "#widget-contacts .list .concrete-contact[account='test@localhost'][address='test.abc@localhost']":".//*[@id='widget-contacts']//*[contains(concat(' ', @class, ' '), ' list ')]//*[contains(concat(' ', @class, ' '), ' concrete-contact ')][@account='test@localhost'][@address='test.abc@localhost']",
        "^ .contact":"./ancestor::*[contains(concat(' ', @class, ' '), ' contact ')]",
        ".status-message":".//*[contains(concat(' ', @class, ' '), ' status-message ')]",
        "#widget-contacts .list .concrete-contact[account='test.abc@localhost'][address='test.abc@localhost']":".//*[@id='widget-contacts']//*[contains(concat(' ', @class, ' '), ' list ')]//*[contains(concat(' ', @class, ' '), ' concrete-contact ')][@account='test.abc@localhost'][@address='test.abc@localhost']",
        "#widget-experimental-open-mode":".//*[@id='widget-experimental-open-mode']",
        "^ [account]":"./ancestor::*[@account]",
       "#accounts .account[account='test@localhost']":".//*[@id='accounts']//*[contains(concat(' ', @class, ' '), ' account ')][@account='test@localhost']",
        "> .state-indicator":"./*[contains(concat(' ', @class, ' '), ' state-indicator ')]",
        "#accounts .account[account='test.abc@localhost']":".//*[@id='accounts']//*[contains(concat(' ', @class, ' '), ' account ')][@account='test.abc@localhost']",
        "#widget-contacts":".//*[@id='widget-contacts']",
        "#accounts .account[account='alyssa@sameplace.cc']":".//*[@id='accounts']//*[contains(concat(' ', @class, ' '), ' account ')][@account='alyssa@sameplace.cc']",
        "^ .contact .avatar":"./ancestor::*[contains(concat(' ', @class, ' '), ' contact ')]//*[contains(concat(' ', @class, ' '), ' avatar ')]",
        "#contact-popup":".//*[@id='contact-popup']",
        ".nick-container":".//*[contains(concat(' ', @class, ' '), ' nick-container ')]",
        ".concrete-contact":".//*[contains(concat(' ', @class, ' '), ' concrete-contact ')]",
        ".no-photo":".//*[contains(concat(' ', @class, ' '), ' no-photo ')]",
        ".nick":".//*[contains(concat(' ', @class, ' '), ' nick ')]",
        ".avatar":".//*[contains(concat(' ', @class, ' '), ' avatar ')]"
    };

    for(var n in translations) {
        var expected = translations[n];
        try {
            var received = cssToXPath(n);
            if(expected !== received)
                repl.print(n + '\n\texpected : ' + expected + '\n\treceived : ' + received);
        } catch(e) {
            repl.print(n + ': ' + e + '\n' + e.stack);
        } 
    }
}

