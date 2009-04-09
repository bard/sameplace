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


// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;

var xmpp = xmpp || {};
xmpp.ui = xmpp.ui || {};


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    var accountHint = window.arguments[0];
    var account = null;
    if(accountHint)
        if(XMPP.JID(accountHint).resource) {
            account = XMPP.accounts.get({jid: accountHint});
        } else {
            account = XMPP.accounts.get({address: accountHint});
        }
    else
        account = XMPP.accounts.filter(XMPP.isUp)[0] || XMPP.accounts.get(0);

    var address = window.arguments[1];

    xmpp.ui.refreshAccounts(_('xmpp-popup-accounts'));

    _('account').value = account.jid;
    _('address').value = address;
    _('address').select();

    refresh();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function doOk() {
    util.getChatWindow().selectedContact(v('account'), v('address'));
}

function doCancel() {
    return true;
}

function refresh() {
    _('main').getButton('accept').disabled = !(v('account') && v('address'));
}


// UTILITIES
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById(id);
}

function v(id) {
    return typeof(_(id).checked) == 'undefined' ? _(id).value : _(id).checked;
}
    
