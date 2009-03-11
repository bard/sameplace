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
var Cu = Components.utils;
var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');
var srvWindowMediator = Cc['@mozilla.org/appshell/window-mediator;1']
    .getService(Ci.nsIWindowMediator);
var srvIO = Cc['@mozilla.org/network/io-service;1']
    .getService(Ci.nsIIOService);


// UTILITIES - GENERIC - NON-GUI
// ----------------------------------------------------------------------

function chromeToFileUrl(url) {
    return Cc['@mozilla.org/chrome/chrome-registry;1']
    .getService(Ci.nsIChromeRegistry)
    .convertChromeURL(
        Cc['@mozilla.org/network/io-service;1']
        .getService(Ci.nsIIOService)
        .newURI(url, null, null)).spec;
}

function getExtensionVersion(id) {
    return Cc['@mozilla.org/extensions/manager;1']
        .getService(Ci.nsIExtensionManager)
        .getItemForID(id).version;
}

function upgradeCheck(id, versionPref, actions, ignoreTrailingParts) {
    const pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService);

    function compareVersions(a, b) {
        return Cc['@mozilla.org/xpcom/version-comparator;1']
        .getService(Ci.nsIVersionComparator)
        .compare(a, b);
    }

    var curVersion = getExtensionVersion(id);
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
}

function hostAppIsMail() {
    return (Components.classes['@mozilla.org/xre/app-info;1']
            .getService(Components.interfaces.nsIXULAppInfo)
            .ID == '{3550f703-e582-4d05-9a08-453d09bdfdc6}');
}

function hostAppIsSongbird() {
    return (Components.classes['@mozilla.org/xre/app-info;1']
            .getService(Components.interfaces.nsIXULAppInfo)
            .ID == 'songbird@songbirdnest.com');
}


// UTILITIES - SPECIFIC - NON-GUI
// ----------------------------------------------------------------------

function getDefaultAppUrl() {
    var url = pref.getCharPref('defaultAppUrl');

    if(url == 'default') {
        if(hostAppIsMail())
            return 'chrome://sameplace/content/app/chat.xhtml';
        else
            return 'http://apps.sameplace.cc/chat/chat.xhtml';
    } else
        return url;
}

function getChatOverlayName() {
    var overlayName = pref.getCharPref('chatArea');
    if(overlayName)
        return overlayName;
    else if(hostAppIsMail())
        return 'messagepane';
    else if(hostAppIsSongbird())
        return 'external';
    else
        return 'sidebar';
}

function getChatWindow() {
    switch(getChatOverlayName()) {
    case 'sidebar':
        var enumWindows = srvWindowMediator.getEnumerator('');
        while(enumWindows.hasMoreElements()) {
            var window = enumWindows.getNext();
            var xulFrame = window.document.getElementById('sameplace-frame');
            if(xulFrame && xulFrame.contentDocument.location.href != 'about:blank')
                return xulFrame.contentDocument.getElementById('conversations').contentWindow;
        }
        break;
    case 'messagepane':
        var enumWindows = srvWindowMediator.getEnumerator('');
        while(enumWindows.hasMoreElements()) {
            var window = enumWindows.getNext();
            if(window.document.getElementById('sameplace-conversations'))
                return window.conversations;
        }
        
        break;
    case 'external':
        return Cc['@mozilla.org/appshell/window-mediator;1']
            .getService(Ci.nsIWindowMediator)
            .getMostRecentWindow('SamePlace:Conversations');
        break;
    }
}


// UTILITIES - GENERIC - GUI
// ----------------------------------------------------------------------

function openURL(spec) {
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
}

function setClass(xulElement, aClass, state) {
    if(state)
        addClass(xulElement, aClass);
    else
        removeClass(xulElement, aClass);
}

function toggleClass(xulElement, aClass) {
    if(hasClass(xulElement, aClass))
        removeClass(xulElement, aClass);
    else
        addClass(xulElement, aClass);
}

function hasClass(xulElement, aClass) {
    return xulElement.getAttribute('class').split(/\s+/).indexOf(aClass) != -1;
}

function addClass(xulElement, newClass) {
    var classes = xulElement.getAttribute('class').split(/\s+/);
    if(classes.indexOf(newClass) == -1)
        xulElement.setAttribute('class', classes.concat(newClass).join(' '));
}

function removeClass(xulElement, oldClass) {
    var classes = xulElement.getAttribute('class').split(/\s+/);
    var oldClassIndex = classes.indexOf(oldClass);
    if(oldClassIndex != -1) {
        classes.splice(oldClassIndex, 1);
        xulElement.setAttribute('class', classes.join(' '));
    }
}

function afterLoad(xulPanel, action) {
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
}

function modifyToolbarButtons(modifier) {
    var toolbar =
        document.getElementById('nav-bar') ||
        document.getElementById('mail-bar') ||
        document.getElementById('mail-bar2');

    if(!toolbar)
        return;

    if(toolbar.getAttribute('customizable') == 'true') {
        var newSet = modifier(toolbar.currentSet);
        if(!newSet)
            return;

        toolbar.currentSet = newSet;
        toolbar.setAttribute('currentset', toolbar.currentSet);
        toolbar.ownerDocument.persist(toolbar.id, 'currentset');
        try { BrowserToolboxCustomizeDone(true); } catch (e) {}
    }
}

function removeToolbarButton(buttonId) {
    modifyToolbarButtons(function(set) {
        if(set.indexOf(buttonId) != -1)
            return set.replace(buttonId, '');
    });
}

function addToolbarButton(buttonId) {
    modifyToolbarButtons(function(set) {
        if(set.indexOf(buttonId) == -1)
            return set.replace(/(urlbar-container|separator)/,
                               buttonId + ',$1');
    });
}


// UTILITIES - XMPP
// ----------------------------------------------------------------------

function getJoinPresence(account, address) {
    return XMPP.cache.first(XMPP.q()
                            .event('presence')
                            .account(account)
                            .direction('out')
                            .to(address)
                            .child(ns_muc, 'x'));
}


// UTILITIES - DEVELOPMENT
// ----------------------------------------------------------------------

function getStackTrace() {
    var frame = Components.stack.caller;
    var str = "<top>";

    while (frame) {
        str += '\n' + frame;
        frame = frame.caller;
    }

    return str;
}

