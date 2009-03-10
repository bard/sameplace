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


// CONFIGURATION
// ----------------------------------------------------------------------

var displayFilters = [processURLs, processEmoticons];
var outFilters = [commandFilter];


// GLOBAL STATE
// ----------------------------------------------------------------------

var wantBottom = true;
var scrolling = false;
var isGroupchat = false;
var userAddress;
var contactResource;
var contactName;
var tooltipTimeout;
var separator = document.createElement("hr");


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
    $('#noscript-notice').hide();
    
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


    $('#dnd-sink').bind('hsDrop', null, function() {
        droppedDataInConversation(event);
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
        setTimeout(function(){ $('#chat-input').focus(); }, 0);
    });

    $(window).blur(function(event) {
        $('#chat-input').blur();
    });

    // Wiring chat input area
    
    $('#chat-input').bind('hsDrop', null, function(event) {
        droppedDataInInput(event);
    });

    $('#chat-input').bind('accept', null, function(event) {
        send(dataToMessage(event.target.xhtml, 'application/xhtml+xml'));        
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

    $('.popup').each(function(element) {
        $(this).css('right', -$('.popup').width());
    });

    $('.popup .toggle').click(function(event) {
        var popup = $(this).parent('.popup');
        if(popup.offset().left + popup.width() == $(window).width()) {
            popup.removeClass('visible');
            popup.animate({opacity: 0.3, right: -popup.width()});
        } else {
            popup.addClass('visible');
            popup.animate({opacity: 1, right: 0});
        }
    });

    // $(document.body).addClass(getPref('font-size') || 'normal');
}

window.addEventListener('DOMContentLoaded', init, false);


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

    var sender, color;
    if(stanza.@type == 'groupchat') {
        sender = JID(stanza.@from).nick;
        color = textToRGB(JID(stanza.@from).nick);
    }
    else if(stanza.@type == 'chat' && isGroupchat) {
        if(stanza.@from == undefined) {
            sender = '→ ' + JID(stanza.@to).nick;
            color = textToRGB(JID(stanza.@to).nick);
        } else {
            sender = JID(stanza.@from).nick;
            color = textToRGB(JID(stanza.@from).nick);
        }
    }
    else if(stanza.@from == undefined)
        sender = JID(userAddress).username;
    else
        sender = (contactName ||
                  JID(stanza.@from).username ||
                  stanza.@from).toString();
    
    $(domMessage)
        .addClass(stanza.@type.toString() || 'normal')
        .addClass(stanza.@type != 'groupchat' ?
                  (stanza.@from == undefined ? 'user' : 'contact') : '')
        .find('.sender')
        .css(color ? {color: 'rgb(' + color + ')'} : {})
        .text(sender)
        .end()
        .find('.time')
        .text(formatTime(txtTimeSent))
        .end();
    
    // Without this, applyTextProcessors will add whitespace
    // and indentation.  We don't want that, especially with a
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
        if(stanza.ns_delay::x.@from == "SamePlace/Internal") {$('#messages').append(separator);}
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

function hoveringMessage(htmlMessage) {
    tooltipTimeout = setTimeout(function() {
        $(htmlMessage).find('.time').show();
    }, 500);
}

function leftMessage(htmlMessage) {
    $(htmlMessage).find('.time').hide();
    clearTimeout(tooltipTimeout);
}

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

    send(dataToMessage(dataPayload, contentType));
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

function requestedChangeFontSize(event) {
    if(event.target.getAttribute('class') != 'command')
        return;

    var size = event.target.getAttribute('id');
    document.body.setAttribute('class', size);
    setPref('font-size', size);
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

    if(contactResource)
        stanza.@to = '/' + contactResource;
    
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
        displayEvent('error',
                     'Error' +
                     (stanza.error.@code != undefined ?
                      ' (' + stanza.error.@code + ') : ' : ': ') +
                     (stanza.error.ns_stanzas::text != undefined ?
                      stanza.error.ns_stanzas::text.text() :
                      stanza.body.text()));
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
                if(isGroupchat) {
                    if(stanza..ns_muc_user::status.@code == 303)
                        displayEvent('leave', JID(stanza.@from).resource +
                                     ' changed nickname to ' + stanza..ns_muc_user::item.@nick);
                    else
                        displayEvent('leave', JID(stanza.@from).resource + ' left the room');
                }
                    
            } else if(resourceObj.length > 0) {
                resourceObj.replace($('<li/>').text(resource))
            } else if(stanza.@type == 'error') {
                displayEvent('error', 'Error: code ' + stanza.error.@code);                
            } else {
                $('<li/>')
                    .attr('title', stanza..ns_muc_user::item.@jid.toString() || '')
                    .text(resource)
                    .prependTo('.popup .content.info ul.resources');
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

function dataToMessage(data, contentType) {
    // Should not be needed, but apparently is.
    XML.prettyPrinting = false;
    XML.ignoreWhitespace = false;

    var message =
        <message><x xmlns={ns_event}><composing/></x><active xmlns={ns_chatstates}/></message>;

    switch(contentType) {
    case 'text/unicode':
        message.body = <body>{data}</body>;
        message.ns_xhtml_im::html.body = <body xmlns={ns_xhtml}>{data}</body>
        break;
    case 'application/xhtml+xml':
        message.body = <body>{filter.htmlEntitiesToCodes(
            conv.xhtmlToText(data))}</body>;
        
        message.ns_xhtml_im::html.body = filter.xhtmlIM.keepRecommended(data);

        // work around
        // https://bugzilla.mozilla.org/show_bug.cgi?id=294674 and
        // protect from information leakage
        for each(anchor in message..ns_xhtml::a) {
            if(anchor.@href.match(/^chrome:\/\//))
                anchor.@href = '';
        }
        
        break;
    case 'text/html':
        message = dataToMessage(html2xhtml(data), 'application/xhtml+xml');
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

