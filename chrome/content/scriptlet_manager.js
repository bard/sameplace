/*
  Copyright (C) 2007 by Massimiliano Mirra

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

// DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;


// STATE
// ----------------------------------------------------------------------

var scriptlets = {};
load('chrome://sameplace/contact/scriptlets.js', scriptlets);


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init(event) {
    scriptlets.init();
    scriptlets.forEach(
        function(scriptlet) {
            var xulScriptlet = $('#blueprints > .scriptlet')._.cloneNode(true);
            $(xulScriptlet).$('.name')._.value = scriptlet.info.name;
            $(xulScriptlet).$('.version')._.value = scriptlet.info.version;
            $(xulScriptlet).$('.description')._.value = scriptlet.info.description;
            $('#scriptlets')._.appendChild(xulScriptlet);
        });
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function select(name) {
}

function edit(name) {
    var scriptlet = loadScriptlet(name);
    _('source').value = scriptlet.currentSource;
    showEditArea();
}

function showEditArea() {
    _('edit-splitter').hidden = false;
    _('edit-area').collapsed = false;    
}

function hideEditArea() {
    _('edit-splitter').hidden = true;
    _('edit-area').collapsed = true;
}



// GUI REACTIONS
// ----------------------------------------------------------------------

function cancelledEdit() {
    hideEditArea();
}

function selectedScriptlet(xulScriptlets) {
    
}

function doOk() {

}

function doCancel() {

}


// GUI UTILITIES
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById(id);
}
