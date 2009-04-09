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

var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.services.contacts.');


// STATE
// ----------------------------------------------------------------------

var counters;
var channel;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init() {
    try {
        counters = JSON.parse(pref.getCharPref('popularity'));
    } catch(e) {
        counters = {};
    }

    channel = XMPP.createChannel();

    channel.on(
        function(ev) (ev.name == 'message' &&
                      ev.dir == 'out' &&
                      (ev.xml.body != undefined ||
                       ev.xml.ns_xhtml_im::html.ns_xhtml::body != undefined)),
        function(m) sentChatMessage(m));
}

function finish() {
    channel.release();

    pref.setCharPref('popularity', JSON.stringify(counters));
}


// REACTIONS
// ----------------------------------------------------------------------

function sentChatMessage(m) {
    var address = XMPP.JID(m.stanza.@to).address;
    if(!(address in counters))
        counters[address] = 0;

    counters[address]++;
}


// API
// ----------------------------------------------------------------------

// TODO these should either work on account+address or name, not just
// address.  it's true that the same address identifies the same
// contact, but using just that would imply that the different
// addresses identify different contacts, and that's not necessarily
// true.  Using name would solve this (we assume that same name
// identifies same contact), however using account+address would allow
// us to track "preferred" concrete contacts for a given metacontact.

// However, what happens when account1+address is in the popular list,
// but other user logs in with just account2+address?  It should
// definitely be in the contact list...

function makeUnpopular(account, address) {
    counters[address] = false;
}

function makePopular(account, address) {
    counters[address] = true;
}

function isPopular(account, address) {
    var popularity = counters[address];
    return (popularity === true ||
            typeof(popularity) == 'number' && popularity > 50);
}