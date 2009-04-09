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


/// DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

Cu.import('resource://sameplace/csstoxpath.jsm')


/// API
// ----------------------------------------------------------------------

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
    if(context == undefined) {
        Components.utils.reportError(xpath);
        Components.utils.reportError(css);
        Components.utils.reportError(Components.stack.caller.caller)
    }
    return document.evaluate(xpath, context, null,
                             Components.interfaces.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE, null)
        .singleNodeValue;
}

function $$(first, second) {
    var context, query;
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
