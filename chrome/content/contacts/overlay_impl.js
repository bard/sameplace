/*
 * Copyright 2006-2007 by Massimiliano Mirra
 * 
 * This file is part of xmpp4moz.
 * 
 * xmpp4moz is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 3 of the License, or (at your
 * option) any later version.
 * 
 * xmpp4moz is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
 *  
 */


// DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;

var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');

var xulBox, xulFrame;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    var exp = false;
    try { exp = pref.getBoolPref('experimental'); } catch(e) {}
    if(!exp)
        return;

    addToolbarButton('sameplace-button');

    xulFrame = document.getElementById('sameplace-frame');
    xulBox = document.getElementById('sameplace-box');

    xulFrame.contentDocument.location.href =
        'chrome://sameplace/content/contacts/contacts.xul';

    xulFrame.addEventListener('contact/select', function(event) {
        if(isCompact())
            expand();
    }, false);
}

function isCompact() {
    return xulBox.width == xulBox.getAttribute('minwidth');
}

function expand() {
    xulBox.width = xulBox.__restore_width;
}

function toggle() {
    if(xulBox.collapsed) {
        xulBox.collapsed = false;
        if(xulBox.__restore_width)
            expand();
    } else if(isCompact()) {
        xulBox.collapsed = true;
    } else {
        xulBox.__restore_width = xulBox.width;
        xulBox.width = xulBox.getAttribute('minwidth');
    }     
}

function addToolbarButton(buttonId) {
    var toolbar =
        document.getElementById('nav-bar') ||
        document.getElementById('mail-bar') ||
        document.getElementById('mail-bar2');

    if(!toolbar)
        return;

    if(toolbar &&
       toolbar.currentSet.indexOf(buttonId) == -1 &&
       toolbar.getAttribute('customizable') == 'true') {

        toolbar.currentSet = toolbar.currentSet.replace(
            /(urlbar-container|separator)/,
            buttonId + ',$1');
        toolbar.setAttribute('currentset', toolbar.currentSet);
        toolbar.ownerDocument.persist(toolbar.id, 'currentset');
        try { BrowserToolboxCustomizeDone(true); } catch (e) {}
    }
}
