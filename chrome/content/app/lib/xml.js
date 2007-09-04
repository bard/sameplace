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


/**
 * Routines for generic XML (E4X) manipulation.
 *
 */


// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

var xml = {};


// UTILITIES
// ----------------------------------------------------------------------

// For each text node in _xmlFragment_, applies _processFn_.
// Returns a copy of _srcNode_ with text nodes replaced by results of
// _processFn_.
//
// For example, in:
//
//     <span>hello <b>world</b></span>
//
// "hello " and "world" are text nodes.  The following:
//
//     xml.mapTextNodes(
//         <span>hello <b>world</b></span>,
//         function(textNode) {
//             return textNode.toString().toUpperCase();
//         });
//
// Returns:
//
//     <span>HELLO <b>WORLD</b></span>

xml.mapTextNodes = function(srcNode, processFn) {
    var mapTextNodes = arguments.callee;
    var dstNode;
    
    switch(srcNode.nodeKind()) {
    case 'text':
        dstNode = processFn(srcNode);
        break;
    case 'element':
        dstNode = <{srcNode.localName()}/>;
        
        for each(var srcAttr in srcNode.@*::*)
            dstNode['@' + srcAttr.localName()] = srcAttr.valueOf();

        for each(var srcChild in srcNode.*::*) {
            var dstChild = mapTextNodes(srcChild, processFn);
            switch(typeof(dstChild)) {
            case 'xml':
            case 'string':
                dstNode.appendChild(dstChild);
                break;
            case 'object':
                for each(var dstChildPart in dstChild) {
                    dstNode.appendChild(dstChildPart);
                }
                break;
            default:
                throw new Error('Unexpected. (' + typeof(dstChild) + ')');
            }
        }

        // It is important that namespace is set *after* children have
        // been added!
        
        dstNode.setNamespace(srcNode.namespace());

        break;
    default:
        throw new Error('Unexpected.');
        break;
    }
    return dstNode;
};
