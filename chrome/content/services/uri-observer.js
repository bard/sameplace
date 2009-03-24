/*
 * Copyright 2009 by Massimiliano Mirra
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

Cu.import('resource://xmpp4moz/xmpp.jsm');
Cu.import('resource://xmpp4moz/namespaces.jsm');
Cu.import('resource://xmpp4moz/log.jsm');

var srvObserver = Cc["@mozilla.org/observer-service;1"]
    .getService(Ci.nsIObserverService);


// STATE
// ----------------------------------------------------------------------


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init() {
    srvObserver.addObserver(uriObserver, 'xmpp-uri-invoked', false);
}

function finish() {
    srvObserver.removeObserver(uriObserver, 'xmpp-uri-invoked', false);
}


// REACTIONS
// ----------------------------------------------------------------------

var uriObserver = {
    observe: function(subject, topic, data) {
        try {
            var entity = XMPP.entity(subject);
            var account = decodeURIComponent(entity.account);
            var address = entity.address;

            if(entity.action == 'join')
                Cc['@mozilla.org/appshell/window-mediator;1']
                .getService(Ci.nsIWindowMediator)
                .getMostRecentWindow('')
                .openDialog('chrome://sameplace/content/dialogs/join_room.xul',
                            'sameplace-open-conversation', 'centerscreen',
                            null, address);

        } catch(e) {
            Cu.reportError(e)
        }
    }
};



