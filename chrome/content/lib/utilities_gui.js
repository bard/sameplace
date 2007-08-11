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

if(typeof(document.evaluate) == 'function') {
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
            return undefined;
        }

        return document.evaluate(
            path, contextNode, resolver, XPathResult.ANY_UNORDERED_NODE_TYPE, null).
            singleNodeValue;
    }
}

if(typeof(x) == 'function') {
    function cloneBlueprint(role) {  
        return x('//*[@id="blueprints"]/*[@role="' + role + '"]')
            .cloneNode(true);
    }
} else {
    function cloneBlueprint(role) {
        var blueprints = _('blueprints').childNodes;
        for(var i=0; i<blueprints.length; i++){
            if(blueprints[i].getAttribute('role') == role)
                return blueprints[i].cloneNode(true);
        }
        return undefined;
    }
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

function afterLoad(contentPanel, action) {
    contentPanel.addEventListener(
        'load', function(event) {
            if(event.target != contentPanel.contentDocument)
                return;

            // The following appears not to work if reference to
            // contentPanel is not the one carried by event object.
            contentPanel = event.currentTarget;
            contentPanel.contentWindow.addEventListener(
                'load', function(event) {
                    action(contentPanel);
                }, false);

            contentPanel.removeEventListener('load', arguments.callee, true);
        }, true);
}
// XXX remove when all instances of queuePostLoadAction have been removed.
var queuePostLoadAction = afterLoad;

function hasAncestor(element, parentName, parentNamespace) {
    var elementDoc = element.ownerDocument;
    while(element != elementDoc) {
        if(element.localName == parentName &&
           (!parentNamespace || element.isDefaultNamespace(parentNamespace)))
            return element;
        element = element.parentNode;
    }
    return false;
}

function getBrowser() {
    if(top.getBrowser)
        return top.getBrowser();

    return undefined;
}

// XXX merge with openURL below

function openLink(url, newTab) {
    const srvPrompt = Cc['@mozilla.org/embedcomp/prompt-service;1']
        .getService(Ci.nsIPromptService);

    if(url.match(/^javascript:/))
        srvPrompt.alert(
            window, 'SamePlace: Security Notification',
            'This link contains javascript code and has been disabled as a security measure.');
    else if(typeof(getBrowser().addTab) == 'function' &&
            url.match(/^((https?|ftp|file|mailto):\/\/|xmpp:)/))
        openLinkInternally(url, newTab);
    else
        openLinkExternally(url);
}

function openLinkExternally(url) {
    Cc['@mozilla.org/uriloader/external-protocol-service;1']
        .getService(Ci.nsIExternalProtocolService)
        .loadUrl(Cc['@mozilla.org/network/io-service;1']
                 .getService(Ci.nsIIOService)
                 .newURI(url, null, null));
}

function openLinkInternally(url, newTab) {
    if(newTab)
        getBrowser().selectedTab = getBrowser().addTab(url);
    else
        getBrowser().loadURI(url);
}

// From mozapps/extensions/extensions.js

// XXX remove dependency on specific application, instead check for
// presence of windows of type navigator:browser.

if(hostAppIsMail())
    function openURL(url) {
        openLinkExternally(url);
    }
else
    function openURL(aURL) {
        var pref = Cc['@mozilla.org/preferences-service;1']
            .getService(Ci.nsIPrefBranch);
        if(window.opener && window.opener.openUILinkIn) {
            var where = pref.getIntPref('browser.link.open_newwindow') == 3 ? 'tab' : 'window';
            window.opener.openUILinkIn(aURL, where);
        } else
            window.openDialog('chrome://browser/content/browser.xul',
                              '_blank', 'chrome,all,dialog=no', aURL, null, null);
    }
