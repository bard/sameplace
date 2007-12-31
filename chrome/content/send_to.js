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


function selectedContact(event) {
    var account = event.target.getAttribute('account');
    var address = event.target.getAttribute('address');
    var type = XMPP.isMUC(account, address) ? 'groupchat' : 'normal';

    var node = document.popupNode;
    var url, text;
    if(node.nodeName.toLowerCase() == 'a' && ('href' in node)) {
        url = node.href;
        text = node.textContent.replace(/^\s*/, '').replace(/\s*$/, '');
    } else {
        url = getBrowser().currentURI.spec;
        text = getBrowser().contentDocument.title;
    }

    XMPP.send(account,
              <message to={address} type={type}>
              <body>{url}</body>
              <html xmlns="http://jabber.org/protocol/xhtml-im">
              <body xmlns="http://www.w3.org/1999/xhtml">
              <a href={url}>{text || url}</a>
              </body>
              </html>
              <x xmlns="jabber:x:oob">
              <url>{url}</url>
              </x>
              </message>);
}

function showingPopup(event) {
    const ns_muc = 'http://jabber.org/protocol/muc';
    const ns_muc_user = 'http://jabber.org/protocol/muc#user';
    var xulMenupopup = event.target;

    function makeContactItem(account, address, label, show) {
        var xulMenuitem = document.createElement('menuitem');
        xulMenuitem.setAttribute('account', account);
        xulMenuitem.setAttribute('address', address);
        xulMenuitem.setAttribute('label', label);
        xulMenuitem.setAttribute('availability', 'available');
        xulMenuitem.setAttribute('show', show);
        xulMenuitem.setAttribute('class', 'menuitem-iconic xmpp-presence');
        
        return xulMenuitem;
    }

    // Contacts


    var contactItems = XMPP.cache.fetch({
        event     : 'presence',
        direction : 'in',
        stanza    : function(s) {
            return s.@type == undefined && s.ns_muc_user::x == undefined;
        }
    }).map(function(presence) {
        var address = XMPP.JID(presence.stanza.@from).address;
        return makeContactItem(presence.account,
                               address,
                               XMPP.nickFor(presence.account, address),
                               presence.stanza.show.toString());
    });

    var roomItems = XMPP.cache.fetch({
        event     : 'presence',
        direction : 'out',
        stanza    : function(s) {
            return s.ns_muc::x != undefined; // && s.@type == undefined ?
        }
    }).map(function(presence) {
        var address = XMPP.JID(presence.stanza.@to).address;
        return makeContactItem(presence.account,
                               address,
                               address);
    });

    contactItems.concat(roomItems).sort(function(xulItem1, xulItem2) {
        return (xulItem1.getAttribute('label').toLowerCase() >
                xulItem2.getAttribute('label').toLowerCase());
    }).forEach(function(xulItem) {
        xulMenupopup.appendChild(xulItem);
    });
}

function hiddenPopup(event) {
    var xulPopup = event.target;
    while(xulPopup.firstChild)
        xulPopup.removeChild(xulPopup.firstChild);
}
