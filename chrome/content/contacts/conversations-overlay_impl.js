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

    $('#contacts').addEventListener('mouseover', function(event) {
        addClass($('#contacts-stack'), 'hovering-contacts');
    }, false);

    $('#conversations-box').addEventListener('mouseover', function(event) {
        removeClass($('#contacts-stack'), 'hovering-contacts');
    }, false);

    $('#conversations').addEventListener('click', clickedInConversation, false);

    $('#conversations').addEventListener('dragdrop', function(event) {
        nsDragAndDrop.drop(event, dropObserver);
    }, false);

    $('#conversations').addEventListener('dragover', function(event) {
        nsDragAndDrop.dragOver(event, dropObserver);
    }, false);

    channel = XMPP.createChannel();

    channel.on({
        event     : 'message',
        direction : 'out',
        stanza    : function(s) {
            return s.ns_chatstates::active != undefined;
        }
    }, sentChatActivation);

    $('#conversations').contentDocument.location.href = 'conversations.xul';
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

dropObserver.onDrop = function(event, dropdata, session) {
    if(dropdata.data != '')
        $('#conversations').contentWindow.simulateDrop(
            dropdata.data, dropdata.flavour.contentType);
};

function selectedContact(event) {
    $('#conversations').contentWindow
        .selectedContact(event.target.getAttribute('account'),
                         event.target.getAttribute('address'));

    addClass($('#conversations-box'), 'expanded');
    addClass($('#conversations').contentDocument.documentElement, 'expanded');
}

function openedConversation(event) {
    addClass($('#conversations-box'), 'expanded');
    addClass($('#conversations').contentDocument.documentElement, 'expanded');
}

function closedConversation(event) {
    if($('#conversations').contentWindow.getCount() == 0) {
        removeClass($('#conversations-box'), 'expanded');
        removeClass($('#conversations').contentDocument.documentElement, 'expanded');
    }
}

function clickedInConversation(event) {
    var htmlAnchor =
        event.target instanceof HTMLAnchorElement ?
        event.target :
        (event.target.parentNode instanceof HTMLAnchorElement ?
         event.target.parentNode : null);

    // XXX only recognizes <a href="...">link</a> and <a
    // href="..."><img/></a>.
    if(htmlAnchor)
        openURL(htmlAnchor.href);
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function sentChatActivation(message) {
    $('#conversations-box').collapsed = false;    
}