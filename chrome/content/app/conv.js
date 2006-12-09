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
 * Routines for plain text/HTML/XML conversion.
 *
 */


// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const serializer  = new XMLSerializer();
const parser      = new DOMParser();


// GLOBAL STATE
// ----------------------------------------------------------------------

var conv = {};


// UTILITIES
// ----------------------------------------------------------------------

function makeEmoticonRegexp(emoticons) {
    var symbols = [];
    for(var symbol in emoticons)
        symbols.push(symbol);

    return new RegExp(
        symbols.map(
            function(symbol) {
                return symbol.replace(/(\(|\)|\*|\|)/g, '\\$1');
            }).join('|'),
        'g');
}


// PUBLIC FUNCTIONALITY
// ----------------------------------------------------------------------

conv.toString = function(thing) {
    if(thing instanceof Element)
        return serializer.serializeToString(thing);
    else
        switch(typeof(thing)) {
        case 'xml':
            return thing.toXMLString();
            break;
        case 'string':
            return thing;
            break;
        default:
            throw new Error('Unexpected. (' + typeof(thing) + ')');
    }
}

conv.toXML = function(domElement) {
    return new XML(serializer.serializeToString(domElement));    
};

conv.toDOM = function(thing) {
    return parser.parseFromString((typeof(thing) == 'xml' ?
                                   thing.toXMLString() : thing),
                                  'application/xhtml+xml').documentElement;    
};

conv.applyTextProcessors = function(xmlFragment, textProcessors) {
    var applyTextProcessors = arguments.callee;
    
    return textProcessors.length == 0 ?
        xmlFragment :
        applyTextProcessors(
            xml.mapTextNodes(
                xmlFragment, function(textNode) {
                    return text.mapMatch(textNode.toString(),
                                         textProcessors[0].regexp,
                                         textProcessors[0].action);
                }),
            textProcessors.slice(1));
}

