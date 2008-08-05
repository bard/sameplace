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


/**
 * An interface for managing scriptlets.
 *
 * At the moment, it does not load scriptlets by itself, instead it
 * expects a scriptlets object to be passed to from the opener (via
 * window.openDialog or windowWatcher.openWindow).
 *
 */

// DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;

var srvPrompt = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);


// STATE
// ----------------------------------------------------------------------

var scriptlets;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init(event) {
    scriptlets = window.arguments[0];
    refreshScriptlets();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function refreshScriptlets() {
    while($('#scriptlets')._.lastChild)
        $('#scriptlets')._.removeChild($('#scriptlets')._.lastChild)

    scriptlets.forEach(
        function(scriptlet) {
            var xulScriptlet = $('#blueprints > .scriptlet')._.cloneNode(true);
            updateScriptlet(xulScriptlet, scriptlet);
            $('#scriptlets')._.appendChild(xulScriptlet);
        });
}

function updateScriptlet(xulScriptlet, scriptlet) {
    $(xulScriptlet).$('.filename')._.setAttribute('value', scriptlet.fileName);
    try {
        $(xulScriptlet).$('.title')._.setAttribute('value',  scriptlet.info.name);
        $(xulScriptlet).$('.version')._.setAttribute('value', scriptlet.info.version);
        $(xulScriptlet).$('.description')._.setAttribute('value', scriptlet.info.description);
        $(xulScriptlet).$('.enabled')._.setAttribute('checked', scriptlet.enabled);
    } catch(e) {
        $(xulScriptlet).$('.title')._.setAttribute('value', scriptlet.fileName);
        $(xulScriptlet).$('.description')._.setAttribute('value', 'Error while reading.');
    }
}


// GUI REACTIONS
// ----------------------------------------------------------------------

var dndObserver = {
    onDrop: function(event, transferData, session) {
        if(transferData.flavour.contentType == 'text/x-moz-url') {
            var parts = transferData.data.split('\n');
            var url = parts[0];
            var name = parts[1];
            if(name.match(/\.js$/))
                requestedInstallRemoteScriptlet(url);
        }
    },

    onDragOver: function(event, flavour, session) {},

    getSupportedFlavours: function() {
        if(!this._flavourSet) {
            this._flavourSet = new FlavourSet();
            this._flavourSet.appendFlavour("text/x-moz-url");
            this._flavourSet.appendFlavour("application/x-moz-file", "nsIFile");
        }
        return this._flavourSet;
    }
};

function requestedToggleScriptletActivation(xulCheckbox) {
    var fileName = $(xulCheckbox).$('^ .scriptlet .filename')._.value;
    var scriptlet = scriptlets.get(fileName);
    if(scriptlet.enabled)
        scriptlet.disable();
    else
        scriptlet.enable();
}

function requestedInstallRemoteScriptlet(url) {
    if(isFromTrustedDomain(url) ||
       window.confirm(
           'Scriptlets are like extensions: malicious ones can harm your computer!\n' +
               'Only proceed if you trust the source.')) {
        installRemoteScriptlet(url);
        return true;
    }
    else
        return false;
}

function installRemoteScriptlet(url) {
    function start() {
        requestData(url,
                    let(parts = url.split('/'))
                        parts[parts.length-1]);
    }
    
    function requestData(url, name) {
        var req = new XMLHttpRequest();
        req.open('GET', url, true);
        req.onreadystatechange = function(event) {
            if(req.readyState == 4) {
                if(req.status == 200)
                    saveData(name, req.responseText);
                else
                    alertUser('Error loading scriptlet.');
            }
        };
        req.send(null);
    }

    function saveData(name, data) {
        try {
            var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
            file.initWithFile(scriptlets.dir);
            file.append(name);

            var foStream = Cc['@mozilla.org/network/file-output-stream;1']
            .createInstance(Ci.nsIFileOutputStream);

            foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);
            foStream.write(data, data.length);
            foStream.close();
            enableScriptlet(name);
        } catch(e) {
            alertUser('Error while saving file. (' + e + ')');
        }
    }

    function enableScriptlet(name) {
        try {
            scriptlets.get(name).enable();
            refreshScriptlets();
            $('#scriptlets')._.selectedItem =
                $('#scriptlets .filename[value="' + name + '"] ^ .scriptlet')._;
        } catch(e) {
            alertUser('Error while enabling scriptlet. (' + e + ')');
        }
    }

    function alertUser(message) {
        window.alert(message);
    }

    start();
}

function uninstall(xulUninstall) {
    scriptlets.get($(xulUninstall).$('^ .scriptlet .filename')._.value).uninstall();
    refreshScriptlets();
}

function reload(xulReload) {
    var xulScriptlet = $(xulReload).$('^ .scriptlet')._;
    var fileName = $(xulScriptlet).$('.filename')._.value;
    var scriptlet = scriptlets.get(fileName);
    try {
        scriptlet.reload();
    } catch(e) {
        window.alert(e + '\n' + e.stack);
    }
    updateScriptlet(xulScriptlet, scriptlet);
}


// GUI UTILITIES
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById(id);
}


// UTILITIES
// ----------------------------------------------------------------------

function isFromTrustedDomain(uri) {
    var xpcomURI = Cc['@mozilla.org/network/io-service;1']
    .getService(Ci.nsIIOService)
    .newURI(uri, null, null);

    return (xpcomURI.host.match(/(^|\.)sameplace\.cc$/) ||
            xpcomURI.host == 'repo.hyperstruct.net');
}
