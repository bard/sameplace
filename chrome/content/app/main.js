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


// GLOBAL STATE
// ----------------------------------------------------------------------

var wantBottom = true;
var scrolling = false;
var isGroupchat = false;
var userAddress;
var contactResource;
var contactName;
var inputArea;


// UTILITIES
// ----------------------------------------------------------------------

function visible(element) {
    element.style.display = 'block';
}

function hidden(element) {
    element.style.display = 'none';
}

function JID(string) {
    var m = string.match(/^(.+?@)?(.+?)(?:\/|$)(.*$)/);

    var jid = {};

    if(m[1])
        jid.username = m[1].slice(0, -1);

    jid.hostname = m[2];
    jid.resource = m[3];
    jid.nick     = m[3];
    jid.full     = m[3] ? string : null;
    jid.address  = jid.username ?
        jid.username + '@' + jid.hostname :
        jid.hostname;

    return jid;    
}

function stripUriFragment(uri) {
    var hashPos = uri.lastIndexOf('#');
    return (hashPos != -1 ?
            uri.slice(0, hashPos) :
            uri);}

function padLeft(string, character, length) {
    string = string.toString();
    while(string.length < length)
        string = character + string;
    
    return string;
}

function formatTime(dateTime) {
    return padLeft(dateTime.getHours(), '0', 2) + ':' +
        padLeft(dateTime.getMinutes(), '0', 2) + ':' +
        padLeft(dateTime.getSeconds(), '0', 2)
}


// GUI UTILITIES (GENERIC)
// ----------------------------------------------------------------------

function _(thing) {
    switch(typeof(thing)) {
    case 'string':
        return document.getElementById(thing);
        break;
    case 'xml':
        return document.getElementById(thing.toString());
        break;
    default:
        return thing;
    }
}

function copyDomContents(srcElement, dstElement) {
    for(var i=srcElement.childNodes.length-1; i>=0; i--) 
        dstElement.insertBefore(
            srcElement.childNodes[i],
            dstElement.firstChild);
}

function getElementByAttribute(parent, name, value) {
    for(var child = parent.firstChild; child; child = child.nextSibling)
        if(child.getAttribute && child.getAttribute(name) == value)
            return child;

    for(var child = parent.firstChild; child; child = child.nextSibling) {
        var matchingChild = getElementByAttribute(child, name, value);
        if(matchingChild)
            return matchingChild;
    }
}

function x() {
    var contextNode, path;
    if(typeof(arguments[0]) == 'string') {
        contextNode = document;
        path = arguments[0];
    } else {
        contextNode = arguments[0];
        path = arguments[1];
    }

    function resolver(prefix) {
        return 'http://www.w3.org/1999/xhtml';
    }

    return document.evaluate(
        path, contextNode, resolver,
        XPathResult.ANY_UNORDERED_NODE_TYPE, null).singleNodeValue;
}

function isNearBottom(domElement, threshold) {
    return Math.abs(domElement.scrollHeight -
                    (domElement.scrollTop + domElement.clientHeight)) < (threshold || 24);
}

function isAtBottom(domElement) {
    return domElement.scrollHeight == domElement.scrollTop + domElement.clientHeight;
}

function smoothScroll(domElement, stepsLeft) {
    if(stepsLeft == undefined)
        stepsLeft = 4;
    else if(stepsLeft == 0)
        return;

    var targetScrollTop = domElement.scrollHeight - domElement.clientHeight;
    var deltaScrollTop = Math.abs(domElement.scrollTop - targetScrollTop);
    var nextStep = deltaScrollTop / stepsLeft;
    domElement.scrollTop += nextStep;

    window.setTimeout(
        function() { smoothScroll(domElement, stepsLeft - 1); }, 5);
}

function scrollToBottom(domElement, smooth) {
    if(isAtBottom(domElement) ||
       (smooth && scrolling))
        return;

    if(smooth == undefined)
        smooth = true;

    if(smooth)
        smoothScroll(domElement);
    else        
        domElement.scrollTop =
            domElement.scrollHeight - domElement.clientHeight;
}

function scrollingOnlyIfAtBottom(domElement, action) {
    var shouldScroll = isNearBottom(domElement);
    action();
    if(shouldScroll)
        scrollToBottom(domElement);
}


// GUI UTILITIES (SPECIFIC)
// ----------------------------------------------------------------------

/**
 * Provides a convenient stateless wrapper over a document element
 * representing a message.
 *
 * Element descendants with "class" attribute set to "sender", "time"
 * and "content" will be accessible through members of the wrapper, as
 * in:
 *
 *   M(domMessage).sender
 *   M(domMessage).time
 *   M(domMessage).content
 *
 */

function M(domElement) {
    var wrapper = {
        get sender() {
            return getElementByAttribute(domElement, 'class', 'sender');
        },

        get time() {
            return getElementByAttribute(domElement, 'class', 'time');
        },

        get content() {
            return getElementByAttribute(domElement, 'class', 'content');
        }   
    };

    return wrapper;
}

function cloneBlueprint(name) {
    return x('//*[@id="blueprints"]' +
             '//*[@class="' + name + '"]')
        .cloneNode(true);
}


// GUI INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init(event) {
    _('xmpp-incoming').addEventListener(
        'DOMNodeInserted', function(event) {
            var stanza = new XML(event.target.textContent);
            switch(stanza.localName()) {
            case 'message':
                seenMessage(stanza);
                break;
            case 'presence':
                seenPresence(stanza);
                break;
            case 'iq':
                seenIq(stanza);
                break;
            }
        }, false);

    info.init(_('info'));

    window.addEventListener(
        'resize', function(event) { resizedWindow(event); }, false);

    _('chat-output').addEventListener(
        'scroll', function(event) { scrolledWindow(event); }, false);

    inputArea = new InputArea(_('chat-input'));
    inputArea.onLoad = function() { inputArea.focus(); };
    inputArea.onAcceptContent = function(content) { send(content); };
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function displayMessage(stanza) {
    scrollingOnlyIfAtBottom(
        _('chat-output'), function() {
            var domMessage = cloneBlueprint('message');
            if(stanza.@type == 'groupchat')
                M(domMessage).sender.textContent = JID(stanza.@from).resource;
            else
                if(stanza.@from == undefined)
                    M(domMessage).sender.textContent = JID(userAddress).username;
                else
                    M(domMessage).sender.textContent =
                        contactName || JID(stanza.@from).username || stanza.@from;
            
            M(domMessage).sender.setAttribute(
                'class', stanza.@from.toString() ? 'contact' : 'user');

            copyDomContents(
                (stanza.ns_xhtml_im::html == undefined ?
                 conv.plainTextToHTML(stanza.body) :
                 conv.toDOM(filter.xhtmlIM.keepRecommended(
                                stanza.ns_xhtml_im::html.ns_xhtml::body))),
                M(domMessage).content);

            var timeSent;
            if(stanza.ns_delay::x != undefined) {
                var m = stanza.ns_delay::x.@stamp.toString()
                    .match(/^(\d{4})(\d{2})(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
                timeSent = new Date(Date.UTC(m[1], m[2], m[3], m[4], m[5], m[6]));
            } else 
                timeSent = new Date();

            M(domMessage).time.textContent = formatTime(timeSent);
                
            _('messages').appendChild(domMessage);
        });
}

function displayEvent(eventClass, text) {
    scrollingOnlyIfAtBottom(
        _('chat-output'), function() {
            var domChatEvent = cloneBlueprint(eventClass);
            domChatEvent.textContent = text;
            _('messages').appendChild(domChatEvent);
        });
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function scrolledWindow(event) {
    wantBottom = isNearBottom(_('chat-output'));
}

function resizedWindow(event) {
    if(wantBottom || _('chat-output').scrollTop == 0)
        scrollToBottom(_('chat-output'), false);
}

function requestedFormatCommand(event) {
    if(event.target.getAttribute('class') != 'command')
        return;

    inputArea.execCommand(event.target.getAttribute('id'), null);
    event.target.blur();
    inputArea.focus();
}


// NETWORK ACTIONS
// ----------------------------------------------------------------------

/**
 * Builds a message having the given text as body and sends it out.
 *
 */

function send(htmlText) {
    strictXML();

    var message =
        <message>
        <html xmlns="http://jabber.org/protocol/xhtml-im"/>
        </message>;

    if(contactResource) 
        message.@to = '/' + contactResource;

    message.body = <body>{filter.stripTags(
                              filter.htmlEntitiesToCharacters(
                                  htmlText))}</body>;

    message.ns_xhtml_im::html.body = new XML(
        '<body xmlns="http://www.w3.org/1999/xhtml">' +
        filter.htmlToXHTMLTags(
            filter.htmlEntitiesToCodes(htmlText)) +
        '</body>');

    _('xmpp-outgoing').textContent = message.toXMLString();

    looseXML();
}

function strictXML() {
    var settings = XML.settings();
    XML.prettyPrinting = false;
    XML.ignoreWhitespace = false;
    return settings;
}

function looseXML(settings) {
    XML.setSettings(XML.defaultSettings());
}

// NETWORK REACTIONS
// ----------------------------------------------------------------------

function seenMessage(stanza) {
    if(stanza.body == undefined)
        return;

    if(stanza.@type == 'error')
        displayEvent('error', 'Error: code ' + stanza.error.@code);
    else
        displayMessage(stanza);

    if(stanza.@from != undefined && !isGroupchat)
        contactResource = JID(stanza.@from).resource;
}

function seenPresence(stanza) {
    if(stanza.@from == undefined) {
        if(stanza.ns_muc::x.length() > 0)
            isGroupchat = true;
    } else {
        if(stanza.ns_muc_user::x.length() > 0) {
            x('//xhtml:div[@class="box" and @for="resources"]/xhtml:h3')
                .textContent = 'Participants';

            if(stanza.@type == undefined)            
                displayEvent('join', JID(stanza.@from).resource + ' entered the room');
            else if(stanza.@type == 'unavailable')
                displayEvent('leave', JID(stanza.@from).resource + ' left the room');
            else if(stanza.@type == 'error')
                displayEvent('error', 'Error: code ' + stanza.error.@code);
        }
    
        info.updateAddress(JID(stanza.@from).address);
        info.updateResources(JID(stanza.@from).resource, stanza.@type);
        info.updateTitle(JID(stanza.@from).address);
    }
}

function seenIq(stanza) {
    if(stanza.ns_roster::query.length() > 0) {
        userAddress = JID(stanza.@to).address;
        contactName = stanza..ns_roster::item.@name.toString();
        if(stanza..ns_roster::item.length() > 0)
            info.updateAddress(stanza..ns_roster::item.@jid);
    }
}


