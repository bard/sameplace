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


// CONFIGURATION
// ----------------------------------------------------------------------

var displayFilters = [processURLs, processEmoticons];
var outFilters = [commandFilter, formatFilter]


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
    $('#xmpp-incoming').bind('DOMNodeInserted', null, function(event) {
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
    });



    $('#chat-output').bind('hsDrop', null, function() {
        droppedDataInConversation(event);
    });

    $('#chat-output').scroll(function(event) {
        scrolledWindow(event); 
    });

    // When conversation window is at bottom and browser window gets
    // resized, conversation window loses position, so we re-set it.

    $(window).resize(function(event) {
        resizedWindow(event);
    });

    $(window).focus(function(event) {
        $('#chat-input').focus();
    });

    $(window).blur(function(event) {
        $('#chat-input').blur();
    });

    // Wiring chat input area
    
    $('#chat-input').bind('hsDrop', null, function(event) {
        droppedDataInInput(event);
    });

    $('#chat-input').bind('accept', null, function(event) {
        send(wrapAs(event.target.xhtml, 'application/xhtml+xml'));        
    });

    $('#chat-input').bind('resizing', null, function(event) {
        // XXX This should not be hardcoded.
        _('chat-output').style.bottom = event.target.clientHeight + 8 + 'px';
        _('lower-menus').style.bottom = event.target.clientHeight + 2 + 'px';
        repositionOutput();
    });

    var composing = false;
    $('#chat-input').keyup(function(event) {
        if(isGroupchat)
            return;
        
        if(composing && event.target.isEmpty()) {
            composing = false;
            send(chatEvent('active'));
        } else if(!composing && !event.target.isEmpty()) {
            composing = true;
            send(chatEvent('composing'));
        }
    });

    behaviour.input(_('chat-input'));


    // Wiring popups

    $('.popup').css('left', -$('.popup').width());

    $('.popup ul.resources').css('max-height', $(window).height()*0.3);
    $(window).resize(function() {
        $('.popup ul').css('max-height', $(window).height()*0.3);    
    });
    
    $('.popup .toggle').click(function(event) {
        var popup = $(this).parent('.popup');

        if(popup.offset().left == 16) {
            popup.removeClass('visible');
            popup.animate({opacity: 0.3, left: -popup.width()});
        } else {
            $('.popup.visible').each(function() {
                $(this).removeClass('visible');
                $(this).animate({opacity: 0.3, left: -$(this).width()});
            });

            popup.addClass('visible');
            popup.animate({opacity: 1, left: 16});
        }
    });
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function repositionOutput() {
    if(wantBottom || _('chat-output').scrollTop == 0)
        scrollToBottom(_('chat-output'), false);    
}

function displayMessage(stanza) {
    const DATE_RX = /^(\d{4})(\d{2})(\d{2})T(\d{2}):(\d{2}):(\d{2})/;

    var domMessage = $('#blueprints > .message').clone(true).get(0);
    
    var txtTimeSent =
        (stanza.ns_delay::x == undefined) ?
        new Date() :
        let([_full, year, month, day, hour, min, sec] =
            stanza.ns_delay::x.@stamp.toString().match(DATE_RX))
            new Date(Date.UTC(year, month, day, hour, min, sec));

    var sender;
    if(stanza.@type == 'groupchat' ||
      (stanza.@type == 'chat' && isGroupchat))
        sender = JID(stanza.@from).nick;
    else if(stanza.@from == undefined)
        sender = JID(userAddress).username;
    else
        sender = (contactName ||
                  JID(stanza.@from).username ||
                  stanza.@from).toString();
    
    var senderStyle = (stanza.@type == 'groupchat' ?
                       {color: 'rgb(' + textToRGB(JID(stanza.@from).nick).join(',') + ')'} : {});
    
    $(domMessage)
    .addClass(stanza.@type.toString() || 'normal')
    .addClass(stanza.@type != 'groupchat' ?
              (stanza.@from == undefined ? 'user' : 'contact') : '')
    .find('.sender')
    .css(senderStyle)
    .text(sender)
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
        body = filter.applyTextProcessors(stanza.body, displayFilters);
        body.setNamespace(ns_xhtml);
        $(domMessage).find('.content').css('white-space', '-moz-pre-wrap');
    } else
        body = filter.applyTextProcessors(
            filter.xhtmlIM.keepRecommended(stanza.ns_xhtml_im::html.ns_xhtml::body),
            displayFilters);
    
    copyDomContents(conv.toDOM(body), $(domMessage).find('.content').get(0));
    
    scrollingOnlyIfAtBottom($('#chat-output').get(0), function() {
        $('#messages').append(domMessage);
    });
}

function displayEvent(eventClass, text) {
    scrollingOnlyIfAtBottom($('#chat-output').get(0), function() {
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
    // dataPacket looks like:
    // <data content-type="text/html">&lt;img src="http://www.site.com/hello.png"&gt;</data>
    
    var dataPacket  = new XML(_('dnd-sink').textContent);
    var dataPayload = dataPacket.text().toString();
    var contentType = dataPacket['@content-type'].toString();

    switch(contentType) {
    case 'text/unicode':
        send(wrapAs(dataPayload, 'text/unicode'));
        break;
    case 'text/html':
        send(wrapAs(html2xhtml(dataPayload), 'application/xhtml+xml'));
        break;
    default:
        throw new Error('Unexpected. (' + contentType + ')');
    }
}

function scrolledWindow(event) {
    // Whenever conversation is scrolled, save here user's
    // "intention", so that if position changes as a side effect of
    // something (e.g. window resize) we can re-assert user's
    // intention.

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

function send(stanza) {
    // XXX behaviour when there is more than one out filter and one of
    // them returns null (or equivalent) is unspecified.
    outFilters.forEach(function(filter) { stanza = filter(stanza); });

    if(!stanza)
        return;
    
    $('#xmpp-outgoing').text(stanza.toXMLString());
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
        if(stanza.ns_muc::x != undefined) {
            isGroupchat = true;
            $('#chat-output').removeClass('chat').addClass('groupchat');
        }

        if(stanza.ns_muc::x != undefined)
            $('.popup .content.info')
            .find('.header-address').text('Room:')
            .end()
            .find('.header-resources').text('Participants:');            
    } else {
        
        $('.popup .content.info .address').text(JID(stanza.@from).address);
        var resource = JID(stanza.@from).resource;
        if(resource) {
            var resourceObj = $('.popup .content.info ul.resources li')
            .filter(function() { return $(this).text() == resource; });

            if(stanza.@type == 'unavailable') {
                resourceObj.remove();
                if(isGroupchat)
                    displayEvent('leave', JID(stanza.@from).resource + ' left the room');                    
            } else if(resourceObj.length > 0) {
                resourceObj.replace($('<li/>').text(resource))
            } else if(stanza.@type == 'error') {
                displayEvent('error', 'Error: code ' + stanza.error.@code);                
            } else {
                $('<li/>').text(resource).prependTo('.popup .content.info ul.resources');
                if(isGroupchat)
                    displayEvent('join', JID(stanza.@from).resource + ' entered the room');                    
            }
        }

        if(!isGroupchat)
            // Resource tracking
            if(JID(stanza.@from).resource == contactResource &&
               stanza.@type == 'unavailable')
                contactResource = undefined;
    
        document.title = contactName || JID(stanza.@from).username || stanza.@from;
    }
}

function seenIq(stanza) {
    if(stanza.ns_roster::query.length() > 0) {
        userAddress = JID(stanza.@from.toString() || stanza.@to.toString()).address;
        
        if(stanza..ns_roster::item.length() > 0) {
            contactName = stanza..ns_roster::item.@name.toString();
            $('.popup .content.info .header-contact').text(stanza..ns_roster::item.@jid);
        }
    }
}


// UTILITIES
// ----------------------------------------------------------------------

function wrapAs(data, contentType) {
    var message =
        <message><x xmlns={ns_event}><composing/></x><active xmlns={ns_chatstates}/></message>;
    if(contactResource)
        message.@to = '/' + contactResource;
    // Should not be needed, but apparently is.
    XML.prettyPrinting = false;
    XML.ignoreWhitespace = false;

    switch(contentType) {
    case 'text/unicode':
        message.body = <body>{data}</body>;
        message.ns_xhtml_im::html.body = <body xmlns={ns_xhtml}>{data}</body>
        break;
    case 'application/xhtml+xml':
        message.body = <body>{filter.htmlEntitiesToCodes(
            conv.xhtmlToText(data))}</body>;
        
        message.ns_xhtml_im::html.body = filter.xhtmlIM.keepRecommended(data);
        break;
    default:
        throw new Error('Unknown content type. (' + contentType + ')');
    }
    return message;
}

function chatEvent(eventName) {
    var message;
    switch(eventName) {
    case 'composing':
        message = <message><x xmlns={ns_event}><composing/></x><composing xmlns={ns_chatstates}/></message>;
        break;
    case 'active':
        message = <message><x xmlns={ns_event}/><active xmlns={ns_chatstates}/></message>;
        break;
    }
    return message;
}

// Uses a hidden iframe to parse HTML, then converts resulting DOM to
// an E4X object representing XHTML

function html2xhtml(htmlString) {
    _('html-conversion-area').contentDocument.body.innerHTML = htmlString;
    return conv.htmlDOMToXHTML(_('html-conversion-area').contentDocument.body);
}

jQuery.fn.replace = function() {
    var stack = [];
    return this.domManip(arguments, true, 1, function(a){
        this.parentNode.replaceChild( a, this );
        stack.push(a);
    }).pushStack( stack );
};

