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

var ns_http_auth  = 'http://jabber.org/protocol/http-auth';

var xulBox, xulFrame;


// STATE
// ----------------------------------------------------------------------

var channel;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    var exp = false;
    try { exp = pref.getBoolPref('experimental'); } catch(e) {}
    if(!exp)
        return;

    channel = XMPP.createChannel();
    channel.on({
        event     : 'message',
        direction : 'in',
        stanza    : function(s) {
            // Allow non-error messages with readable body [1] or
            // error messages in general [2] but not auth requests [3]
            return (((s.@type != 'error' && s.body.text() != undefined) || // [1]
                     (s.@type == 'error')) && // [2]
                    (s.ns_http_auth::confirm == undefined)) // [3]
        }
    }, function(message) {
        seenDisplayableMessage(message);
    });

    addToolbarButton('sameplace-button');

    xulFrame = document.getElementById('sameplace-frame');
    xulBox = document.getElementById('sameplace-box');

    xulFrame.contentDocument.location.href =
        'chrome://sameplace/content/experimental/contacts.xul';

    xulFrame.addEventListener('contact/select', function(event) {
        if(isCompact())
            expand();
    }, false);
}

function finish() {
    channel.release();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function getButton() {
    return document.getElementById('sameplace-button');
}

function isCompact() {
    return xulBox.width == xulBox.getAttribute('minwidth');
}

function isCollapsed() {
    return xulBox.collapsed;
}

function expand() {
    xulBox.width = xulBox.__restore_width;
}

function toggle() {
    if(xulBox.collapsed) {
        xulBox.collapsed = false;
        if(xulBox.__restore_width)
            expand();
        getButton().removeAttribute('pending-messages');
    } else if(isCompact()) {
        xulBox.collapsed = true;
    } else {
        xulBox.__restore_width = xulBox.width;
        xulBox.width = xulBox.getAttribute('minwidth');
        getButton().removeAttribute('pending-messages');
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


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function seenDisplayableMessage(message) {
    if(isCompact() || isCollapsed())
        getButton().setAttribute('pending-messages', 'true');
}