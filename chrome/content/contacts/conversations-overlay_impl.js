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


// STATE
// ----------------------------------------------------------------------

var channel;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init() {
    window.addEventListener('contact/select', selectedContact, false);
    window.addEventListener('conversation/close', closedConversation, false);
    
    $('#conversations').addEventListener('click', clickedInConversation, false);

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

function selectedContact(event) {
    $('#conversations').contentWindow
        .selectedContact(event.target.getAttribute('account'),
                         event.target.getAttribute('address'));

    $('#conversations').collapsed = false;
}

function closedConversation(event) {
    if($('#conversations').contentWindow.getCount() == 0)
        $('#conversations').collapsed = true;
}

function clickedInConversation(event) {
    if(event.target instanceof HTMLAnchorElement)
        // XXX won't recognize <a><img/></a> since target is img
        openURL(event.target.href);
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function sentChatActivation(message) {
    $('#conversations').collapsed = false;    
}