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


// DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;

var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('xmpp.account.');


// STATE
// ----------------------------------------------------------------------

var accounts;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    window.sizeToContent()
    refresh();

    if(window.arguments && window.arguments[1]) {
        var account = window.arguments[1];
        if(typeof(account) != 'undefined') {
            var account = find(accounts, function(a) a.address == account);
            $('#accounts').selectedItem = $('#accounts .account[address="' + account.address + '"]');
            displayAccount(account);
        }
    }
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function refresh() {
    var xulAccounts = $('#accounts');
    while(xulAccounts.firstChild)
        xulAccounts.removeChild(xulAccounts.firstChild);

    accounts = XMPP.accounts.map(convertAccount).sort(function(a, b) {
        return a.username.toLowerCase() > b.username.toLowerCase();
    });
    accounts.forEach(addAccount);

    $('#action-pane').selectedIndex =
        $('#accounts').selectedIndex == -1 ? 0 : 1;
}

function getCurrentAccount() {
    var xulAccount = $('#accounts').selectedItem;
    if(xulAccount)
        return find(accounts, function(a) a.address == xulAccount.getAttribute('address'));
}

function addAccount(account) {
    var xulAccount = $('#blueprints > .account').cloneNode(true);
    xulAccount.setAttribute('address', account.address);
    xulAccount.setAttribute('service', account.service);
    xulAccount.setAttribute('category', account.category);
    xulAccount.setAttribute('type', account.type);
    $(xulAccount, '.username').setAttribute('value',
                                            account.connection == 'direct' ?
                                            account.username :
                                            XMPP.JID(account.connection).username);
    $(xulAccount, '.name').setAttribute('value', account.name);
    $(xulAccount, '.description').setAttribute('value', account.description);
    $('#accounts').appendChild(xulAccount);
}

function displayAccount(account) {
    $('#username').value = account.username || '';
    $('#password').value = account.password || '';
    $('#service').value = account.service;
    $('#resource').value = account.resource;
    $('#connection-host').value = account.connectionHost;
    $('#connection-port').value = account.connectionPort;
    $('#connection-security').value = account.connectionSecurity;
    $('#action-pane').selectedIndex = 1;
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function updatedField(xulField) {
    getCurrentAccount()[camelize(xulField.id)] = 
        ('checked' in xulField) ? xulField.checked : xulField.value;
}

function requestedDeleteAccount() {
    deleteAccount(getCurrentAccount().address);
}

function requestedAddAccount() {
    var wndWizard = window.openDialog(
        'chrome://sameplace/content/wizard/wizard.xul',
        'sameplace-wizard', 'chrome,centerscreen,width=600,height=480');
    wndWizard.addEventListener('unload', function() {
        refresh();
    }, false);
}

function selectedAccount(event) {
    var account = find(accounts, function(account) account.address == event.target.selectedItem.getAttribute('address'))
    displayAccount(account);
}


// OTHER ACTIONS
// ----------------------------------------------------------------------

function deleteAccount(accountId) {
    pref.deleteBranch(accountId + '.');
    refresh();
}


// UTILITIES
// ----------------------------------------------------------------------

function find(collection, condition) {
    for each(var member in collection) {
        if(condition(member))
            return member;
    }
    return null;
}

function convertAccount(source) {
    return {
        get id() {
            return source.key;
        },

        get service() {
            return XMPP.JID(source.address).hostname;
        },

        get username() {
            return XMPP.JID(source.address).username;
        },

        get password() {
            return source.password;
        },

        get connection() {
            return 'direct';
        },

        get name() {
            switch(XMPP.JID(source.address).hostname) {
            case 'sameplace.cc':
                return 'SamePlace';
                break;
            case 'gmail.com':
            case 'googlemail.com':
                return 'GTalk/GMail';
                break;
            default:
                return XMPP.JID(source.address).hostname;
            }
        },

        get description() {
            switch(this.category) {
            case 'server':
                switch(this.type) {
                case 'im':
                    return 'IM Server';
                    break;
                case 'x-turtle-twitter':
                    return 'Connector';
                    break;
                default:
                    return 'Undefined';
                }
                break;
            default:
                return 'Undefined';
            }
        },

        get category() {
            return 'server';
        },

        get type() {
            var m = XMPP.JID(source.address).hostname
                .match(/^([^.]+)\.x4m\.localhost$/);

            if(m)
                return 'x-turtle-' + m[1];
            else
                return 'im';
        },

        get jid() {
            return source.jid;
        },

        get connectionHost() {
            return source.connectionHost;
        },

        get connectionPort() {
            return source.connectionPort;
        },

        get connectionSecurity() {
            return source.connectionSecurity;
        },

        get resource() {
            return source.resource;
        },

        get address() {
            return source.address;
        },

        set address(val) {
            pref.setCharPref(this.id + '.address', val);
        },

        set resource(val) {
            pref.setCharPref(this.id + '.resource', val);
        },

        set password(val) {
            XMPP.setPassword(this.address, val);
        },

        set connectionHost(val) {
            pref.setCharPref(this.id + '.connectionHost', val);
        },

        set connectionPort(val) {
            pref.setIntPref(this.id + '.connectionPort', val);
        },

        set connectionSecurity(val) {
            pref.setIntPref(this.id + '.connectionSecurity', val);
        },

        set username(val) {
            this.address = val + '@' + this.service;
        },

        set service(val) {
            this.address = this.username + '@' + val;
        }
    };
}

function camelize(string) {
    var parts = string.split('-');
    return (parts[0] +
            parts.slice(1).map(function(part) {
                return part[0].toUpperCase() + part.slice(1);
            }).join());
}

// Future format:
//
// var accounts = {
//     '218732948': {
//         username: 'foobar',
//         service: 'sameplace.cc',
//         password: 'secret',
//         connection: 'direct',

//         name: 'SamePlace',
//         category: 'server',
//         type: 'im',
//         description: 'IM Server' // to be generated dynamically
//     },

//     '82394878': {
//         username: 'foobar',
//         service: 'gmail.com',
//         password: 'secret',
//         connection: 'direct',

//         name: 'GTalk',
//         category: 'server',
//         type: 'im',
//         description: 'IM Server'
//     },

//     '89789798': {
//         username: 'foobar',
//         service: 'twitter.x4m.localhost',
//         password: 'secret',
//         connection: 'direct',

//         name: 'Twitter',
//         category: 'server',
//         type: 'x-turtle-twitter',
//         description: 'Local Gateway'
//     },

//     '89283999': {
//         service: 'msn.sameplace.cc',
//         connection: 'foobar@sameplace.cc',

//         name: 'MSN',
//         description: 'Remote Gateway',
//         category: 'gateway',
//         type: 'msn'
//     },

//     '839247932': {
//         username: 'foobar',
//         service: 'jabber.org',
//         password: '',
//         connection: 'direct',

//         category: 'server',
//         type: 'im',
//         description: 'IM Server',
//         name: 'Jabber',
//     }
// };

