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


// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

var xmpp = xmpp || {};
xmpp.ui = xmpp.ui || {};


// GLOBAL STATE
// ----------------------------------------------------------------------

var request;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    request = window.arguments[0];
    _('address').select();

    xmpp.ui.refreshAccounts(_('xmpp-popup-accounts'));

    for each(var account in XMPP.accounts) {
        if(XMPP.isUp(account.jid)) {
            _('account').value = account.jid;
            break;
        }
    }

    refresh();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function doOk() {
    request.contactAddress = _('address').value;
    request.subscribeToPresence = _('subscribe').checked;
    request.account = _('account').value;
    request.confirm = true;
    return true;
}

function doCancel() {
    return true;
}


// GUI UTILITIES (GENERIC)
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById(id);
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function refresh() {
    if(_('account').value && _('address').value)
        _('main').getButton('accept').disabled = false;
    else
        _('main').getButton('accept').disabled = true;
}
