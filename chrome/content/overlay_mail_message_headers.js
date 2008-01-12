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


window.addEventListener(
    'load', function(event) {
        gMessageListeners.push({
            onStartHeaders: function() { sameplace.onStartHeaders(); },
            onEndHeaders:   function() { sameplace.onEndHeaders(); }
        });
    }, false);

sameplace.onStartHeaders = function() {
    var xulPresenceField = document.getElementById('expandedPresence');
    xulPresenceField.headerValue = null;
    xulPresenceField.collapsed = true;
}

sameplace.onEndHeaders = function() {
    const Cc = Components.classes;
    const Ci = Components.interfaces;

    function getCard(primaryEmail) {
        var uri = 'moz-abmdbdirectory://abook.mab';
        var addressBook = Cc['@mozilla.org/addressbook;1'].getService(Ci.nsIAddressBook);
        var abDatabase = addressBook.getAbDatabaseFromURI(uri);
        var rdf = Cc['@mozilla.org/rdf/rdf-service;1'].getService(Ci.nsIRDFService);
        var abDirectory = rdf.GetResource(uri).QueryInterface(Ci.nsIAbDirectory);
        return abDatabase.getCardFromAttribute(abDirectory, 'PrimaryEmail', primaryEmail, true);
    }

    var m = currentHeaderData.from.headerValue.match(/^([^ ]+)/)
    var mailAddress = m[1];
    var card = getCard(mailAddress);
    if(card && card.aimScreenName) {
        var jabberAddress = card.aimScreenName;
        var xulPresenceField = document.getElementById('expandedPresence');
        xulPresenceField.emailAddressNode.setAttribute('label', card.aimScreenName);
        xulPresenceField.collapsed = false;

        var presence =
            XMPP.cache.fetch({
                event     :'presence',
                direction : 'in',
                from      : { address: jabberAddress }})[0] ||
            { stanza: <presence from={jabberAddress} type="unavailable"/> };

        xulPresenceField.setAttribute('availability',
                                      presence.stanza.@type.toString() || 'available');
        xulPresenceField.setAttribute('show',
                                      presence.stanza.show.toString());
    }
}

window.addEventListener(
    'load', function(event) {
        // May I be forgiven for coercing <mail-emailheaderfield/>
        // into something it was never meant to be...

        var xulPresenceField = document.getElementById('expandedPresence');

        // Get rid of the popup menu.
        xulPresenceField.emailAddressNode.removeAttribute('context');
        xulPresenceField.emailAddressNode.removeAttribute('popup');

        // Without this, -moz-image-rect won't work.
        document.getAnonymousElementByAttribute(
            xulPresenceField.emailAddressNode,
            'anonid', 'emailImage')
        .style.MozPaddingStart = 0

        // Do something meaningful when jid is clicked.
        xulPresenceField.emailAddressNode.addEventListener(
            'click', function(event) {
                setTimeout(function() {
                    if(event.target.tagName == 'xul:label')
                        window.openDialog(
                            'chrome://sameplace/content/open_conversation.xul',
                            'sameplace-open-conversation', 'centerscreen', null, event.target.value);
                }, 0);
            }, false);
    }, false);


