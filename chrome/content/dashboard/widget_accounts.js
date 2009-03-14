/*
 * Copyright 2008 by Massimiliano Mirra
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


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

window.addEventListener('dashboard/load', function(event) { accounts.init(); }, false)
window.addEventListener('dashboard/unload', function(event) { accounts.finish(); }, false)

var accounts = {};

accounts.init = function() {
    this._pref = Cc['@mozilla.org/preferences-service;1']
        .getService(Ci.nsIPrefService)
        .getBranch('xmpp.account.');

    this._channel = XMPP.createChannel();

    this._channel.on({
        event     : 'presence',
        direction : 'out',
        stanza    : function(s) {
            return (s.@type == undefined || s.@type == 'unavailable') &&
                s.ns_muc_user::x == undefined;
        }
    }, function(presence) {
        var xulAccount = $('#accounts .account[account="' + presence.account + '"]');
        xulAccount.setAttribute(
            'availability', presence.stanza.@type == undefined ?
                'available' : 'unavailable');
        xulAccount.setAttribute(
            'show', presence.stanza.show.toString());

        $(xulAccount, '> .state-indicator').setAttribute(
            'progress', 'false');
    });

    this._channel.on({
        event : 'connector',
    }, function(connector) {
        var xulAccount = $('#accounts .account[account="' + connector.account + '"]');
        var xulStatus = $(xulAccount, '> .state-indicator');
        switch(connector.state) {
        case 'disconnected':
        case 'error':
            xulStatus.setAttribute('progress', 'false');
            xulAccount.setAttribute('availability', 'unavailable');
            break;
        case 'connecting':
            xulStatus.setAttribute('progress', 'true');
            break;
        }
    });

    this.update();

    XMPP.accounts.on('change', function() accounts.update());
};

accounts.finish = function() {
    this._channel.release();
};

// ----------------------------------------------------------------------

accounts.update = function() {
    $('#widget-accounts-all-accounts').hidden = XMPP.accounts.length <= 1;

    do {
        var xulAccount = $('#accounts .account');
        if(xulAccount)
            $('#accounts').removeChild(xulAccount);
    } while(xulAccount);

    XMPP.accounts.forEach(function(account) {
        var accountPresence = XMPP.cache.first(
            XMPP.q()
                .event('presence')
                .account(account.jid)
                .direction('out')
                .xpath('[not(@to)]'));

        var xulAccount = $('#blueprints > .account').cloneNode(true);
        xulAccount.setAttribute('account', account.address);
        xulAccount.setAttribute('key', account.key); // XXX still necessary?
        $(xulAccount, '> .address').setAttribute('value', account.address);
        if(accountPresence) {
            xulAccount.setAttribute('availability',
                                    accountPresence.stanza.@type == undefined ?
                                    'available' : 'unavailable');
            xulAccount.setAttribute('show',
                                    accountPresence.stanza.show.toString());
        } else {
            xulAccount.setAttribute('availability', 'unavailable');
            xulAccount.setAttribute('show', '');
        }

        $('#accounts').appendChild(xulAccount);
    });
};

accounts.switchState = function(xulAccountDescendant) {
    var xulAccount = $(xulAccountDescendant, '^ [account]');
    var account = xulAccount.getAttribute('account');

    if(account == '*') {
        let onlineAccounts = XMPP.accounts.filter(XMPP.isUp);
        if(onlineAccounts.length > 0)
            onlineAccounts.forEach(XMPP.down);
        else
            // Not just forEach(XMPP.up) because that will pass more
            // than one argument to XMPP.up, and only the first
            // argument is what we want.
            XMPP.accounts.forEach(function(a) XMPP.up(a));
    } else {
        if(XMPP.isUp(account))
            XMPP.down(account);
        else
            XMPP.up(account);
    }
};

accounts.requestedStatusChange = function(xulAccountDescendant, xulStatus) {
    var jid = $(xulAccountDescendant, '^ [account]').getAttribute('account');
    if(jid == '*') {
        XMPP.accounts.filter(XMPP.isUp).forEach(function(account) {
            accounts.changeStatus(account.jid,
                                  xulStatus.getAttribute('availability'),
                                  xulStatus.getAttribute('show'));
        });
    } else
        this.changeStatus(jid,
                          xulStatus.getAttribute('availability'),
                          xulStatus.getAttribute('show'));
};

accounts.changeStatus = function(account, availability, show) {
    function previousPresenceStanza(account) {
        var p = XMPP.cache.fetch({
            event     : 'presence',
            account   : account,
            direction : 'out',
            stanza    : function(s) { return s.ns_muc::x == undefined; }
        })[0];

        return p ? p.stanza : null;
    }

    var newPresenceStanza = (previousPresenceStanza(account) || <presence/>).copy();
    if(show)
        newPresenceStanza.show = show;
    else
        delete newPresenceStanza.show;

    if(XMPP.isUp(account)) {
        if(availability == 'unavailable')
            XMPP.down(account);
        else
            XMPP.send(account, newPresenceStanza);
    } else {
        if(availability == 'unavailable')
            // We're offline and being requested to go
            // offline.  Do nothing.
            ;
        else
            XMPP.up(account);
    }
};

accounts.requestedRemove = function(xulAccountDescendant) {
    var account = $(xulAccountDescendant, '^ .account .address').getAttribute('value');
    var accountKey = $(xulAccountDescendant, '^ .account').getAttribute('key');
    if(window.confirm('This action will remove the account "' + account + '" from your computer, not from the server.\n' +
                      'You\'ll be able to reconfigure it later if you want.\n' +
                      'Continue?')) {
        XMPP.accounts.remove({key: accountKey});
        this.update();
    }
};

accounts.requestedEdit = function(xulAccountDescendant) {
    var accountKey = $(xulAccountDescendant, '^ .account').getAttribute('key');
    dashboard.openPreferences('accounts-pane', accountKey)
};

accounts.requestedAdd = function() {
    window.openDialog(
        'chrome://sameplace/content/wizard/wizard.xul',
        'sameplace-wizard', 'chrome,centerscreen,width=600,height=480');
};

accounts.showingPopup = function(popupNode, menuPopup) {

};