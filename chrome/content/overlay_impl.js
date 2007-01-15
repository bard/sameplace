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
        {event: 'iq', direction: 'out', stanza: function(s) {
                return s.ns_auth::query.length() > 0;
            }},
        function(iq) {
            if(window == Cc["@mozilla.org/appshell/window-mediator;1"]
               .getService(Ci.nsIWindowMediator)
               .getMostRecentWindow('navigator:browser'))
                loadSidebar();
        });

    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.@type == 'chat';
            }},
        function(message) {
            if(prefBranch.getBoolPref('getAttentionOnMessage'))
                window.getAttention();
        });

    var button = document.getElementById('xmpp-button');
    button.addEventListener(
        'command', function(event) {
            if(event.target == button)
                toggleSidebar();
        }, false);

    setTimeout(function() { addBookmark(); }, 250);

    var version = getExtensionVersion('sameplace@hyperstruct.net');

    // No first run/upgrade action should be made if this is not the
    // stable branch but instead the testing
    // (sameplace-testing@hyperstruct.net) or other branches
    
    if(version) {
        if(prefBranch.getCharPref('version') == '' &&
           XMPP.accounts.length == 0) 
            runWizard();
        
        prefBranch.setCharPref('version', version);
    }
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
    var frame = _('sidebar').firstChild.contentWindow;

    if(force || frame.location.href != 'chrome://sameplace/content/sameplace.xul') 
        frame.location.href = 'chrome://sameplace/content/sameplace.xul';

    showSidebar();
}

function toggleSidebar() {
    if(_('sidebar').collapsed)
        showSidebar(true);
    else 
        hideSidebar();
}

function showSidebar(load) {
    if(load) {
        var frame = _('sidebar').firstChild.contentWindow;
        if(frame.location.href != 'chrome://sameplace/content/sameplace.xul') 
            frame.location.href = 'chrome://sameplace/content/sameplace.xul';
    }
        
    _('sidebar').collapsed = false;
    _('sidebar-splitter').hidden = false;
}

function hideSidebar() {
    _('sidebar').collapsed = true;
    _('sidebar-splitter').hidden = true;    
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
        .QueryInterface(Ci.nsIExtensionManager_MOZILLA_1_8_BRANCH)
        .getItemForID(id).version;
}
