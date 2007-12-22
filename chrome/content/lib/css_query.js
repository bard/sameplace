/*
 * Copyright 2006-2007 by Massimiliano Mirra
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
 * Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
 *  
 */

function $(query) {
    var search = arguments.callee.implementation.search;
    
    var result;
    if(typeof(query) == 'string')
        result = search(query);
    else if(query instanceof Element)
        result = search(query, '');
    else
        throw new Error('Invalid query. (' + query + ')');

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
$.implementation = {};

Components
.classes['@mozilla.org/moz/jssubscript-loader;1']
.getService(Components.interfaces.mozIJSSubScriptLoader)
.loadSubScript('chrome://sameplace/content/lib/css_query_impl.js', $.implementation);

