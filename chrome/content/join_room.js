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

    selectedAccount(_('account'));
    refresh();
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function selectedAccount(xulAccount) {
    refresh();
}

// GUI ACTIONS
// ----------------------------------------------------------------------

function doOk() {

    // These will control the process.  Later it will be decided
    // whether only the 'joining' step should be done, or also the
    // 'saving' step.  Either way, each time a step is done, we check
    // whether all have been done, and close the window if so.

    var steps = ['joining'];

    function shouldDo(step) {
        return steps.indexOf(step) != -1;
    }

    function done(step) {
        steps.splice(steps.indexOf(step), 1);
        if(steps.length == 0)
            window.close();
    }

    // If user said that bookmark should be saved, it could actually
    // mean two things:
    //
    //   1) create a new bookmark
    //   2) modify an existing bookmark
    //
    // If user said that bookmark should not be saved, it could
    // mean two things as well:
    //
    //   3) a bookmark existed, but user wants to remove it
    //   4) no bookmark existed, keep things as they are
    //
    // Below, we look at what the user wants and at the existing
    // bookmarks.  Either a <query/> element is produced which
    // satisfies cases 1), 2) or 3), or no <query/> is produced,
    // meaning we met case 4).

    var bookmarkQuery = null;
    var existingBookmark = getMUCBookmark(v('account'), v('address'));

    if(v('save')) {
        if(!existingBookmark ||                             // 1)
           (v('autojoin') != existingBookmark.@autojoin) || // 2)
           (v('nick') != existingBookmark.@nick))           // 2)
            bookmarkQuery = putMUCBookmark(
                <conference jid={v('address')} autojoin={v('autojoin')} nick={v('nick')}/>,
                getMUCBookmarks(v('account')));
    } else
        if(existingBookmark)                                // 3)
            bookmarkQuery = delMUCBookmark(v('address'),
                                           getMUCBookmarks(v('account')));

    if(bookmarkQuery)
        steps.push('saving');

    // Setup finished, interact with the server now.

    if(shouldDo('saving'))
        XMPP.send(v('account'),
                  <iq type="set">{bookmarkQuery}</iq>,
                  function(reply) { done('saving'); });
        
    _('output').selectedPanel = _('progress');

    XMPP.send(v('account'),
              <presence to={v('address') + '/' + v('nick')}>
              <x xmlns='http://jabber.org/protocol/muc'/>
              </presence>,
              function(reply) {
                  var ns_error = 'urn:ietf:params:xml:ns:xmpp-stanzas';
                  if(reply.stanza.@type == 'error') {
                      _('error').textContent =
                          (reply.stanza..ns_error::text.toString() ||
                           ('Error: (' + reply.stanza..error.@code + ')'));
                      _('output').selectedPanel = _('error');
                  } else
                      done('joining');                  
              });

    return false;
}

function doCancel() {
    return true;
}

function refresh() {
    _('main').getButton('accept').disabled = !(v('account') && v('address') && v('nick'));

    var bookmark = getMUCBookmark(v('account'), v('address'));
    if(bookmark != undefined) {
        _('save').checked = true;
        _('autojoin').checked = (bookmark.@autojoin == 'true');
        _('nick').value = bookmark.@nick;
    } else {
        _('save').checked = false;
        _('autojoin').checked = false;
        _('nick').value = XMPP.JID(v('account')).username;
    }
}


// UTILITIES
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById(id);
}

function v(id) {
    return typeof(_(id).checked) == 'undefined' ? _(id).value : _(id).checked;
}
