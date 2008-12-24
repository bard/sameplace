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

var Cc = Components.classes;
var Ci = Components.interfaces;
var srvProxy = Cc['@mozilla.org/network/protocol-proxy-service;1']
    .getService(Ci.nsIProtocolProxyService);
var srvIO = Cc['@mozilla.org/network/io-service;1']
    .getService(Ci.nsIIOService);
var SECURITY_NONE     = 0;
var SECURITY_SSL      = 1;
var SECURITY_STARTTLS = 2;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    document.getElementById('debug-info').value = getInfo();
}


// UTILITIES
// ----------------------------------------------------------------------

function getErrors() {
    var srvConsole = Cc['@mozilla.org/consoleservice;1'].getService(Ci.nsIConsoleService);
    var out = {};
    srvConsole.getMessageArray(out, {});
    var messages = out.value || [];
    return messages
        .filter(function(m) {
            return m.message.match(/Error:.*\{file: \"chrome:\/\/(sameplace|xmpp4moz)/)
        })
        .map(function(m) {
            return m.message;
        })
        .join('\n');
}

function getInfo() {
    var srvExt =  Cc['@mozilla.org/extensions/manager;1']
        .getService(Ci.nsIExtensionManager);

    var hostApp = Cc["@mozilla.org/xre/app-info;1"]
        .getService(Ci.nsIXULAppInfo);
    var x4m = srvExt.getItemForID('xmpp4moz@hyperstruct.net');
    var sp = srvExt.getItemForID('sameplace@hyperstruct.net');

    var hostAppString =
        'Application: ' + hostApp.vendor + ' ' +
        hostApp.name + ' ' +
        hostApp.version + ' (' +
        hostApp.appBuildID + ')';

    var osInfo =
        'OS: ' + Cc["@mozilla.org/xre/app-info;1"]
        .getService(Ci.nsIXULRuntime).
        OS;

    var spString = 
        'SamePlace: ' + sp.version;

    var x4mString =
        'xmpp4moz: ' + x4m.version;

    var sysInfo = 
        'System:\n\n' +
        '\t' + spString + '\n' +
        '\t' + x4mString + '\n' + 
        '\t' + osInfo + '\n' +
        '\t' + hostAppString + '\n' +
        '\n';


    var errors = getErrors();

    var errorInfo =
        'Latest relevant errors from console:\n\n' +
        (errors != '' ? errors.replace(/^/gm, '\t') : '\tNone') +
        '\n'

    var securityDescEnum = ['cleartext', 'SSL', 'STARTTLS'];

    var accountInfo =
        'Accounts:\n\n';

    accountInfo += XMPP.accounts.map(function(account) {
        var proxyInfo =  srvProxy.resolve(
            srvIO.newURI((account.connectionSecurity == SECURITY_SSL ? 'https://' : 'http://') + account.connectionHost, null, null),
            Ci.nsIProtocolProxyService.RESOLVE_NON_BLOCKING);

        return '\t* [username hidden]@' +
            XMPP.JID(account.jid).hostname +
            '\n\t  via ' + account.connectionHost +
            ':' + account.connectionPort + '/' +
            securityDescEnum[account.connectionSecurity] +
            (proxyInfo ?
             ' with ' + proxyInfo.type + ' proxy ' + proxyInfo.host + ':' + proxyInfo.port :
             ' with no proxy')
    }).join('\n');

    accountInfo += '\n\n';

    return sysInfo + accountInfo + errorInfo;
}

function doCopy() {
    Cc['@mozilla.org/widget/clipboardhelper;1']
        .getService(Ci.nsIClipboardHelper)
        .copyString(document.getElementById('debug-info').value);
    window.alert('Info has been copied to the clipboard.');
}
