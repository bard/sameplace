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


// EXPORTS
// ----------------------------------------------------------------------

var EXPORTED_SYMBOLS = [
    'util'
];


// DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var srvWindowMediator = Cc['@mozilla.org/appshell/window-mediator;1']
    .getService(Ci.nsIWindowMediator);
var srvIO = Cc['@mozilla.org/network/io-service;1']
    .getService(Ci.nsIIOService);
var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .QueryInterface(Ci.nsIPrefBranch);

Components.utils.import("resource://gre/modules/AddonManager.jsm");

Cu.import('resource://xmpp4moz/xmpp.jsm');

var util = {};


// UTILITIES - GENERIC - NON-GUI
// ----------------------------------------------------------------------

util.chromeToFileUrl = function(url) {
    return Cc['@mozilla.org/chrome/chrome-registry;1']
    .getService(Ci.nsIChromeRegistry)
    .convertChromeURL(
        Cc['@mozilla.org/network/io-service;1']
        .getService(Ci.nsIIOService)
        .newURI(url, null, null)).spec;
};

util.getExtensionVersion = function(id) {
/*   return Cc['@mozilla.org/extensions/manager;1']
        .getService(Ci.nsIExtensionManager)
        .getItemForID(id).version;
*/
try {
    // firefox >= 4
    Cu.import("resource://gre/modules/AddonManager.jsm");
    AddonManager.getAddonByID(id, function(addon) {
    // This is an asynchronous callback function that might not be called immediately
    return  addon.version;
});

}
catch (ex) {
       // firefox < 4
       return Cc['@mozilla.org/extensions/manager;1']
        .getService(Ci.nsIExtensionManager)
        .getItemForID(id).version;
}
};

util.upgradeCheck = function(id, versionPref, actions, ignoreTrailingParts) {
    function compareVersions(a, b) {
        return Cc['@mozilla.org/xpcom/version-comparator;1']
        .getService(Ci.nsIVersionComparator)
        .compare(a, b);
    }

    var curVersion = util.getExtensionVersion(id);
    if(curVersion) {
        var prevVersion = pref.getCharPref(versionPref);
        try {
            if(prevVersion == '') {
                if(typeof(actions.onFirstInstall) == 'function')
                    actions.onFirstInstall();
            } else {
                if(compareVersions(
                    (ignoreTrailingParts ?
                     curVersion.split('.').slice(0, -ignoreTrailingParts).join('.') :
                     curVersion),
                    prevVersion) > 0)
                    if(typeof(actions.onUpgrade) == 'function')
                        actions.onUpgrade();
            }
        } catch(e) {
            Cu.reportError(e);
        } finally {
            pref.setCharPref(versionPref, curVersion);
            // Flush prefs to disk, otherwise if app is killed and pref is
            // not saved, actions will be repeated on next startup.
            pref.savePrefFile(null);
        }
    }
};


// UTILITIES - GENERIC - GUI
// ----------------------------------------------------------------------

util.openURL = function(spec) { // XXX DUP
    var navigator =  Cc['@mozilla.org/appshell/window-mediator;1']
        .getService(Ci.nsIWindowMediator)
        .getMostRecentWindow('navigator:browser');

    if(spec.match(/^(https?|ftp|file):\/\//) &&
       navigator &&
       typeof(navigator.getBrowser) == 'function' &&
       'addTab' in navigator.getBrowser())
        navigator.getBrowser().selectedTab = navigator.getBrowser().addTab(spec);
    else if(spec.match(/^xmpp:/))
        srvIO.newChannel(spec, null, null)
        .asyncOpen(null, null);
    else
        Cc['@mozilla.org/uriloader/external-protocol-service;1']
        .getService(Ci.nsIExternalProtocolService)
        .loadUrl(Cc['@mozilla.org/network/io-service;1']
                 .getService(Ci.nsIIOService)
                 .newURI(spec, null, null));
};

util.setClass = function(xulElement, aClass, state) {
    if(state)
        addClass(xulElement, aClass);
    else
        removeClass(xulElement, aClass);
};

util.toggleClass = function(xulElement, aClass) {
    if(hasClass(xulElement, aClass))
        removeClass(xulElement, aClass);
    else
        addClass(xulElement, aClass);
};

util.hasClass = function(xulElement, aClass) {
    return xulElement.getAttribute('class').split(/\s+/).indexOf(aClass) != -1;
};

util.addClass = function(xulElement, newClass) {
    var classes = xulElement.getAttribute('class').split(/\s+/);
    if(classes.indexOf(newClass) == -1)
        xulElement.setAttribute('class', classes.concat(newClass).join(' '));
};

util.removeClass = function(xulElement, oldClass) {
    var classes = xulElement.getAttribute('class').split(/\s+/);
    var oldClassIndex = classes.indexOf(oldClass);
    if(oldClassIndex != -1) {
        classes.splice(oldClassIndex, 1);
        xulElement.setAttribute('class', classes.join(' '));
    }
};

util.afterLoad = function(xulPanel, action) { // XXX DUP; RM-CANDIDATE
    xulPanel.addEventListener(
        'load', function(event) {
            if(event.target != xulPanel.contentDocument)
                return;

            // The following appears not to work if reference to
            // xulPanel is not the one carried by event object.
            xulPanel = event.currentTarget;
            xulPanel.contentWindow.addEventListener(
                'load', function(event) {
                    action(xulPanel);
                }, false);

            xulPanel.removeEventListener('load', arguments.callee, true);
        }, true);
};

util.modifyToolbarButtons = function(toolbar, modifier) {
    if(toolbar.getAttribute('customizable') == 'true') {
        var newSet = modifier(toolbar.currentSet);
        if(!newSet)
            return;

        toolbar.currentSet = newSet;
        toolbar.setAttribute('currentset', toolbar.currentSet);
        toolbar.ownerDocument.persist(toolbar.id, 'currentset');
        try { BrowserToolboxCustomizeDone(true); } catch (e) {}
    }
};

util.removeToolbarButton = function(toolbar, buttonId) {
    util.modifyToolbarButtons(toolbar, function(set) {
        if(set.indexOf(buttonId) != -1)
            return set.replace(buttonId, '');
    });
};

util.addToolbarButton = function(toolbar, buttonId) {
    util.modifyToolbarButtons(toolbar, function(set) {
        if(set.indexOf(buttonId) == -1)
            return set.replace(/(urlbar-container|separator)/,
                               buttonId + ',$1');
    });
};


// UTILITIES - XMPP
// ----------------------------------------------------------------------

util.getJoinPresence = function(account, address) { // XXX GLOBAL; RM-CANDIDATE
    return XMPP.cache.first(XMPP.q()
                            .event('presence')
                            .account(account)
                            .direction('out')
                            .to(address)
                            .child(ns_muc, 'x'));
};

