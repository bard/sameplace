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
 * Compiles a CSS sub-query to a function.
 *
 * First argument is a _selector_, e.g.
 *
 *   '#urlbar'
 *   'label'
 *   'vbox.user'
 *   '[role="something"][hidden="true"]'
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
 *   var finder  = compileSubQuery('label.header', '');
 *   var labels  = finder(context);
 *
 */

function subCompile(selector, axis) {
    function locatorFor(selector, axis) {
        var locator;

        switch(axis) {
        case '':
            // Descendant
            switch(selector[0]) {
            case '.':
                locator = function(context) {
                    return context.getElementsByAttribute('class', selector.substr(1));
                };
                break;
            case '#':
                locator = function(context) {
                    return [context.ownerDocument.getElementById(selector.substr(1))];
                };
                break;
            case '[':
                var m = selector.match(/^\[([\w-_]+)="?([\w-_]+)"?\]$/);
                locator = function(context) {
                    return context.getElementsByAttribute(m[1], m[2]);
                };
                break;
            default:
                locator = function(context) {
                    return context.getElementsByTagName(selector);
                };
            }
            break;

        case '>':
            // Child
            switch(selector[0]) {
            case '#':
                locator = function(context) {
                    return context.ownerDocument.getElementById(selector.substr(1));
                };
                break;
            case '.':
                locator = function(context) {
                    var classMatch = new RegExp('\\b' + selector.substr(1) + '\\b');
                    return Array.filter(
                        context.childNodes, function(child) {
                            return classMatch.test(child.getAttribute('class'));
                        });
                };
                break;
            case '[':
                locator = function(context) {
                    var m = selector.match(/^\[([\w-_]+)="?([\w-_]+)"?\]$/);
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
                            return child.tagName == selector;
                        });
                }
            }
            break;

        case '<':
            // Parent
            locator = function(context) {
                return (testFor(selector)(context.parentNode) ?
                        [context.parentNode] : []);
            };
            break;

        case '^':
            // Ancestor

            locator = function(context) {
                while(context.parentNode) {
                    if(testFor(selector)(context.parentNode))
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

    function testFor(selector) {
        var test;
        switch(selector[0]) {
        case '.':
            var classMatch = new RegExp('\\b' + selector.substr(1) + '\\b');
            test = function(element) {
                return classMatch.test(element.getAttribute('class'));
            };
            break;
        case '#':
            test = function(element) {
                return element.getAttribute('id') == selector.substr(1);
            };
            break;
        case '[':
            var m = selector.match(/^\[([\w-_]+)="?([\w-_]+)"?\]$/);
            test = function(element) {
                return element.getAttribute(m[1]) == m[2];
            };
            break;
        default:
            test = function(element) {
                return element.tagName == selector;
            };
            break;
        }
        return test;
    }

    var locator, additionalTests = [], firstMatch = true;
    scan(
        selector, /\s*((#|\.||\[)[\w_\-=\"]+\]?)/g,
        function(match) {
            if(firstMatch) {
                locator = locatorFor(match[1], axis);
                firstMatch = false;
            }
            else
                additionalTests.push(testFor(match[1]));
        });

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
 * TODO memoize compiled queries
 *
 */

function compile(query) {
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

    const SUBQUERY_REGEXP = /\s*([><^]?)\s*([\.#\[\]\w-_=\"]+)/;

    var finders = mapMatch(
        query, SUBQUERY_REGEXP,
        function(match) {
            var axis = match[1], selector = match[2];
            return subCompile(selector, axis);
        });

    return function(context) {
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
        equals: function(array1, array2) {
            if(typeof(array1) != typeof(array2)) {
                throw new Error('FAIL: different object types - ' + Components.stack.caller.lineNumber);
            }
            else if(typeof(array1) == 'xml') {
                if(array1 != array2)
                    throw new Error('FAIL: ' + Components.stack.caller.lineNumber);
            }
            else if('length' in array1) {
                if(array1.length != array2.length) {
                    throw new Error('FAIL: different array lengths - ' + Components.stack.caller.lineNumber);
                    return;
                } else {
                    for(var i=0; i<array1.length; i++)
                        if(array1[i] != array2[i])
                            throw new Error('FAIL: ' + Components.stack.caller.lineNumber +
                                            ' (' + array1[i] + ' vs ' + array2[i] + ')');
                    
                }
            }
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
}