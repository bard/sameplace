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

const Cc = Components.classes;
const Ci = Components.interfaces;

var xmpp = xmpp || {};
xmpp.ui = xmpp.ui || {};


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    var account = window.arguments[0];
    var address = window.arguments[1];
    
    xmpp.ui.refreshAccounts(_('xmpp-popup-accounts'));

    _('account').value = (account || (XMPP.accounts.filter(XMPP.isUp)[0] || XMPP.accounts[0]).jid);
    _('address').value = address;
    _('address').select();

    refresh();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function doOk() {
    XMPP.send(v('account'),
              <message to={v('address')}>
              <active xmlns={ns_chatstates}/>
              </message>);
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
    
