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


// DEFINITIONS
// ----------------------------------------------------------------------

var dropObserver = {};


// STATE
// ----------------------------------------------------------------------

var channel;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init() {
    window.addEventListener('contact/select', selectedContact, false);

    window.addEventListener('conversation/open', openedConversation, false);
    
    window.addEventListener('conversation/close', closedConversation, false);
    
    delayedMouseOver($('.scroll-arrow-down'), function() {
        util.addClass($('#contacts-stack'), 'attention-on-contacts');
    });

    delayedMouseOver($('.scroll-arrow-up'), function() {
        util.addClass($('#contacts-stack'), 'attention-on-contacts');
    });

    delayedMouseOver($('#conversations'), function() {
        util.removeClass($('#contacts-stack'), 'attention-on-contacts');
    });

    channel = XMPP.createChannel();

    channel.on({
        event     : 'message',
        direction : 'out',
        stanza    : function(s) {
            return s.ns_chatstates::active != undefined;
        }
    }, sentChatActivation);

    $('#conversations').contentDocument.location.href =
        'chrome://sameplace/content/experimental/conversations.xul';
}

function finish() {
    channel.release();
}


// GUI REACTIONS
// ----------------------------------------------------------------------

dropObserver.getSupportedFlavours = function() {
    var flavours = new FlavourSet();
    flavours.appendFlavour('text/html');
    flavours.appendFlavour('text/unicode');
    return flavours;
};

dropObserver.onDragOver = function(event, flavour, session) {};

dropObserver.onDragExit = function(event, session) {};

dropObserver.onDrop = function(event, dropdata, session) {
    if(dropdata.data != '')
        $('#conversations').contentWindow.simulateDrop(
            dropdata.data, dropdata.flavour.contentType);
};

function selectedContact(event) {
    $('#conversations').contentWindow
        .selectedContact(event.target.getAttribute('account'),
                         event.target.getAttribute('address'));

    util.addClass($('#conversations-area'), 'expanded');
}

function openedConversation(event) {
    util.addClass($('#conversations-area'), 'expanded');
}

function closedConversation(event) {
    if($('#conversations').contentWindow.getCount() == 1)
        util.removeClass($('#conversations-area'), 'expanded');
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function sentChatActivation(message) {
    util.addClass($('#conversations-area'), 'expanded');
}


// UTILITIES
// ----------------------------------------------------------------------

function delayedMouseOver(xulElement, listener, delay) {
    delay = delay || 750;

    var timeout;
    xulElement.addEventListener('mouseover', function(event) {
        if(event.target != xulElement)
            return;
        timeout = setTimeout(listener, delay);
    }, false);

    xulElement.addEventListener('mouseout', function(event) {
        if(event.target != xulElement)
            return;
        clearTimeout(timeout);
    }, false);
}
