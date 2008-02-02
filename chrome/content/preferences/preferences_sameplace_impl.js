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

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;

var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    window.sizeToContent();
    displayKey('contacts', eval(pref.getCharPref('toggleContactsKey')));
    _('experimental').checked = pref.getBoolPref('experimental');
}


// ACTIONS
// ----------------------------------------------------------------------

function captureKey(which) {
    document.addEventListener(
        'keypress', function(event) {
            try {
                capturedKey(which, keyEventToKeyDesc(event));
            } finally {
                document.removeEventListener(
                    'keypress', arguments.callee, false);
            }
        }, false);
}

function displayKey(which, desc) {
    _('toggle-' + which + '-key').value = keyDescToKeyRepresentation(desc);
}

function saveKey(which, desc) {
    function capitalize(s) {
        return s.substr(0, 1).toUpperCase() + s.substr(1);
    }
    pref.setCharPref('toggle' + capitalize(which) + 'Key', desc.toSource());
}


// REACTIONS
// ----------------------------------------------------------------------

function capturedKey(which, desc) {
    displayKey(which, desc);
    saveKey(which, desc);
}


// UTILITIES
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById('sameplace-' + id);''
}

function keyEventToKeyDesc(event) {
    var keyCodeMap = arguments.callee.keyCodeMap;
    if(!keyCodeMap) {
        keyCodeMap = (arguments.callee.keyCodeMap = {});
        for(var name in KeyEvent)
            if(name.match(/^DOM_VK_/))
                keyCodeMap[KeyEvent[name]] = name;
    }

    var desc = {};
    for each(var name in ['ctrlKey', 'metaKey', 'shiftKey', 'altKey', 'charCode'])
        desc[name] = event[name];

    if(event.keyCode)
        // Save the key code as name instead of number, in case it's
        // mapped differently on different platforms.
        desc.keyCodeName = keyCodeMap[event.keyCode];
    
    return desc;
}

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