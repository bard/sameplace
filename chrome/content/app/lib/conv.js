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
 * Routines for plain text/HTML/XHTML conversion.  Unless where
 * specified otherwise, they are side-effects free.
 *
 * Dependencies: namespaces.js
 *
 */


// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const serializer  = new XMLSerializer();
const parser      = new DOMParser();

var conv = {};


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
    return undefined;
}

conv.toXML = function(domElement) {
    return new XML(serializer.serializeToString(domElement));    
};

conv.toDOM = function(thing) {
    return parser.parseFromString((typeof(thing) == 'xml' ?
                                   thing.toXMLString() : thing),
                                  'application/xhtml+xml').documentElement;    
};

/**
 * Returns a well-formed translation of an HTML DOM as an XML object.
 *
 *   var node = document.body;
 *   node.innerHTML; // -> '<BODY><IMG src="file.jpg"><P>hello,<BR>world</P></BODY>'
 *   conv.htmlDOMToXHTML(node);
 *     // -> <body xmlns="http://www.w3.org/1999/xhtml">
 *     //    <img src="file.jpg"/><p>hello,<br/>world</p></body>
 *  
 */

conv.htmlDOMToXHTML = function(node) {
    var self = arguments.callee;
    
    switch(node.nodeType) {
    case Node.ELEMENT_NODE:
        var element = <{node.nodeName.toLowerCase()} xmlns={ns_xhtml}/>;

        for(var attr = node.attributes[0], i=0; attr = node.attributes[i]; i++)
            element['@' + attr.name] = attr.value;

        var child = node.firstChild;
        while(child) {
            element.appendChild(self(child));
            child = child.nextSibling;
        }

        return element;
        break;
    case Node.TEXT_NODE:
        return node.textContent;
        break;
    default:
        throw new Error('Unexpected. (' + node.nodeType + ')');
    }
    return undefined;
};

/**
 * Converts an XHTML tree into a string tree, optionally degrading it
 * to markup returned by convertFn.
 *
 *   conv.xhtmlToStringTree(<p>hello, <span>world<span>!</p>);
 *     // -> ["hello, ", ["world"], "!"]
 *   
 *   conv.xhtmlToStringTree(<p>hello, <img src="world.jpg"/></p>,
 *                          conv.xhtmlElementToText);
 *     // -> ["hello, ", ["(image: ", "world.jpg", ")"]]
 *   
 *   conv.xhtmlToStringTree(<p>hello, <span style="font-style: italic;">world</span>!</p>,
 *                          conv.xhtmlElementToText);
 *     // -> ["hello, ", ["/", ["world"], "/"], "!"]
 *
 */

conv.xhtmlToStringTree = function(src, convertFn) {
    function processList(list, convertFn) {
        var dstList = [];
        for each(var child in list)
            dstList.push(self(child, convertFn));
        return dstList;
    }

    var self = arguments.callee;
    
    switch(src.nodeKind()) {
    case 'text':
        return src.toString();
        break;
    case 'element':
        var convResult;
        if(convertFn) 
            convResult = convertFn(src);

        switch(typeof(convResult)) {
        case 'undefined':
            return processList(src.*::*, convertFn);
            break;
        case 'function':
            return convResult(processList(src.*::*, convertFn));
            break;
        default:
            return convResult;
        }
    default:
        throw new Error('Unexpected. (' + src.nodeKind() + ')');
    }
    return undefined;
};

/**
 * Returns a conversion of given XHTML element.  Conversion can be
 * undefined for no conversion, an array for literal conversion, or a
 * function for a conversion that will wrap the element's children.
 *
 *   conv.xhtmlElementToMarkup(<p>hello</p>);
 *     // -> undefined
 *   
 *   conv.xhtmlElementToMarkup(<img src="test.jpg"/>);
 *     // -> ['(image: ', 'test.jpg', ')']
 *   
 *   conv.xhtmlElementToMarkup(<span style="font-style: italic;">hello</span>);
 *     // -> function(children) { return ['_', children, '_']; }
 *
 */

conv.xhtmlElementToMarkup = function(element) {
    switch(element.localName()) {
    case 'img':
        return ['(image: ', element.@src.toString(), ')'];
        break;
    case 'span':
        if(/font-style:\s*italic/.test(element.@style))
            return function(children) { return ['/', children, '/']; }
        else if(/font-weight:\s*bold/.test(element.@style))
            return function(children) { return ['*', children, '*']; }
        else if(/text-decoration:\s*underline/.test(element.@style))
            return function(children) { return ['_', children, '_']; }
        break;
    }
    return undefined;
};

/**
 * Converts an XHTML tree to text, using rules defined in
 * conv.xhtmlElementToMarkup.
 *
 *   conv.xhtmlToText(<p>hello, <span>world<span>!</p>);
 *     // -> "hello, world!"
 *   
 *   conv.xhtmlToText(<p>hello, <span style="font-style: italic">world<span>!</p>);
 *     // -> "hello, /world/!"
 *
 */

conv.xhtmlToText = function(src) {
    function depthFirst(thing, fn) {
        if(typeof(thing) == 'object') {
            for each(var element in thing)
                depthFirst(element, fn);
        } else 
            return fn(thing);

        return undefined;
    }

    var flatList = [];
    depthFirst(conv.xhtmlToStringTree(src, conv.xhtmlElementToMarkup),
               function(text) {
                   flatList.push(text);
               });
    return flatList.join('');
};
