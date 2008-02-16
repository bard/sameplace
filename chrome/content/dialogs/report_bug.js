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

    var errors = getErrors();

    var s = 
        'System information:\n\n' +
        '\t' + spString + '\n' +
        '\t' + x4mString + '\n' + 
        '\t' + osInfo + '\n' +
        '\t' + hostAppString + '\n' +
        '\n' +
        'Latest relevant errors from console:\n\n' +
        (errors != '' ? errors.replace(/^/gm, '\t') : '\tNone') +
        '\n'

    return s;
}

function doCopy() {
    Cc['@mozilla.org/widget/clipboardhelper;1']
        .getService(Ci.nsIClipboardHelper)
        .copyString(document.getElementById('debug-info').value);
    window.alert('Info has been copied to the clipboard.');
}
