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


function x() {
    var contextNode, path;
    if(arguments[0] instanceof Ci.nsIDOMElement ||
       arguments[0] instanceof Ci.nsIDOMDocument) {
        contextNode = arguments[0];
        path = arguments[1];
    }
    else {
        path = arguments[0];
        contextNode = document;
    }

    function resolver(prefix) {
        switch(prefix) {
        case 'xul':
            return 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
            break;
        case 'html':
            return 'http://www.w3.org/1999/xhtml';
            break;
        }
    }

    return document.evaluate(
        path, contextNode, resolver, XPathResult.ANY_UNORDERED_NODE_TYPE, null).
        singleNodeValue;
}

function cloneBlueprint(role) {
    return x('//*[@id="blueprints"]/*[@role="' + role + '"]').
        cloneNode(true);
}

function _(element, descendantQuery) {
    if(typeof(element) == 'string')
        element = document.getElementById(element);

    if(typeof(descendantQuery) == 'object')
        for(var attrName in descendantQuery)
            element = element.getElementsByAttribute(
                attrName, descendantQuery[attrName])[0];

    return element;
}

function fadeIn(element, stepValue, stepInterval) {
    stepValue = stepValue || 0.1;
    stepInterval = stepInterval || 150;

    function fadeStep() {
        if(element.style.opacity == 1)
            return;

        var targetOpacity = parseFloat(element.style.opacity) + stepValue;
        if(targetOpacity > 1)
            targetOpacity = 1;

        element.style.opacity = targetOpacity;

        window.setTimeout(fadeStep, stepInterval);
    }

    fadeStep();
}

function attr(element, attributeName) {
    if(element.hasAttribute(attributeName))
        return element.getAttribute(attributeName);
    else
        return getAncestorAttribute(element, attributeName);
}

function getAncestorAttribute(element, attributeName) {
    while(element.parentNode && element.parentNode.hasAttribute) {
        if(element.parentNode.hasAttribute(attributeName))
            return element.parentNode.getAttribute(attributeName);
        element = element.parentNode;
    }
    return null;
}
