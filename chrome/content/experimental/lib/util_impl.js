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

function hostAppIsMail() {
    return (Components.classes['@mozilla.org/xre/app-info;1']
            .getService(Components.interfaces.nsIXULAppInfo)
            .ID == '{3550f703-e582-4d05-9a08-453d09bdfdc6}');
}

// UTILITIES - SPECIFIC - NON-GUI
// ----------------------------------------------------------------------

function getDefaultAppUrl() {
    var url = pref.getCharPref('defaultAppUrl');
    if(/^chrome:\/\//.test(url) && !hostAppIsMail())
        // Thunderbird's content policy won't allow applications
        // served from file://.  For all others, we turn security up a
        // notch and convert chrome:// URLs to file://.
        return chromeToFileUrl(url);
    else
        return url;
}

function getChatOverlayName() {
    var overlayName =
        pref.getCharPref('chatArea') ||
        hostAppIsMail() ?
        'messagepane' :
        'sidebar';

    return overlayName;
}


// UTILITIES - GENERIC - GUI
// ----------------------------------------------------------------------

function openURL(url) {
    if(!url.match(/^((https?|ftp|file):\/\/|(xmpp|mailto):)/))
        return;
    
    function canLoadPages(w) {
        return (w && 
                typeof(w.getBrowser) == 'function' &&
                'addTab' in w.getBrowser());
    }

    var candidates = [
        top, 
        Cc['@mozilla.org/appshell/window-mediator;1']
            .getService(Ci.nsIWindowMediator)
            .getMostRecentWindow('navigator:browser')]
        .filter(canLoadPages);

    if(candidates.length > 0)
        candidates[0].getBrowser().selectedTab =
        candidates[0].getBrowser().addTab(url);
    else
        Cc['@mozilla.org/uriloader/external-protocol-service;1']
        .getService(Ci.nsIExternalProtocolService)
        .loadUrl(Cc['@mozilla.org/network/io-service;1']
                 .getService(Ci.nsIIOService)
                 .newURI(url, null, null));
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
