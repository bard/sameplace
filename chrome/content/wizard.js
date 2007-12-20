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
    var noScriptUpdateItem = Cc['@mozilla.org/extensions/manager;1']
        .getService(Ci.nsIExtensionManager)
        .getItemForID('{73a6fe31-595d-460b-a920-fcc0f8843232}');
    // In Firefox2, an updateItem is always returned, even for
    // non-installed apps, so we use the name test to check if
    // NoScript is installed for real.
    if(noScriptUpdateItem && noScriptUpdateItem.name != '')
        window.alert(_('strings').getString('noscriptAlert'));

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
    var password = _('account-existing.password').value;

    if(address) {
        var serverPart = address.split('@')[1];
        if(serverPart == 'gmail.com' || serverPart == 'googlemail.com') {
            _('account-existing.server-hostname').value = 'talk.google.com';
            _('account-existing.server-port').value = 443;
        } else {
            _('account-existing.server-hostname').value = serverPart || '';
            _('account-existing.server-port').value = 5223;
        }
    }

    _('account-existing.password-remember').checked = (password != '');
    
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

    registerAccount({
        address: _('account-new.field-username').value + '@' + serverJid,
        password: _('account-new.field-password').value,
        connectionHost: _('account-new.server-hostname').value,
        connectionPort: _('account-new.server-port').value,
        connectionSecurity: _('account-new.server-security').value,
    }, {
        onSuccess: function(query) {
            channel.release();
            account.address = query.ns_register::username + '@' + serverJid;
            if(_('account-new.password-remember').checked)
                account.password = query.ns_register::password;
            _('account-registration.success').hidden = false;
            _('wizard').canAdvance = true;
        },
        onFailure: function(errorDescription) {
            channel.release();
            _('account-registration.failure-reason').value = errorDescription;
            _('account-registration.failure').hidden = false;
        }
    });
}

function shownPageFinish() {
    _('wizard').canRewind = false;
    createAccount(account);
}

function finished() {
    if(_('connect-now').checked)
        XMPP.up(account.address + '/' + account.resource);
}

function changedServerSelectionMode(event) {
    switch(event.target.value) {
    case 'custom':
        _('account-new.server-custom').hidden = false;
        _('account-new.server-list').hidden = true;
        setTimeout(function() {_('account-new.server-custom').focus()}, 0);
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
            'description', _('strings').getString('existingAccount.gmail'));
        _('account-existing.address').value = 'username@gmail.com';
        _('account-existing.server-hostname').value = 'talk.google.com';
        break;
    case 'other':
        _('page-current-status').next = 'account-existing';
        _('page-account-existing').setAttribute(
            'description', _('strings').getString('existingAccount.jabber'));
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
            srvPrompt.alert(_('strings').getString('internalError.accountNotCreated'));
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

// XXX eliminate repetition from preferences_impl.js

function registerAccount(account, callbacks) {
    var username = XMPP.JID(account.address).username || '';
    var hostname = XMPP.JID(account.address).hostname;
    var password = account.password || '';
    var ssl = account.connectionSecurity == 1;
    var connectionHost = account.connectionHost;
    var connectionPort = account.connectionPort;

    function start() {
        openConnection();
    }

    function openConnection() {
        XMPP.open(hostname, {
            host: connectionHost,
            port: connectionPort,
            ssl: ssl
        }, askRequiredInfo);
    }

    function askRequiredInfo() {
        XMPP.send(hostname,
                  <iq to={hostname} type="get">
                  <query xmlns="jabber:iq:register"/>
                  </iq>,
                  getUserInfo);
    }

    function getUserInfo(reply) {
        var request = {
            confirm: false,
            query: undefined
        };

        request.query = reply.stanza.ns_register::query;
        if(request.query.ns_register::username.text() == undefined)
            request.query.ns_register::username = username;
        if(request.query.ns_register::password.text() == undefined)
            request.query.ns_register::password = password;

        // Only bring up registration requester if more
        // information is required.
        if(request.query.ns_register::username != undefined &&
           request.query.ns_register::password != undefined &&
           request.query.ns_register::instructions != undefined &&
           request.query.ns_register::*.length() == 3)
            request.confirm = true;
        else
            window.openDialog(
                'chrome://xmpp4moz/content/ui/registration.xul',
                'xmpp4moz-registration', 'modal,centerscreen',
                request);
        
        if(request.confirm)
            sendQuery(request.query);
        else
            XMPP.close(hostname);
    }

    function sendQuery(query) {
        var iq = <iq to={hostname} type="set">{query}</iq>;
        XMPP.send(hostname, iq, function(reply) {
            if(reply.stanza.@type == 'result')
                callbacks.onSuccess(reply.stanza.ns_register::query);
            else
                callbacks.onFailure(reply
                                    .stanza.error.*[0]
                                    .name().localName.replace(/-/g, ' ') +
                                    ' (' + reply.stanza.error.@code + ')');
            
            XMPP.close(hostname);
        });
    }

    start();
}
