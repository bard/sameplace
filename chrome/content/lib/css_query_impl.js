/*
  Copyright (C) 2007 by Massimiliano Mirra

  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 2 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software
  Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301 USA

  Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
*/


function Scanner(string) {
    this._string = string;
    this._cursor = 0;
}

Scanner.prototype = {
    end: function() {
        return this._cursor >= this._string.length - 1;
    },

    peek: function() {
        return this._string[this._cursor];
    },

    rest: function() {
        return this._string.substr(this._cursor);
    },

    get: function(rx) {
        function globalizeRegexp(rx) {
            return new RegExp(rx.source, ('g' +
                                          (rx.ignoreCase ? 'i' : '') +
                                          (rx.multiline ? 'm' : '')));
        }

        var rx = globalizeRegexp(rx);
        var match = rx.exec(this.rest());
        if(match) {
            this._cursor += rx.lastIndex;
            return match[0];
        } else
            throw new Error('boom!');
    },

    skip: function(rx) {
        this.get(rx);
    },

    rewind: function() {
        this._cursor = 0;
    }
};

function parse(queryString) {
    const RX_AXIS      = /^(\s*[ >^<]\s*|)/;
    const RX_ID_SEL    = /^#[^ \.\[]+/;
    const RX_CLASS_SEL = /^\.[^ \.\[]+/;
    const RX_ATTR_SEL  = /^[^\]]+\]/;
    const RX_TAG_SEL   = /^[a-zA-Z][^ \.\[\#]+/;

    var scanner = new Scanner(queryString);
    var selector, query = [];

    while(!scanner.end()) {
        selector = { axis: undefined, tests: [] };
        selector.axis = scanner.get(RX_AXIS).replace(/ /g, '');
    
        do {
            var part;
            switch(scanner.peek()) {
            case '#': part = scanner.get(RX_ID_SEL);    break;
            case '.': part = scanner.get(RX_CLASS_SEL); break;
            case '[': part = scanner.get(RX_ATTR_SEL);  break;
            default:
                part = scanner.get(RX_TAG_SEL); break
            }
            selector.tests.push(part);
        } while(!scanner.end() &&
                [' ', '>', '<', '^'].indexOf(scanner.peek()) == -1);

        query.push(selector);
    }
    return query;
}


/**
 * For each match of _regexp_ within _string_, execute _action_, or if
 * no action is provided, just return an array with the match objects.
 *
 */

function scan(string, regexp, action) {
    var matches = [];

    // Ensure regular expression is global otherwise an infinite loop
    // is just around the corner.
    var r = new RegExp(regexp.source, 'g');
    var m = r.exec(string);
    while(m) {
        if(action)
            action(m);
        else
            matches.push(m);
        m = r.exec(string);
    }
    if(!action)
        return matches;
}

/**
 * For each match of _regexp_ within _string_, execute _action_,
 * collect results of execution, and return them as an array.
 *
 */

function mapMatch(string, regexp, action) {
    var results = [];
    scan(
        string, regexp, function(match) {
            results.push(action(match));
        });
    return results;
}

/**
 * Takes a CSS selector and splits it in its parts.  Examples:
 *
 *   '#id'             // -> ['#id']
 *   '#id.class'       // -> ['#id', '.class']
 *   'tag[attr="val"]' // -> ['#id', '[attr="val"]']
 *
 */

function splitSelector(selector) {
    return mapMatch(
        selector, /\s*(\[.+?\]|(#|\.||).+?(?=#|\.|$|\[))/,
        function(m) { return m[1]; });
}

/**
 * Takes a CSS query and splits it into its part.  Each part is
 * an object with a "selector" attribute and an "axis" attribute.
 *
 */

function splitQuery(query) {
    return mapMatch(
        query, /\s*([><^]?)\s*(([a-zA-Z]|\.|#|\[).+?)(?=>|<|^| |$)/,
        function(match) {
            return { selector: match[2], axis: match[1] }
        });
}

/**
 * Compiles a CSS sub-query to a function.
 *
 * First argument is a _selector_ already split in its tests, e.g.
 *
 *   ['#urlbar']
 *   ['label']
 *   ['vbox', '.user']
 *   ['[role="something"]', '[hidden="true"]']
 *
 * Second argument is an _axis_.  Accepted values:
 *
 *   ''  : descendant
 *   '>' : child
 *   '<' : parent
 *   '^' : ancestor
 *
 * The following will find all descendant labels of element 'page',
 * having class 'header':
 *
 *   var context = document.getElementById('page');
 *   var finder  = subCompile(['label'], ['.header'], '');
 *   var labels  = finder(context);
 *
 */

function subCompile(tests, axis) {
    function locatorFor(test, axis) {
        var locator;

        switch(axis) {
        case '':
            // Descendant
            switch(test[0]) {
            case '.':
                locator = function(context) {
                    return context.getElementsByAttribute('class', test.substr(1));
                };
                break;
            case '#':
                locator = function(context) {
                    return [context.ownerDocument.getElementById(test.substr(1))];
                };
                break;
            case '[':
                var m = test.match(/^\[([\w-_]+)="?(.+?)"?\]$/);
                locator = function(context) {
                    return context.getElementsByAttribute(m[1], m[2]);
                };
                break;
            default:
                locator = function(context) {
                    return context.getElementsByTagName(test);
                };
            }
            break;

        case '>':
            // Child
            switch(test[0]) {
            case '#':
                locator = function(context) {
                    return context.ownerDocument.getElementById(test.substr(1));
                };
                break;
            case '.':
                locator = function(context) {
                    var classMatch = new RegExp('\\b' + test.substr(1) + '\\b');
                    return Array.filter(
                        context.childNodes, function(child) {
                            return classMatch.test(child.getAttribute('class'));
                        });
                };
                break;
            case '[':
                locator = function(context) {
                    var m = test.match(/^\[([\w-_]+)="?(.+?)"?\]$/);
                    return Array.filter(
                        context.childNodes, function(child) {
                            return child.getAttribute(m[1]) == m[2];
                        });
                };
                break;
            default:
                locator = function(context) {
                    return Array.filter(
                        context.childNodes,
                        function(child) {
                            return child.tagName == test;
                        });
                }
            }
            break;

        case '<':
            // Parent
            locator = function(context) {
                return (testFor(test)(context.parentNode) ?
                        [context.parentNode] : []);
            };
            break;

        case '^':
            // Ancestor

            locator = function(context) {
                while(context.parentNode) {
                    if(testFor(test)(context.parentNode))
                        return [context.parentNode];
                    context = context.parentNode;
                }
                return [];
            };

            break;

        default:
            throw new Error('Axis not implemented. (' + axis + ')');
        }

        return locator;
    }

    function testFor(test) {
        var test;
        switch(test[0]) {
        case '.':
            var classMatch = new RegExp('\\b' + test.substr(1) + '\\b');
            test = function(element) {
                return classMatch.test(element.getAttribute('class'));
            };
            break;
        case '#':
            test = function(element) {
                return element.getAttribute('id') == test.substr(1);
            };
            break;
        case '[':
            var m = test.match(/^\[([\w-_]+)="?(.+?)"?\]$/);
            test = function(element) {
                return element.getAttribute(m[1]) == m[2];
            };
            break;
        default:
            test = function(element) {
                return element.tagName == test;
            };
            break;
        }
        return test;
    }

    var locator = locatorFor(tests[0], axis);
    var additionalTests = tests.slice(1).map(function(test) { return testFor(test); });
    
    return function(context) {
        var results = locator(context);
        return additionalTests.length == 0 ?
            results :
            Array.filter(
                results, function(element) {
                    return additionalTests.every(
                        function(test) { return test(element); });
                });
    }
}

/**
 * Compile a CSS query to a function.
 *
 * Returned function will accept a starting context (an array,
 * NodeList or array-like of DOM elements) and will return an array of
 * elements matching the query.
 *
 */

function compile(query) {
    var memo = arguments.callee.memo || (arguments.callee.memo = {});
    if(memo[query])
        return memo[query];

    function fold(fn, accumulator, sequence) {
        Array.forEach(
            sequence, function(item) {
                accumulator = fn(item, accumulator);
            });
        return accumulator;
    }

    if(/^\s*$/.test(query))
        return function(context) {
            return ('length' in context) ? context : [context];
        };

    var finders = parse(query).map(
        function(selector) { return subCompile(selector.tests, selector.axis); });

    memo[query] = function(context) {
        if(!('length' in context))
            context = [context];
        
        return fold(
            function(finder, candidates) {
                return fold(
                    function(candidate, newCandidates) {
                        return newCandidates.concat(
                            Array.slice(finder(candidate)));
                    }, [], candidates);
            },
            context, finders);
    }

    return memo[query];
}

/**
 * Perform a query.
 *
 * TODO document more
 *
 */

function search() {
    var context, query;
    
    if(arguments.length == 2) {
        context = arguments[0];
        query   = arguments[1];
    } else {
        context = document.documentElement;
        query   = arguments[0];
    }

    return compile(query).call(null, context);
}

/**
 * TODO document.
 *
 *
 */

function $(query) {
    var result;
    if(typeof(query) == 'string')
        result = search(query);
    else if(query instanceof Element)
        result = search(query, '');

    function wrap(context) {
        var wrapper = {
            $: function(subQuery) {
                return wrap(search(result, subQuery));
            },
            
            get _() {
                return context[0];
            },

            get _all() {
                return context;
            }
        }

        return wrapper;
    }

    return wrap(result);
}


function verify() {
    var assert = {
        equals: function(a, b) {
            if(a != b)
                throw new Error('FAIL: different values (' + a + ',' + b + ') - ' +
                                Components.stack.caller.lineNumber);
        }
    }
    
    function utest(tests) {
        var report = [];
        for(var name in tests)
            try {
                tests[name].call();
            } catch(e) {
                report.push('**********************************************************************');
                report.push('FAILURE: ' + name + '\n' + e.message);
                report.push(e.stack);
            }
        report.push('\nTests completed.');
        
        return report.join('\n');
    }

    var tests = {
        'split query': function() {
            var parts;

            parts = splitQuery('#id.class');
            assert.equals(1, parts.length);
            assert.equals('#id.class', parts[0].selector);
            assert.equals('', parts[0].axis);

            parts = splitQuery('#id > .class');
            assert.equals(2, parts.length);
            assert.equals('#id', parts[0].selector);
            assert.equals('', parts[0].axis);
            assert.equals('.class', parts[1].selector);
            assert.equals('>', parts[1].axis);

            parts = splitQuery('#id>.class');
            assert.equals(2, parts.length);
            assert.equals('#id', parts[0].selector);
            assert.equals('', parts[0].axis);
            assert.equals('.class', parts[1].selector);
            assert.equals('>', parts[1].axis);

            parts = splitQuery('tag[attr="a@b.c/d"]');
            assert.equals(1, parts.length);
            assert.equals('tag[attr="a@b.c/d"]', parts[0].selector);

            parts = splitQuery('tag [attr="a@b.c/d"]');
            assert.equals(2, parts.length);
            assert.equals('tag', parts[0].selector);
            assert.equals('[attr="a@b.c/d"]', parts[1].selector);
        },
        
        'split selector': function() {
            var parts;

            parts = splitSelector('#id');
            assert.equals(1, parts.length);
            assert.equals('#id', parts[0]);

            parts = splitSelector('tag');
            assert.equals(1, parts.length);
            assert.equals('tag', parts[0]);

            parts = splitSelector('.class');
            assert.equals(1, parts.length);
            assert.equals('.class', parts[0]);

            parts = splitSelector('[attr="value"]');
            assert.equals(1, parts.length);
            assert.equals('[attr="value"]', parts[0]);

            parts = splitSelector('#id.class');
            assert.equals(2, parts.length);
            assert.equals('#id', parts[0]);
            assert.equals('.class', parts[1]);

            parts = splitSelector('tag.class');
            assert.equals(2, parts.length);
            assert.equals('tag', parts[0]);
            assert.equals('.class', parts[1]);

            parts = splitSelector('.class.class');
            assert.equals(2, parts.length);
            assert.equals('.class', parts[0]);
            assert.equals('.class', parts[1]);

            parts = splitSelector('[attr="value"].class');
            assert.equals(2, parts.length);
            assert.equals('[attr="value"]', parts[0]);
            assert.equals('.class', parts[1]);

            parts = splitSelector('[attr="a@b.c/d"]');
            assert.equals('[attr="a@b.c/d"]', parts[0]);
            assert.equals(1, parts.length);
        },

        'parse query': function() {
            var query = parse('#foo.bar  [attr="user@server.org/very strange resource"][attr2="val2"]>tag.class');
            assert.equals(3, query.length);
            assert.equals('', query[0].axis);
            assert.equals(2, query[0].tests.length);
            assert.equals('#foo', query[0].tests[0]);
            assert.equals('.bar', query[0].tests[1]);
            assert.equals('', query[1].axis);
            assert.equals(2, query[1].tests.length);
            assert.equals('[attr="user@server.org/very strange resource"]', query[1].tests[0]);
            assert.equals('[attr2="val2"]', query[1].tests[1]);
            assert.equals('>', query[2].axis);
            assert.equals(2, query[2].tests.length);
            assert.equals('tag', query[2].tests[0]);
            assert.equals('.class', query[2].tests[1]);
        }
    };

    return utest(tests);
}

