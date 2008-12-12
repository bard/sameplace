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


// GUI REACTIONS
// ----------------------------------------------------------------------

function requestedChangeStatus(xulStatus) {
    var status = xulStatus.value;
    var account = $(xulStatus, '^ .account').value;
    changeStatus(account, status);
}

function changeStatus(account, status) {
    function previousPresenceStanza(account) {
        var p = XMPP.cache.fetch({
            event     : 'presence',
            account   : account,
            direction : 'out',
            stanza    : function(s) { return s.ns_muc::x == undefined; }
        })[0];

        return p ? p.stanza : null;
    }

    function updatePresence(stanza, status) {
        var newStanza = stanza.copy();

        delete newStanza.@type;

        switch(status) {
        case 'available':
            delete newStanza.show;
            break;
        case 'away':
            newStanza.show = <show>away</show>;
            break;
        case 'dnd':
            newStanza.show = <show>dnd</show>;
            break;
        }
        return newStanza;
    }

    if(account == 'all') {
        var accountsUp = XMPP.accounts.filter(XMPP.isUp);

        if(accountsUp.length == 0 && status != 'unavailable')
            XMPP.accounts.forEach(function(account) {
                changeStatus(account.jid, status);
            })
        else
            accountsUp.forEach(function(account) {
                changeStatus(account.jid, status);
            });
    } else {
        if(XMPP.isUp(account)) {
            if(status == 'unavailable')
                XMPP.down(account);
            else
                XMPP.send(account, updatePresence(
                    previousPresenceStanza(account) || <presence/>,
                    status));
        } else {
            if(status != 'unavailable') {
                XMPP.up(account, function() {
                    XMPP.send(account,
                              <iq type='get'>
                              <query xmlns='jabber:iq:roster'/>
                              </iq>,
                              function() {
                                  var newp = updatePresence(
                                      previousPresenceStanza(account) ||
                                          <presence/>,
                                      status);

                                  XMPP.send(account, newp);
                              })
                });
            }
        }
    }
}

// GUI ACTIONS
// ----------------------------------------------------------------------

function refreshAccounts(menuPopup) {
    function refreshAccounts1() {
        while(menuPopup.lastChild &&
              menuPopup.lastChild.nodeName != 'menuseparator')
            menuPopup.removeChild(menuPopup.lastChild);
        
        XMPP.accounts.forEach(function(account) {
            var accountPresence =
                XMPP.cache.fetch({
                    event     : 'presence',
                    direction : 'out',
                    account   : account.jid,
                    stanza    : function(s) { return s.ns_muc::x == undefined; }
                    })[0] ||
                { stanza: <presence type="unavailable"/> };

            var menu = document.createElement('menu');
            menu.setAttribute('class', 'menu-iconic account')
            menu.setAttribute('label', account.jid);
            menu.setAttribute('value', account.jid);
            menu.setAttribute('availability',
                              accountPresence.stanza.@type == undefined ?
                              'available' : 'unavailable');
            menu.setAttribute('show',
                              accountPresence.stanza.show.toString());
  
            menu.appendChild($('#blueprints > .status-menu').cloneNode(true));
            menuPopup.appendChild(menu);
        });
    }

    // When called from the event listener and adding menus with
    // sub-menus, will crash as soon as mouse hovers a menu (for someh
    // reason).  The following seems to workaround.
    window.setTimeout(refreshAccounts1, 0);
}
