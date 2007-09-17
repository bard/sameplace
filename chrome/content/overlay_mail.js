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



window.addEventListener('load', function(event) {
    var deck = document.getElementById('sameplace-conversations');
    var tabs = document.getElementById('sameplace-conversation-tabs');

    tabbedArea(deck, tabs);

    tabs.addEventListener('select', function(event) {
        if(tabs.selectedIndex == 0 && !deck.collapsed) {
            var savedHeight = deck.height;
            deck.collapsed = true;
            document.getElementById('messagepanebox').collapsed = false;
            document.getElementById('messagepanebox').height = savedHeight;
        }
        else if(tabs.selectedIndex > 0 && deck.collapsed){
            var savedHeight = document.getElementById('messagepanebox').boxObject.height;
            deck.collapsed = false;
            document.getElementById('messagepanebox').collapsed = true;
            deck.height = savedHeight;
        }

        if(tabs.selectedIndex == 0)
            tabs.setAttribute('mode', 'fake');
        else
            tabs.removeAttribute('mode');
    }, false);

    document.getElementById('messagepane').addEventListener('load', function(event) {
        tabs.selectedIndex = 0;
    }, true);

    tabs.addEventListener('DOMNodeInserted', function(event) {
        if(event.relatedNode == tabs && event.target.tagName == 'tab')
            event.target.setAttribute('class', 'im');
    }, false);

    var _getBrowserForTab = deck.getBrowserForTab;
    deck.getBrowserForTab = function(tab) {
        if(tab == tabs.firstChild)
            return this.firstChild;
        else
            return _getBrowserForTab.apply(this, arguments);
    };

    var _removeTab = deck.removeTab;
    deck.removeTab = function(tab) {
        // First tab is really just a placeholder for separate message
        // pane.
        if(tab == tabs.firstChild)
            return;
        else
            return _removeTab.apply(this, arguments);
    };

    tabs.addEventListener('DOMNodeRemoved', function(event) {
        if(event.relatedNode == tabs && event.target.tagName == 'tab')
            tabs.collapsed = (tabs.childNodes.length == 2);
    }, false);
}, false);
