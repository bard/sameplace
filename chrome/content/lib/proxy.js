/*
  Copyright (C) 2005-2006 by Massimiliano Mirra

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


var proxy = {};

/**
 * Given an object and a property name (assumed to point to a
 * function), returns a stand-alone function which remembers the
 * object it comes from, and operates on it when called.
 *
 * Example:
 *
 *     var a = {
 *         _state: 'hello',
 *
 *         getState: function() {
 *             return this._state;
 *         }
 *     }
 *     var standAloneGetState = boundFunction(a, 'getState');
 *     standAloneGetState(); // -> 'hello'
 *
 */

proxy.boundFunction = function(object, name) {
    return function() {
        return object[name].apply(object, arguments);
    }
};

/**
 * Given a source object, a destination object, and a property
 * name of the source object, creates a same-name property in the
 * destination object, which proxies the one on the source object.
 *
 * Example:
 *
 *     var src = {
 *         _counter: 1,
 *
 *         get counter() {
 *             return this._counter;
 *         },
 *
 *         incCounter: function() {
 *             this._counter++;
 *         }
 *     };
 *     var dst = {};
 *
 *     basicForwardProperty(src, dst, '_counter');
 *     basicForwardProperty(src, dst, 'counter');
 *     basicForwardProperty(src, dst, 'incCounter');
 *
 *     src._counter;      // -> 1
 *     dst.counter;       // -> 1
 *     dst.incCounter();  //
 *     dst._counter;      // -> 2
 *     dst.counter;       // -> 2
 *
 */

proxy.basicForwardProperty = function(source, dest, name) {
    if(typeof(source[name]) == 'function')
        dest[name] = proxy.boundFunction(source, name);
    else {
        dest.__defineGetter__(
            name, function() {
                return source[name];
            });
        dest.__defineSetter__(
            name, function(value) {
                source[name] = value;
            });
    }
};

/**
 * Like basicForwardProperty(), but optionally divert the proxied
 * function (won't do anything with getters/setters/properties')
 * to a custom handler, which in turn will be able to decide
 * whether to provide custom processing or perform the default
 * processing.
 *
 * Example:
 *
 *     var src = {
 *         _counter: 1,
 *
 *         get counter() {
 *             return this._counter;
 *         },
 *
 *         incCounter: function() {
 *             this._counter++;
 *         },
 *
 *         greet: function() {
 *             return 'hello from src';
 *         }
 *     };
 *     var dst = {};
 *
 *     basicForwardProperty(src, dst, '_counter');
 *     basicForwardProperty(src, dst, 'counter');
 *     basicForwardProperty(src, dst, 'incCounter');
 *
 *     forwardProperty(src, dst, 'greet',
 *                     function(originalHandler) {
 *                         if(this._counter == 3)
 *                             return 'hello from dst (custom processing)';
 *                         else
 *                             return originalHandler();
 *                     });
 *
 *     dst.counter;      // -> 1
 *     dst.greet();      // -> 'hello from src'
 *     dst.incCounter();
 *     dst.incCounter();
 *     dst.greet();      // -> 'hello from dst (custom processing)'
 *
 */

proxy.forwardProperty = function(source, dest, name, customHandler) {
    function argsToArray(args) {
        return Array.slice.call(null, args);
    }

    if(customHandler)
        if(typeof(source[name] == 'function'))
            dest[name] = function() {
                var originalHandler = proxy.boundFunction(source, name);
                return customHandler.apply(source, [originalHandler].concat(argsToArray(arguments)));
            }
        else
            proxy.basicForwardProperty(source, dest, name);
    else
        proxy.basicForwardProperty(source, dest, name);
};

/**
 * Given an object, returns a proxy.  Calls to properties of the proxy
 * will be routed to the original object.
 *
 * With _customHandlers_, you can specify properties (associated to
 * functions) for which you wish to provide custom processing.
 *
 * Example:
 *
 *     var src = { a: 1, b: function() { return 'hello'; };
 *     var dst = proxy.create(src, { b: function(originalHandler) {
 *                                          alert('executing b');
 *                                          return originalTarget();
 *                                 });
 *
 */

proxy.create = function(object, customHandlers) {
    customHandlers = customHandlers || {};
    var proxyObject = {};
    for(var name in object)
        proxy.forwardProperty(object, proxyObject, name, customHandlers[name]);

    return proxyObject;
};
