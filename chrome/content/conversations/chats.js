/*
 * Copyright 2008-2009 by Massimiliano Mirra
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

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var Cu = Components.utils;

var srvObserver = Cc["@mozilla.org/observer-service;1"]
    .getService(Ci.nsIObserverService);
var srvIO = Cc['@mozilla.org/network/io-service;1']
    .getService(Ci.nsIIOService);

Cu.import('resource://xmpp4moz/xmpp.jsm');
Cu.import('resource://xmpp4moz/namespaces.jsm');


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    $('#chats').addEventListener('load', loadedView, true);
    $('#chats').contentDocument.location.href =
        'chrome://sameplace/content/conversations/conversations.xul';
}

function loadedView() {
    // Handle the load event only once.
    $('#chats').removeEventListener('load', loadedView, true);

    $('#chats').contentWindow.$('#tabs').addEventListener('select', function(event) {
        var xulPanel = event.target.nextSibling.selectedPanel;
        $('#search').value = 'xmpp://' + xulPanel.getAttribute('account') + '/' + xulPanel.getAttribute('address');
    }, false);

    srvObserver.addObserver(uriObserver, 'xmpp-uri-invoked', false);
}


// FINALIZATION
// ----------------------------------------------------------------------

function finish() {
    srvObserver.removeObserver(uriObserver, 'xmpp-uri-invoked', false);
}


// REACTIONS
// ----------------------------------------------------------------------

var uriObserver = {
    observe: function(subject, topic, data) {
        try {
            var entity = XMPP.entity(subject);

            var foregroundEvent = document.createEvent('Event');
            foregroundEvent.initEvent('custom/foreground', true, false);
            frameElement.dispatchEvent(foregroundEvent);

            setTimeout(function() {
                $('#chats').contentWindow.selectedContact(decodeURIComponent(entity.account), entity.address);
            });

        } catch(e) {
            Cu.reportError(e)
        }
    }
};

function enteredSearchText(xulSearch) {
    // Wrap everything in a try() because the XBL that calls this
    // handler seems to swallow errors.
    try {
        var searchString = xulSearch.value.replace(/(^\s*|\s*$)/g, '');
        document.commandDispatcher.advanceFocus();

        srvIO.newChannel(searchString, null, null)
            .asyncOpen(null, null);
    } catch(e) {
        Cu.reportError(e);
    }
}



// ACTIONS
// ----------------------------------------------------------------------

