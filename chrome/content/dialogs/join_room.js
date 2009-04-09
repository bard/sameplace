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
const Cu = Components.utils;

var xmpp = xmpp || {};
xmpp.ui = xmpp.ui || {};

Cu.import('resource://sameplace/util.jsm');


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    var account = window.arguments[0];
    var address = window.arguments[1];

    xmpp.ui.refreshAccounts(_('xmpp-popup-accounts'));

    _('account').value = (account || (XMPP.accounts.filter(XMPP.isUp)[0] || XMPP.accounts[0]).jid);
    if(address) {
        _('name').value = XMPP.JID(address).username || '';
        _('server').value = XMPP.JID(address).hostname || '';
    }
    _('name').select();

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

function searchRooms() {
    util.openURL('http://search.wensley.org.uk/');
    window.close();
}

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
    _('address').value = _('name').value && _('server').value ?
        _('name').value + '@' + _('server').value :
        '';

    _('main').getButton('accept').disabled = !(v('account') && v('name') && v('server') && v('nick'));

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


// (MUC) BOOKMARK UTILITIES
// ----------------------------------------------------------------------

/**
 * Retrieves from cache bookmarks belonging to _account_.
 *
 */

function getMUCBookmarks(account) {
    var iq = XMPP.cache.fetch({
        event     : 'iq',
        direction : 'in',
        account   : account,
        stanza    : function(s) {
                return s.ns_private::query.ns_bookmarks::storage != undefined;
            }})[0];

    if(iq)
        return iq.stanza.ns_private::query.copy();
}

/**
 * Checks cache to see if MUC identified by _account_, _address_ is
 * bookmarked.
 *
 */

function isMUCBookmarked(account, address) {
    var query = getMUCBookmarks(account);
    var bookmark = query.ns_bookmarks::storage.ns_bookmarks::conference.(@jid == address);
    return bookmark != undefined;
}

/**
 * Retrieves from cache the bookmark for MUC identified by _account_
 * and _address_ (if any).
 *
 *
 */

function getMUCBookmark(account, address) {
    var query = getMUCBookmarks(account);
    if(query)
        return query.ns_bookmarks::storage.ns_bookmarks::conference.(@jid == address);
}

/**
 * Removes a MUC bookmark from a <query xmlns="jabber:iq:private"/>
 * element.  Doesn't modiy original query, return new one.
 *
 */

function delMUCBookmark(address, query) {
    query = query.copy();
    var bookmark = query.ns_bookmarks::storage.ns_bookmarks::conference.(@jid == address);
    if(bookmark != undefined)
        delete query.ns_bookmarks::storage.ns_bookmarks::conference[bookmark.childIndex()];
    return query;
}

/**
 * Puts a MUC bookmark into a <query xmlns="jabber:iq:private"/>
 * element, possibly replacing one with some address.  Doesn't modiy
 * original query, return new one.
 *
 */

function putMUCBookmark(bookmark, query) {
    query = delMUCBookmark(bookmark.@jid, query);
    query.ns_bookmarks::storage.appendChild(bookmark);
    return query;
}
