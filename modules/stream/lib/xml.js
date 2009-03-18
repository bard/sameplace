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
