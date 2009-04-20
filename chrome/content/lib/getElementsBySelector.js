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

function $() {
    var context, cssExpr;
    switch(arguments.length) {
    case 1:
        [context, cssExpr] = [document, arguments[0]];
        break;
    case 2:
        [context, cssExpr] = [arguments[0], arguments[1]];
        break;
    default:
        throw new Error('Wrong argument count. (' + arguments.length + ')');
    }

    var memo = arguments.callee.memo || (arguments.callee.memo = {});
    var xpathExpr;
    if(cssExpr in memo)
        xpathExpr = memo[cssExpr];
    else {
        xpathExpr = document.createExpression(cssToXPath(cssExpr), null);
        memo[cssExpr] = xpathExpr;
    }

    return xpathExpr.evaluate(context,
                              Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE,
                              null).singleNodeValue;
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
