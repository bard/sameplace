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
const pref = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');

var ns_auth = 'jabber:iq:auth';


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;
var gToggleSidebarKey;


// GUI UTILITIES (SPECIFIC)
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById('sameplace-' + id);
}


// INITIALIZATION
// ----------------------------------------------------------------------

function initOverlay(event) {
    channel = XMPP.createChannel();

    channel.on(
        {event: 'transport', direction: 'out', state: 'start'},
        function() {
            if(window == getMostRecentWindow() && window.toolbar.visible)
               loadSidebar();
        });

    channel.on(
        {event: 'iq', direction: 'out', stanza: function(s) {
                return s.ns_auth::query.length() > 0;
            }},
        function() {
            if(window == getMostRecentWindow() && window.toolbar.visible)
               showSidebar();
        });

    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.@type == 'chat' && s.body.length() > 0;
            }},
        function(message) {
            if(pref.getBoolPref('getAttentionOnMessage'))
                window.getAttention();
        });

    // Only preload SamePlace if there's no other window around with
    // an active SamePlace instance, and if this isn't a popup.'

    if(!isActiveSomewhere() && window.toolbar.visible)
        loadSidebar();

    // If XMPP button is visible, attach to it.

    var button = document.getElementById('xmpp-button');
    if(button)
        button.addEventListener(
            'command', function(event) {
                if(event.target == button)
                    toggleSidebar();
            }, false);

    // Depending on entity of update, run wizard and/or show
    // changelog.

    upgradeCheck(
        'sameplace@hyperstruct.net',
        'extensions.sameplace.version', {
            onFirstInstall: function() {
                runWizard();
            }
        });
    
    // Hide splitter whenever sidebar is collapsed

    _('sidebar').addEventListener(
        'DOMAttrModified', function(event) {
            if(event.attrName == 'collapsed')
                _('sidebar-splitter').hidden = (event.newValue.toString() == 'true');
        }, false);


    // Listen to preference changes for sidebar toggle hotkey

    window.addEventListener(
        'keypress', function(event) { pressedKey(event); }, true)

    updateToggleSidebarKey(eval(pref.getCharPref('toggleSidebarKey')));
    pref.QueryInterface(Ci.nsIPrefBranch2)
    pref.addObserver('', {
        observe: function(subject, topic, data) {
            if(topic == 'nsPref:changed' && data == 'toggleSidebarKey')
                updateToggleSidebarKey(eval(pref.getCharPref('toggleSidebarKey')))
        }
    }, false)
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function pressedKey(event) {
    if(event.ctrlKey  == gToggleSidebarKey.ctrlKey &&
       event.shiftKey == gToggleSidebarKey.shiftKey &&
       event.altKey   == gToggleSidebarKey.altKey &&
       event.metaKey  == gToggleSidebarKey.metaKey &&
       event.charCode == gToggleSidebarKey.charCode &&
       event.keyCode  == KeyEvent[gToggleSidebarKey.keyCodeName])
        toggleSidebar();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function updateToggleSidebarKey(keyDesc) {
    gToggleSidebarKey = keyDesc;

    _('key-toggle-sidebar').removeAttribute('keycode');
    _('key-toggle-sidebar').removeAttribute('key');
    _('key-toggle-sidebar').removeAttribute('modifiers');
    if(keyDesc.keyCodeName)
        _('key-toggle-sidebar').setAttribute('keycode', keyDesc.keyCodeName.replace(/^DOM_/, ''));
    if(keyDesc.charCode)
        _('key-toggle-sidebar').setAttribute('key', String.fromCharCode(keyDesc.charCode));
    var modifiers = [];
    if(keyDesc.ctrlKey)
        modifiers.push('control');
    if(keyDesc.altKey)
        modifiers.push('alt');
    if(keyDesc.metaKey)
        modifiers.push('meta');
    if(keyDesc.shiftKey)
        modifiers.push('shift');
    _('key-toggle-sidebar').setAttribute('modifiers', modifiers.join(' '));
}
    
function runWizard() {
    window.openDialog(
        'chrome://sameplace/content/wizard.xul',
        'sameplace-wizard', 'chrome')
}

function loadSidebar(force) {
    if(force || getSidebarContent().location.href != 'chrome://sameplace/content/sameplace.xul') 
        getSidebarContent().location.href = 'chrome://sameplace/content/sameplace.xul';
}

function toggleSidebar() {
    if(_('sidebar').collapsed)
        showSidebar();
    else 
        hideSidebar();
}

function showSidebar() {
    loadSidebar();
    _('sidebar').collapsed = false;
}

function hideSidebar() {
    if(isReceivingInput()) {
        var contentArea = (document.getElementById('content') ||
                           document.getElementById('messagepane'));
        if(contentArea)
            contentArea.focus();
    }
    _('sidebar').collapsed = true;
}

function isReceivingInput() {
    // XXX this needs to be adjusted.  It shouldn't peek into the
    // sidebar context.

    return (document.commandDispatcher.focusedWindow ==
            getSidebarContent()._('conversations').contentWindow ||
            document.commandDispatcher.focusedWindow.parent ==
            getSidebarContent()._('conversations').contentWindow ||
            (document.commandDispatcher.focusedElement &&
             document.commandDispatcher.focusedElement == getSidebarContent().document))
}

function getSidebarContent() {
    return _('sidebar').firstChild.contentWindow;
}

function log(msg) {
    Cc[ "@mozilla.org/consoleservice;1" ]
        .getService(Ci.nsIConsoleService)
        .logStringMessage(msg);
}


// UTILITIES
// ----------------------------------------------------------------------

function getExtensionVersion(id) {
    return Cc["@mozilla.org/extensions/manager;1"]
        .getService(Ci.nsIExtensionManager)
        .getItemForID(id).version;
}

function getMostRecentWindow() {
    return Cc['@mozilla.org/appshell/window-mediator;1']
        .getService(Ci.nsIWindowMediator)
        .getMostRecentWindow('');
}

function isActive() {
    return getSidebarContent().document.location.href == 'chrome://sameplace/content/sameplace.xul';
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

function upgradeCheck(id, versionPref, actions, ignoreTrailingParts) {
    const pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService);

    function getExtensionVersion(id) {
        return Cc['@mozilla.org/extensions/manager;1']
        .getService(Ci.nsIExtensionManager)
        .getItemForID(id).version;
    }

    function compareVersions(a, b) {
        return Cc['@mozilla.org/xpcom/version-comparator;1']
        .getService(Ci.nsIVersionComparator)
        .compare(a, b);
    }

    var curVersion = getExtensionVersion(id);
    if(curVersion) {
        var prevVersion = pref.getCharPref(versionPref);
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

        pref.setCharPref(versionPref, curVersion);
    }
}
