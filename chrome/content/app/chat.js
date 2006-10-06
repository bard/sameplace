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

// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

var serializer = new XMLSerializer();
var parser = new DOMParser();
var ns_xhtml    = 'http://www.w3.org/1999/xhtml';
var ns_muc_user = 'http://jabber.org/protocol/muc#user';
var ns_muc      = 'http://jabber.org/protocol/muc';
var ns_roster   = 'jabber:iq:roster';

var wsRegexp = /^\s*$/m;
var urlRegexp = new RegExp('(http:\/\/|www\.)[^ \\t\\n\\f\\r"<>|()]*[^ \\t\\n\\f\\r"<>|,.!?(){}]');
var smileyMap = {
    '0:-)':  'angel',
    ':\'(':  'crying',
    '>:-)':  'devil-grin',
    'B-)':   'glasses',
    ':-*':   'kiss',
    ':-(|)': 'monkey',
    ':-|':   'plain',
    ':-(':   'sad',
    ':-))':  'smile-big',
    ':-)':   'smile',
    ':-D':   'grin',
    ':-0':  'surprise',
    ';-)':   'wink'
};
var smileyRegexp;

(function() {
    var smileySymbols = [];
    for(var symbol in smileyMap)
        smileySymbols.push(symbol);

    smileyRegexp = smileySymbols.map(
        function(symbol) {
            return symbol.replace(/(\(|\)|\*|\|)/g, '\\$1');
        }).join('|');
})();


// GLOBAL STATE
// ----------------------------------------------------------------------

var wantBottom = true;
var scrolling = false;
var groupchat = false;
var userAddress;
var contactResource;


// UTILITIES
// ----------------------------------------------------------------------

function visible(element) {
    element.style.display = 'block';
}

function hidden(element) {
    element.style.display = 'none';
}

function JID(string) {
    var m = string.match(/^(.+@)?(.+?)(?:\/|$)(.*$)/);

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

function toXML(domElement) {
    return new XML(serializer.serializeToString(domElement));
}

function toDOM(description) {
    return parser.parseFromString((typeof(description) == 'xml' ?
                                   description.toXMLString() : description),
                                  'application/xhtml+xml').documentElement;
}


// GUI UTILITIES (GENERIC)
// ----------------------------------------------------------------------

function textToHTML(container, text) {
    text = text.toString();
    
    var rx = new RegExp([urlRegexp.source, smileyRegexp].join('|'), 'g');
    
    var start = 0;
    var match = rx.exec(text);
    while(match) {
        container.appendChild(
            document.createTextNode(
                text.substring(start, match.index)));

        start = rx.lastIndex;

        var translatedElement;
        if(match[0].match(smileyRegexp)) {
            translatedElement = document.createElement('img');
            translatedElement.setAttribute('class', 'emoticon');
            translatedElement.setAttribute('alt', match[0]);
            translatedElement.
                setAttribute('src',
                             'emoticons/' + smileyMap[match[0]] + '.png');
        } else {
            translatedElement = document.createElement('a');
            var url = match[0];
            translatedElement.textContent = url;
            if(!/^https?:\/\//.test(url))
                url = 'http://' + url;
            translatedElement.setAttribute('href', url);
        }
        container.appendChild(translatedElement);

        match = rx.exec(text);
    }
    container.appendChild(
        document.createTextNode(
            text.substring(start, text.length)));

    return container;
}

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

function cloneBlueprint(name) {
    return x('//*[@id="blueprints"]' +
             '//*[@class="' + name + '"]')
        .cloneNode(true);
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

function preloadSmileys() {
    for(var smileySymbol in smileyMap) 
        (new Image()).src = smileyMap[smileySymbol] + '.png';
}

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


// GUI INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init(event) {
    _('input').addEventListener(
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

    for each(id in ['topic', 'resources', 'groups']) {
        _(id).addEventListener(
            'DOMNodeInserted', function(event) {
                refresh(event.currentTarget);
            }, false);

        _(id).addEventListener(
            'DOMNodeRemoved', function(event) {
                refresh(event.currentTarget);
            }, false);
    }

    window.addEventListener(
        'resize', function(event) { resizedWindow(event); }, false);

    _('chat-output').addEventListener(
        'scroll', function(event) { scrolledWindow(event); }, false);

    preloadSmileys();
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
                M(domMessage).sender.textContent =
                    JID(stanza.@from == undefined ? userAddress : stanza.@from).username;
            
            M(domMessage).sender.setAttribute(
                'class', stanza.@from.toString() ? 'contact' : 'user');
            textToHTML(M(domMessage).content, stanza.body);
            M(domMessage).time.textContent =
                (stanza.@from == undefined ?
                 'Sent at ' : 'Received at ') + formatTime(new Date())
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

function refresh(element) {
    switch(element.getAttribute('id')) {
    case 'topic':
        (element.textContent ? visible : hidden)
            (element.parentNode);
        break;
    case 'resources':
    case 'groups':
        (element.getElementsByTagName('li').length > 0 ? visible : hidden)
            (element.parentNode);
        break;
    }
}

function updateAddress(address) {
    _('address').textContent = address;
}

function updateTitle(address) {
    document.title = address;
}

function updateResources(resource, availability) {
    if(!resource)
        return;
    
    var domResource = x('//*[@id="resources"]' +
                        '//*[text()="' + resource + '"]');
    
    if(domResource) {
        if(availability == 'unavailable')
            _('resources').removeChild(domResource);
    }
    else 
        if(availability != 'unavailable') {
            domResource = document.createElement('li');
            domResource.textContent = resource;
            _('resources').insertBefore(domResource, _('resources').firstChild);
        }
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function pressedKeyInChatInput(event) {
    if(event.keyCode == KeyEvent.DOM_VK_RETURN) {
        var chatInput = event.target;

        if(event.ctrlKey)
            chatInput.value += '\n';
        else {
            event.preventDefault();
            if(!wsRegexp.test(chatInput.value)) {
                send(chatInput.value);
                chatInput.value = '';
            }
        }
    }
}

function scrolledWindow(event) {
    wantBottom = isNearBottom(_('chat-output'));
}

function resizedWindow(event) {
    if(wantBottom || _('chat-output').scrollTop == 0)
        scrollToBottom(_('chat-output'), false);
}


// NETWORK ACTIONS
// ----------------------------------------------------------------------

/**
 * Builds a message having the given text as body and sends it out.
 *
 */

function send(messageBody) {
    var message = <message/>;
    if(contactResource) 
        message.@to = '/' + contactResource;
    message.body = <body>{messageBody}</body>;
    _('output').textContent = message.toXMLString();
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

    if(stanza.@from != undefined && !groupchat)
        contactResource = JID(stanza.@from).resource;
        
}

function seenPresence(stanza) {
    if(stanza.@from == undefined) {
        if(stanza.ns_muc::x.length() > 0)
            groupchat = true;
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
    
        updateAddress(JID(stanza.@from).address);
        updateResources(JID(stanza.@from).resource, stanza.@type);
        updateTitle(JID(stanza.@from).address);
    }
}

function seenIq(stanza) {
    if(stanza.ns_roster::query.length() > 0) {
        userAddress = JID(stanza.@to).address;
        if(stanza..ns_roster::item.length() > 0)
            updateAddress(stanza..ns_roster::item.@jid);
    }
}


