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
const RDF = Cc["@mozilla.org/rdf/rdf-service;1"]
    .getService(Ci.nsIRDFService);    
const RDFCU = Cc["@mozilla.org/rdf/container-utils;1"]
    .getService(Ci.nsIRDFContainerUtils);
if(Cc['@mozilla.org/browser/bookmarks-service;1'])
    const BMSVC = Cc['@mozilla.org/browser/bookmarks-service;1']
        .getService(Ci.nsIBookmarksService);
const prefBranch = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');

var ns_auth = 'jabber:iq:auth';


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;


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
            if(prefBranch.getBoolPref('getAttentionOnMessage'))
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

    // No first run/upgrade action should be made if this is not the
    // stable branch but instead the testing
    // (sameplace-testing@hyperstruct.net) or other branches
    
    var version = getExtensionVersion('sameplace@hyperstruct.net');
    if(version) {
        if(prefBranch.getCharPref('version') == '' &&
           XMPP.accounts.length == 0) 
            runWizard();
        
        prefBranch.setCharPref('version', version);
    }

    // Hide splitter whenever sidebar is collapsed

    _('sidebar').addEventListener(
        'DOMAttrModified', function(event) {
            if(event.attrName == 'collapsed')
                _('sidebar-splitter').hidden = (event.newValue.toString() == 'true');
        }, false);
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function runWizard() {
    window.openDialog(
        'chrome://sameplace/content/wizard.xul',
        'sameplace-wizard', 'chrome')
}

function addBookmark() {
    var folderName = 'SamePlace';

    var dsBookmarks = Cc["@mozilla.org/rdf/datasource;1?name=bookmarks"]
        .getService(Ci.nsIRDFDataSource);

    var bookmark = dsBookmarks.GetSource(
        RDF.GetResource('http://home.netscape.com/NC-rdf#Name'),
        RDF.GetLiteral(folderName), true);

    if(!(bookmark && RDFCU.IsContainer(dsBookmarks, bookmark)))
        BMSVC.createFolderInContainer(
            folderName, RDF.GetResource('NC:BookmarksRoot'), null);
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
        if(window.sameplace.isActive())
            return true;
    }
    return false;
}
