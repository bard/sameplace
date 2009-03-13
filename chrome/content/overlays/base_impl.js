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
const pref = Cc['@mozilla.org/preferences-service;1']
.getService(Ci.nsIPrefService)
.getBranch('extensions.sameplace.');


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;
var util = load('chrome://sameplace/content/lib/util_impl.js', {});


// INITIALIZATION
// ----------------------------------------------------------------------

function init(event) {
    initNetworkReactions();

    switch(pref.getCharPref('openMode')) {
    case 'standalone':
        if(!getMostRecentWindow('SamePlace'))
            // Do not open SamePlace window if there is one around already.
            window.open('chrome://sameplace/content/standalone.xul', 'SamePlace', 'chrome');
        break;
    case 'sidebar':
        // Only preload SamePlace if there's no other window around with
        // an active SamePlace instance, and if this isn't a popup.'
        if(!isActiveSomewhere() && !isPopupWindow())
            loadAreas();
        break;
    default:
        throw new Error('Unknown open mode. (' + pref.getCharPref('mode') + ')');
    }

    util.upgradeCheck(
        'sameplace@hyperstruct.net',
        'extensions.sameplace.version', {
            onFirstInstall: function() {
                //openURL('http://sameplace.cc/get-started');
                toExpanded();
                //setTimeout(function() {
                //runWizard();
                //}, 2000);
            },
            onUpgrade: function() {
                if(pref.getCharPref('branch') != 'devel')
                    openURL('http://sameplace.cc/changelog/' +
                            util.getExtensionVersion('sameplace@hyperstruct.net')
                            .split('.').slice(0,-1).join('.'));
            }
        }, 1);

    if(pref.getBoolPref('addToolbarButton'))
        util.addToolbarButton('sameplace-button');

    updateStatusIndicator();

    var xulPanels = _('panels');
    xulPanels.addEventListener('custom/foreground', function(event) {
        for(let i=0, l=xulPanels.childNodes.length; i<l; i++)
            if(xulPanels.childNodes[i] == event.target)
                xulPanels.parentNode.selectedIndex = i;
    }, false);
}

function finish() {
    channel.release();
}

function initNetworkReactions() {
    channel = XMPP.createChannel();

    channel.on({
        event     : 'connector',
    }, function(connector) {
        switch(connector.state) {
        case 'disconnected':
        case 'active':
            updateStatusIndicator();
            break;
        }
    });

    channel.on({
        event     : 'message',
        direction : 'in',
        stanza    : function(s) { return s.@type == 'chat' && s.body.text() != undefined; }
    }, function(message) {
        if(window == getMostRecentWindow() &&
           pref.getBoolPref('getAttentionOnMessage') &&
           isActive())
            window.getAttention();
    });
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function runWizard() {
    window.openDialog(
        'chrome://sameplace/content/wizard/wizard.xul',
        'sameplace-wizard', 'chrome,modal,centerscreen,width=600,height=480');
}

function updateStatusIndicator() {
    if(!_('button'))
        return;

    _('button').setAttribute('availability',
                             XMPP.accounts.some(XMPP.isUp) ?
                             'available' : 'unavailable');
}

function loadAreas(force) {
    function loadPanel(xulContentPanel, urlSpec, force) {
        if((xulContentPanel.contentDocument.location.href != urlSpec) ||
           force)
           xulContentPanel.contentDocument.location.href = urlSpec;
    }

    loadPanel(_('dashboard'), 'chrome://sameplace/content/dashboard/dashboard.xul', force);
    loadPanel(_('chats'), 'chrome://sameplace/content/conversations/chats.xul', force);
    loadPanel(_('stream'), 'chrome://sameplace/content/stream/stream.xul', force);
}


// GUI UTILITIES
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById('sameplace-' + id);
}

function isJavaScriptLink(domElement) {
    return (('href' in domElement) &&
            domElement.href.match(/\.js$/));
}


// UTILITIES
// ----------------------------------------------------------------------

function openURL(url) {
    if(typeof(getBrowser().addTab) == 'function')
        // XXX bard: apparently needed otherwise it won't have any
        // effect when called from an onload handler
        setTimeout(function() {
            getBrowser().selectedTab = getBrowser().addTab(url)
        }, 500);
    else
        Cc['@mozilla.org/uriloader/external-protocol-service;1']
            .getService(Ci.nsIExternalProtocolService)
            .loadUrl(Cc['@mozilla.org/network/io-service;1']
                     .getService(Ci.nsIIOService)
                     .newURI(url, null, null));
}

function load(url, context) {
    var loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
        .getService(Ci.mozIJSSubScriptLoader);

    if(!context)
        // load everything in current context
        loader.loadSubScript(url);
    else if(arguments.length == 2) {
        // load everything in specified context and also return it
        loader.loadSubScript(url, context);
        return context;
    } else {
        // load some things in current or specified context
        context = context || this;
        var tmpContext = {};
        loader.loadSubScript(url, tmpContext);
        for each(var name in Array.slice(arguments, 2)) {
            this[name] = tmpContext[name];
        }
        return context;
    }
}

function getMostRecentWindow(type) {
    return Cc['@mozilla.org/appshell/window-mediator;1']
    .getService(Ci.nsIWindowMediator)
    .getMostRecentWindow(type);
}

function isActiveSomewhere() {
    var windows = Cc['@mozilla.org/appshell/window-mediator;1']
    .getService(Ci.nsIWindowMediator)
    .getEnumerator('');

    while(windows.hasMoreElements()) {
        var window = windows.getNext();
        if(window.sameplace && window.sameplace.isActive())
            return true;
    }
    return false;
}

function isPopupWindow() {
    return !window.toolbar.visible;
}

function isActive() {
    return _('dashboard').contentDocument.location.href != 'about:blank';
}
