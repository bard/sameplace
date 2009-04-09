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

var wndConversations;


// STATE
// ----------------------------------------------------------------------

//var channel;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init() {
    wndConversations = Cc['@mozilla.org/appshell/window-mediator;1']
        .getService(Ci.nsIWindowMediator)
        .getMostRecentWindow('SamePlace:Conversations');

    if(!wndConversations) {
        wndConversations = window.open(
            'chrome://sameplace/content/conversations/conversations.xul',
            'SamePlace:Conversations', 'chrome');

        wndConversations.addEventListener('load', function(event) {
            setTimeout(function() { wndConversations.hide(); });
        }, false);
    }

    window.addEventListener('contact/select', selectedContact, false);
}

function finish() {

}


// GUI REACTIONS
// ----------------------------------------------------------------------

function selectedContact(event) {
    wndConversations.selectedContact(
        event.target.getAttribute('account'),
        event.target.getAttribute('address'));
}

