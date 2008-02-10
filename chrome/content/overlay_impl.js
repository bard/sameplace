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
var scriptlets = load('chrome://sameplace/content/facades/scriptlets.js', {});
var sendTo = load('chrome://sameplace/content/send_to.js', {});
var util = load('chrome://sameplace/content/experimental/lib/util_impl.js', {});


// INITIALIZATION
// ----------------------------------------------------------------------

function init(event) {
    initNetworkReactions();
    initDisplayRules();
    initHotkeys();

    // Only preload SamePlace if there's no other window around with
    // an active SamePlace instance, and if this isn't a popup.'

    if(!isActiveSomewhere() && !isPopupWindow())
        loadAreas();

    util.upgradeCheck(
        'sameplace@hyperstruct.net',
        'extensions.sameplace.version', {
            onFirstInstall: function() {
                openURL('http://sameplace.cc/get-started');
                util.addToolbarButton('sameplace-button');
                setTimeout(function() {
                    runWizard();
                    checkNoScript();
                }, 2000);
            },
            onUpgrade: function() {
                util.removeToolbarButton('xmpp-button');
                util.addToolbarButton('sameplace-button');
                if(pref.getCharPref('branch') != 'devel')
                    openURL('http://sameplace.cc/changelog/' +
                            util.getExtensionVersion('sameplace@hyperstruct.net')
                            .split('.').slice(0,-1).join('.'));
            }
        }, 1);

    updateStatusIndicator();
    initScriptlets();
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
           hostsConversations())
            window.getAttention();
    });
}

function initHotkeys() {
    var toggleContactsKey = eval(pref.getCharPref('toggleContactsKey'))

    window.addEventListener('keypress', function(event) {
        if(matchKeyEvent(event, toggleContactsKey))
            toggle();
    }, true);

    pref.QueryInterface(Ci.nsIPrefBranch2)
    pref.addObserver('', {
        observe: function(subject, topic, data) {
            if(topic == 'nsPref:changed') {
                switch(data) {
                case 'toggleContactsKey':
                    toggleContactsKey = eval(pref.getCharPref('toggleContactsKey'));
                    break;
                }
            }
        }
    }, false);
}

function initScriptlets() {
    try {
        scriptlets.init(['sameplace', 'scriptlets'],
                        'extensions.sameplace.',
                        'chrome://sameplace/content/scriptlets/scriptlet_sample.js');
        scriptlets.start();
    } catch(e) {
        Cu.reportError(e);
    }
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function showingMainMenu(event) {
    var toggleContactsKey = eval(pref.getCharPref('toggleContactsKey'));
    var label = _('command-toggle').getAttribute('label');
    _('command-toggle').setAttribute(
        'label', label.replace(/\((.+?)\)/,
                               '(' + keyDescToKeyRepresentation(toggleContactsKey) + ')'));
}

function requestedInstallScriptlet(domElement) {
    if(!isJavaScriptLink(domElement))
        return;

    var scriptletManager = window.openDialog(
        'chrome://sameplace/content/scriptlets/scriptlet_manager.xul',
        'sameplace-scriptlet-manager', '',
        scriptlets);
    
    scriptletManager.addEventListener('load', function(event) {
        scriptletManager.removeEventListener(
            'load', arguments.callee, false);

        if(!scriptletManager.requestedInstallRemoteScriptlet(domElement.href))
            scriptletManager.close();
    }, false);
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function isReceivingInput() {
    // XXX temporary. only to accomodate activity scriptlet
    return false;
}

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

function checkNoScript() {
    var noScriptUpdateItem = Cc['@mozilla.org/extensions/manager;1']
        .getService(Ci.nsIExtensionManager)
        .getItemForID('{73a6fe31-595d-460b-a920-fcc0f8843232}');
    // In Firefox2, an updateItem is always returned, even for
    // non-installed apps, so we use the name test to check if
    // NoScript is installed for real.
    if(noScriptUpdateItem && noScriptUpdateItem.name != '')
        window.alert("Warning: you are using NoScript.  You'll be able to configure\nSamePlace, but chats will be blocked.\n\nTo fix this, remember to allow scripts from file:// URLs to run."); // localize
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

function matchKeyEvent(e1, e2) {
    return (e1.ctrlKey  == e2.ctrlKey &&
            e1.shiftKey == e2.shiftKey &&
            e1.altKey   == e2.altKey &&
            e1.metaKey  == e2.metaKey &&
            e1.charCode == e2.charCode &&
            e1.keyCode  == KeyEvent[e2.keyCodeName]);
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

// Duplicated from sameplace_preferences_impl.js

function keyDescToKeyRepresentation(desc) {
    var modifiers = {
        ctrlKey  : 'Control',
        shiftKey : 'Shift',
        altKey   : 'Alt',
        metaKey  : 'Meta'
    };

    var repres = [];
    
    for(var name in modifiers)
        if(desc[name])
            repres.push(modifiers[name]);

    if(desc.charCode)
        repres.push(String.fromCharCode(desc.charCode))
    else if(desc.keyCodeName)
        repres.push(desc.keyCodeName.replace(/^DOM_VK_/, ''))

    return repres.join('+');
}

function initDisplayRules() {
    // XXX probably to move to overlay_browser

    // What's a man to do to keep things decoupled...  What we're
    // doing here is basically "pop sidebar open when conversation
    // opens, but ONLY if conversation opened as a result of user
    // clicking on a contact", and the way we find out that is by
    // checking whether conversation opened within two seconds
    // from user clicking on the contact.
    
    var whenDidUserClickOnContact = 0;
    _('frame').addEventListener('contact/select', function(event) {
        if(!isCompact()) return;
        whenDidUserClickOnContact = Date.now();
    }, false);
    _('frame').addEventListener('conversation/open', function(event) {
        if(!isCompact()) return;
        if(Date.now() - whenDidUserClickOnContact < 2000)
            toExpanded();
    }, false);

    _('frame').addEventListener('detach', function(event) {
        var wndContacts = window.open(
            'chrome://sameplace/content/experimental/contacts.xul',
            'SamePlace:Contacts', 'chrome');
        wndContacts.addEventListener('unload', function(event) {
            if(event.target == wndContacts.document &&
               event.target.location.href != 'about:blank') {
                loadAreas();
                toCompact();
            }
        }, false);
        _('frame').contentDocument.location.href = 'about:blank';
        toCollapsed();
    }, false);
}

function findContact() {
    displayContacts();
    getContacts().requestedToggleFilter();
}

function loadAreas(force) {
    if(force || _('frame').contentDocument.location.href != 'chrome://sameplace/content/experimental/contacts.xul')
        _('frame').contentDocument.location.href = 'chrome://sameplace/content/experimental/contacts.xul';
}

function isActive() {
    return _('frame').contentDocument.location.href ==
        'chrome://sameplace/content/experimental/contacts.xul';
}

