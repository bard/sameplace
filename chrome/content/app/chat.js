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

var textProcessors = [processURLs, processEmoticons];


// GLOBAL STATE
// ----------------------------------------------------------------------

var wantBottom = true;
var scrolling = false;
var isGroupchat = false;
var userAddress;
var contactResource;
var contactName;

XML.prettyPrinting = false;
XML.ignoreWhitespace = false;


// UTILITIES
// ----------------------------------------------------------------------

// This text processor is not really used, but shows how a text
// processor works.  It replaces all occurrences of "<name>.<ext>"
// with "<type>:<name>.<ext>".  For unrecognized extensions, it also
// highlights the text.
//
//    foo.c => source:FOO.C
//    bar.h => header:BAR.H
//    baz.i => <strong>unknown:baz.i</strong>

function processSample(xmlMessageBody) {
    var regexp = /foo\.(\w)/g;

    return xml.mapTextNodes(xmlMessageBody, function(textNode) {
        return text.mapMatch(
            textNode.toString(), regexp, function(wholeName, extension) {
                switch(extension) {
                case 'c':
                    return 'source:' + wholeName.toUpperCase();
                    break;
                case 'h':
                    return 'header:' + wholeName.toUpperCase();
                    break;
                default:
                    return <strong>unknown: {wholeName.toUpperCase()}</strong>
                }
            });
    });
}

function processURLs(xmlMessageBody) {
    var regexp = /(https?:\/\/|xmpp:|www\.)[^ \t\n\f\r"<>|()]*[^ \t\n\f\r"<>|,.!?(){}]/g;

    return xml.mapTextNodes(xmlMessageBody, function(textNode) {
        return text.mapMatch(
            textNode.toString(), regexp, function(url, protocol) {
                switch(protocol) {
                case 'http://':
                case 'https://':
                case 'xmpp:':
                    return <a href={url}>{url}</a>;
                    break;
                default:
                    return <a href={'http://' + url}>{url}</a>;
                }
            });
    });
}

function processEmoticons(xmlMessageBody) {
    function makeMatcher(listOfStrings) {
        return new RegExp(listOfStrings.map(escape).join('|'), 'g');
    }

    function escape(string) {
        return string.replace(/(\(|\)|\*|\|)/g, '\\$1');
    }

    function getKeys(object) {
        var keys = [];
        for(var key in object)
            keys.push(key);
        return keys;
    }

    var _ = arguments.callee;
    _.emoticons = _.emoticons || {
        '0:-)':  'angel',
        '0:)':   'angel',
        ':\'(':  'crying',
        '>:-)':  'devil-grin',
        '>:)':   'devil-grin',
        'B-)':   'glasses',
        'B)':    'glasses',
        ':-*':   'kiss',
        ':*':    'kiss',
        ':-(|)': 'monkey',
        ':(|)':  'monkey',
        ':-|':   'plain',
        ':-(':   'sad',
        ':(':    'sad',
        ':-))':  'smile-big',
        ':))':   'smile-big',
        ':-)':   'smile',
        ':)':    'smile',
        ':-D':   'grin',
        ':D':    'grin',
        ':-O':   'surprise',
        ':O':    'surprise',
        ';)':    'wink',
        ';-)':   'wink'
    };
    _.regexp = _.regexp || makeMatcher(getKeys(_.emoticons));

    return xml.mapTextNodes(xmlMessageBody, function(textNode) {
        return text.mapMatch(
            textNode.toString(), _.regexp,
            function(emoticonSymbol) {
                var url = 'emoticons/' + _.emoticons[emoticonSymbol] + '.png';
                return <img src={url} class="emoticon" alt={emoticonSymbol}/>;
            });
    });
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
    return undefined;
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

    behaviour.info(_('info'));
    behaviour.input(_('chat-input'));
    behaviour.palette(_('palette'));

    _('palette').addEventListener(
        'click', function(event) {
            _('chat-input').execCommand(
                'insertImage', event.target.getAttribute('src'));
        }, false);
        
    _('chat-output').addEventListener(
        'hsDrop', function(event) { droppedDataInConversation(event); }, false);

    _('chat-output').addEventListener(
        'scroll', function(event) { scrolledWindow(event); }, false);


    window.addEventListener(
        'resize', function(event) { resizedWindow(event); }, false);

    window.addEventListener(
        'focus', function(event) { _('chat-input').focus(); }, false);

    window.addEventListener(
        'blur', function(event) { _('chat-input').blur(); }, false);


    _('chat-input').editArea.addEventListener(
        'hsDrop', function(event) { droppedDataInInput(event)}, false);

    _('chat-input').addEventListener(
        'load', function(event) {
            _('chat-input').focus();
        }, false);

    _('chat-input').addEventListener(
        'accept', function(event) {
            sendXHTML(event.target.xhtml);
        }, false);
    
    _('chat-input').addEventListener(
        'resizing', function(event) {
            // XXX This should not be hardcoded.
            _('chat-output').style.bottom = event.target.clientHeight + 8 + 'px';
            _('lower-menus').style.bottom = event.target.clientHeight + 2 + 'px';
            repositionOutput();
        }, false);

    var composing = false;
    _('chat-input').addEventListener(
        'keyup', function(event) {
            if(isGroupchat)
                return;
            
            if(composing && event.target.isEmpty()) {
                composing = false;
                sendEvent('active');
            } else if(!composing && !event.target.isEmpty()) {
                composing = true;
                sendEvent('composing');
            }
        }, false);
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function repositionOutput() {
    if(wantBottom || _('chat-output').scrollTop == 0)
        scrollToBottom(_('chat-output'), false);    
}

function displayMessage(stanza) {
    const DATE_RX = /^(\d{4})(\d{2})(\d{2})T(\d{2}):(\d{2}):(\d{2})/;

    scrollingOnlyIfAtBottom(
        _('chat-output'), function() {
            var domMessage = $('#blueprints > .message').clone(true).get(0);

            var txtTimeSent =
                (stanza.ns_delay::x == undefined) ?
                new Date() :
                let([_full, year, month, day, hour, min, sec] =
                    stanza.ns_delay::x.@stamp.toString().match(DATE_RX))
                    new Date(Date.UTC(year, month, day, hour, min, sec));
            
            var txtSender =
                (stanza.@type == 'groupchat' ?
                 JID(stanza.@from).nick : (stanza.@from == undefined ?
                                           JID(userAddress).username : (contactName ||
                                                                        JID(stanza.@from).username ||
                                                                        stanza.@from).toString()))

            var senderStyle = (stanza.@type == 'groupchat' ?
                               {color: 'rgb(' + textToRGB(JID(stanza.@from).nick).join(',') + ')'} : {});
            
            $(domMessage)
            .addClass(stanza.@type != 'groupchat' ?
                      (stanza.@from == undefined ? 'user' : 'contact') : '')
            .find('.sender')
            .css(senderStyle)
            .text(txtSender)
            .end()
            .find('.time')
            .text(formatTime(txtTimeSent));
            
            // Without this, applyTextProcessors will add whitespace
            // and indentation.  Wo don't want that, especially with a
            // -moz-pre-wrap around the corner.
            XML.prettyPrinting = false;
            XML.ignoreWhitespace = false;
            var body;
            if(stanza.ns_xhtml_im::html == undefined) {
                body = filter.applyTextProcessors(stanza.body, textProcessors);
                body.setNamespace(ns_xhtml);
                $(domMessage).find('.content').css('white-space', '-moz-pre-wrap');
            } else
                body = filter.applyTextProcessors(
                    filter.xhtmlIM.keepRecommended(stanza.ns_xhtml_im::html.ns_xhtml::body),
                    textProcessors);
            
            copyDomContents(conv.toDOM(body), $(domMessage).find('.content').get(0));

            _('messages').appendChild(domMessage);
        });
}

function displayEvent(eventClass, text) {
    scrollingOnlyIfAtBottom(
        $('#chat-output').get(0), function() {
            $('#blueprints > .' + eventClass)
            .clone(true)
            .text(text)
            .appendTo('#messages');
        });
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function droppedDataInInput(event) {
    var data = new XML(_('dnd-sink').textContent);
    var contentType = data['@content-type'].toString();
    
    switch(contentType) {
    case 'text/unicode':
    case 'text/html':
        var m = data.match(/^(?:<a.*[^>]>)?<img.*src=(?:\"|\')([^\"\']+).*[^>]+>$/i);
        if(m)
            _('chat-input').execCommand('insertImage', m[1]);
        else
            _('chat-input').execCommand('insertHTML', data.toString());
        _('chat-input').focus();

        break;
    default:
        throw new Error('Unexpected. (' + contentType + ')');
    }
}

function droppedDataInConversation(event) {
    var data = new XML(_('dnd-sink').textContent);
    var contentType = data['@content-type'].toString();

    switch(contentType) {
    case 'text/unicode':
        sendText(data.toString());
        break;
    case 'text/html':
        _('html-conversion-area').contentDocument.body.innerHTML = data.toString();

        // Should not be needed, but apparently is.
        XML.ignoreWhitespace = false;
        XML.prettyPrinting = false;

        sendXHTML(conv.htmlDOMToXHTML(
                      _('html-conversion-area').contentDocument.body));
        break;
    default:
        throw new Error('Unexpected. (' + contentType + ')');
    }
}

function scrolledWindow(event) {
    wantBottom = isNearBottom(_('chat-output'));
}

function resizedWindow(event) {
    repositionOutput();
}

function requestedFormatCommand(event) {
    if(event.target.getAttribute('class') != 'command')
        return;

    _('chat-input').execCommand(event.target.getAttribute('id'), null);
    event.target.blur();
    _('chat-input').focus();
}


// NETWORK ACTIONS
// ----------------------------------------------------------------------

/**
 * Builds a message having the given text as body and sends it out.
 *
 */

function sendText(text) {
    var message =
        <message><x xmlns={ns_event}><composing/></x><active xmlns={ns_chatstates}/></message>;

    if(contactResource) 
        message.@to = '/' + contactResource;

    message.body = <body>{text}</body>;
    message.ns_xhtml_im::html.body =
        <body xmlns={ns_xhtml}>{text}</body>

    $('#xmpp-outgoing').text(message.toXMLString());
}

function sendXHTML(xhtmlBody) {
    var message =
        <message><x xmlns={ns_event}><composing/></x><active xmlns={ns_chatstates}/></message>;

    if(contactResource)
        message.@to = '/' + contactResource;

    // Should not be needed, but apparently is.
    XML.prettyPrinting = false;
    XML.ignoreWhitespace = false;
    message.body = <body>{filter.htmlEntitiesToCodes(
                              conv.xhtmlToText(
                                  xhtmlBody))}</body>;

    message.ns_xhtml_im::html.body =
        filter.xhtmlIM.keepRecommended(xhtmlBody);

    $('#xmpp-outgoing').text(message.toString());
}

function sendEvent(event) {
    var message;
    switch(event) {
    case 'composing':
        message = <message><x xmlns={ns_event}><composing/></x><composing xmlns={ns_chatstates}/></message>;

        break;
    case 'active':
        message = <message><x xmlns={ns_event}/><active xmlns={ns_chatstates}/></message>;
        
        break;
    }

    $('#xmpp-outgoing').text(message.toXMLString());
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function seenMessage(stanza) {
    // If message is an error, we can at least display an error code.
    // If message isn't an error and it hasn't a body, there's nothing
    // meaningful to display.
    if(stanza.@type != 'error' && stanza.body == undefined) 
        return;

    if(!userAddress)
        // at this point, userAddress should have been initialized,
        // but if for any reason it wasn't, we take care of it here.
        if(stanza.@from == undefined)
            // outgoing message, no information about who we are,
            // falling back
            userAddress = 'me@none';
        else
            // incoming message, infer from @to
            userAddress = JID(stanza.@to.toString()).address;
        
    if(stanza.@type == 'error')
        displayEvent('error', 'Error (' + stanza.error.@code + '): ' +
                     stanza.error.ns_stanzas::text.text());
    else {
        displayMessage(stanza);
        if(stanza.@from != undefined && !isGroupchat)
            contactResource = JID(stanza.@from).resource;
    }
}

function seenPresence(stanza) {
    if(stanza.@from == undefined) {
        if(stanza.ns_muc::x.length() > 0)
            isGroupchat = true;
    } else {
        if(stanza.ns_muc_user::x.length() > 0) {
            _('info').setMode('groupchat');

            if(stanza.@type == undefined &&
               !_('info').hasResource(JID(stanza.@from).resource)) 
                displayEvent('join', JID(stanza.@from).resource + ' entered the room');
            else if(stanza.@type == 'unavailable')
                displayEvent('leave', JID(stanza.@from).resource + ' left the room');
            else if(stanza.@type == 'error')
                displayEvent('error', 'Error: code ' + stanza.error.@code);
        } else
            if(JID(stanza.@from).resource == contactResource &&
               stanza.@type == 'unavailable')
                contactResource = undefined;
    
        _('info').updateAddress(JID(stanza.@from).address);
        _('info').updateResources(JID(stanza.@from).resource, stanza.@type);
        document.title = contactName || JID(stanza.@from).username || stanza.@from;
    }
}

function seenIq(stanza) {
    if(stanza.ns_roster::query.length() > 0) {
        userAddress = JID(stanza.@from.toString() || stanza.@to.toString()).address;
        
        if(stanza..ns_roster::item.length() > 0) {
            contactName = stanza..ns_roster::item.@name.toString();
            _('info').updateAddress(stanza..ns_roster::item.@jid);
        }
    }
}
