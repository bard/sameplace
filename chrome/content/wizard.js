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
const Cu = Components.utils;

const srvPrompt = Cc['@mozilla.org/embedcomp/prompt-service;1']
    .getService(Ci.nsIPromptService); 
const pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('xmpp.account.');

const ns_disco_items = 'http://jabber.org/protocol/disco#items';
const ns_register = 'jabber:iq:register';


// GLOBAL STATE
// ----------------------------------------------------------------------

var account;
var channel;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init() {
    getServerList(
        function(list) {
            var xulMenu = _('account-new.server-list').firstChild;
            for each(var item in list.ns_disco_items::item) {
                var xulServer = document.createElement('menuitem');
                xulServer.setAttribute('label', item.@jid)
                xulServer.setAttribute('value', item.@jid)
                xulMenu.appendChild(xulServer);
            }
        });
}

function finish() {
    channel.release();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function updatePageCurrentStatus() {

}

function updatePageAccountExisting(event) {
    function isValidAddress(address) {
        return address.match(/^[^@]+@[^@]+$/);
    }

    var address = _('account-existing.address').value;

    if(address) {
        var serverPart = address.split('@')[1];
        if(serverPart == 'gmail.com' || serverPart == 'googlemail.com') {
            _('account-existing.server-hostname').value = 'talk.google.com';
            _('account-existing.server-port').value = 443;
        } else 
            _('account-existing.server-hostname').value = serverPart || '';
    }

    _('wizard').canAdvance = address &&
        _('account-existing.server-hostname').value &&
        isValidAddress(address);
}

function updatePageAccountNew() {
    function isValidServer(name) {
        return name && name.match(/^[^@]+$/);
    };

    var server = _('account-new.server-' +
                   _('account-new.server-selection-mode').value).value;
    
    _('wizard').canAdvance = isValidServer(server);
    _('account-new.server-hostname').value = server;
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function shownPageAccountExisting() {
    updatePageAccountExisting();
}

function shownPageAccountNew() {
    updatePageAccountNew();
}

function shownPageAccountRegistration() {
    var channel = XMPP.createChannel();
    channel.on(
        {event: 'stream', direction: 'in'},
        function(stream) {
            _('account-registration.connect-success').hidden = false;
            _('account-registration.connect-progress').hidden = true;
        });

    _('account-registration.connect-progress').hidden = false;
    _('account-registration.connect-success').hidden = true;
    _('account-registration.success').hidden = true;
    _('account-registration.failure').hidden = true;
    _('wizard').canAdvance = false;
    
    var serverJid = _('account-new.server-' +
                      _('account-new.server-selection-mode').value).value;

    registerAccount(
        serverJid,
        _('account-new.server-hostname').value,
        _('account-new.server-port').value,
        _('account-new.server-security').value == 1,
        function(query) {
            channel.release();
            account.address = query.username + '@' + serverJid;
            if(_('account-new.password-remember').checked)
                account.password = query.password;
            _('account-registration.success').hidden = false;
            _('wizard').canAdvance = true;
        },
        function(errorDescription) {
            channel.release();
            _('account-registration.failure-reason').value = errorDescription;
            _('account-registration.failure').hidden = false;
        });
}

function shownPageFinish() {
    createAccount(account);
}

function changedServerSelectionMode(event) {
    switch(event.target.value) {
    case 'custom':
        _('account-new.server-custom').hidden = false;
        _('account-new.server-list').hidden = true;
        break;
    case 'list':
        _('account-new.server-custom').hidden = true;
        _('account-new.server-list').hidden = false;
        break;
    default:
        throw new Error('Unexpected. (' + event.target.value + ')');
    }
}

function advancedPageCurrentStatus() {
    account = {};

    switch(_('current-status').value) {
    case 'gmail':
        _('page-current-status').next = 'account-existing';
        _('page-account-existing').setAttribute(
            'description', 'Configuring an existing GTalk/GMail.com account.');
        _('account-existing.address').value = 'username@gmail.com';
        _('account-existing.server-hostname').value = 'talk.google.com';
        break;
    case 'other':
        _('page-current-status').next = 'account-existing';
        _('page-account-existing').setAttribute(
            'description', 'Configuring an existing Jabber account.');
        _('account-existing.address').value = 'username@server.org';
        _('account-existing.server-hostname').value = 'server.org';
        break;
    case 'none':
        _('page-current-status').next = 'account-new';
        break;
    default:
        throw new Error('Unexpected. (' + _('current-status').value + ')');
    }
}

function advancedPageAccountExisting() {
    account.address = _('account-existing.address').value;
    account.resource = _('account-existing.resource').value;
    if(_('account-existing.password-remember').checked)
        account.password = _('account-existing.password').value;
    account.autoLogin = _('account-existing.auto-login').checked;
    account.connectionHost = _('account-existing.server-hostname').value;
    account.connectionPort = _('account-existing.server-port').value;
    account.connectionSecurity = _('account-existing.server-security').value;
}

function advancedPageAccountNew() {
    account.resource = _('account-new.resource').value;
    account.autoLogin = _('account-new.auto-login').checked;
    account.connectionHost = _('account-new.server-hostname').value;
    account.connectionPort = _('account-new.server-port').value;
    account.connectionSecurity = _('account-new.server-security').value;
}

function advancedPageAccountRegistration() {
}

function advancedPageFinish() {
}


// ACTIONS
// ----------------------------------------------------------------------

function createAccount(account) {
    var fields = [
        'address', 'resource',
        'connectionHost', 'connectionPort', 'connectionSecurity'];
    
    for each(var field in fields)
        if(!account[field]) {
            srvPrompt.alert('Internal error: account not created.');
            return;
        }

    var key = (new Date()).getTime();

    pref.setCharPref(key + '.address', account.address);
    pref.setCharPref(key + '.resource', account.resource);
    if(account.password)
        pref.setCharPref(key + '.password', account.password);
    pref.setBoolPref(key + '.autoLogin', account.autoLogin);
    pref.setCharPref(key + '.connectionHost', account.connectionHost);
    pref.setIntPref(key + '.connectionPort', account.connectionPort);
    pref.setIntPref(key + '.connectionSecurity', account.connectionSecurity);    
}


// UTILITIES
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById(id);
}

function getServerList(continuation) {
    var url = 'http://www.jabber.org/servers.xml';
    var req = new XMLHttpRequest();

    req.onprogress = function(e) {};
    req.onload = function(e) {};
    req.onerror = function(e) {};
    req.onreadystatechange = function(e) {
        if(req.readyState == 4) 
            continuation(
                new XML(req.responseText));
    }

    req.open('GET', url, true);
    req.send(null);
}

function registerAccount(serverJid, serverHostname, serverPort, ssl,
                         successCallback, failureCallback) {
    var request = {
        confirm: false,
        query: undefined, 
        presets: {}
    };

    XMPP.open(
        serverJid, { host: serverHostname, port: serverPort, ssl: ssl },
        function() {
            XMPP.send(
                serverJid,
                <iq to={serverJid} type="get">
                <query xmlns="jabber:iq:register"/>
                </iq>,
                function(reply) {
                    request.query = reply.stanza.ns_register::query;

                    window.openDialog(
                        'chrome://xmpp4moz/content/ui/registration.xul',
                        'xmpp4moz-registration', 'modal,centerscreen',
                        request);
                    
                    if(request.confirm) {
                        var iq = <iq to={serverJid} type="set"/>;
                        iq.query = request.query;
                        XMPP.send(
                            serverJid, iq, function(reply) {
                                if(reply.stanza.@type == 'result') 
                                    successCallback(request.query);
                                else
                                    failureCallback(
                                        reply.stanza.error.*[0].name().localName.replace(/-/g, ' ') +
                                        ' (' + reply.stanza.error.@code + ')');
                                

                                XMPP.close(serverJid);
                            });
                        
                    } else {
                        XMPP.close(serverJid);
                    }
                });
        });
}
