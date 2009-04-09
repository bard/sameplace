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


// DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;
var srvWindowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1']
    .getService(Ci.nsIWindowWatcher);
var srvWindowMediator = Cc['@mozilla.org/appshell/window-mediator;1']
    .getService(Ci.nsIWindowMediator);


// STATE
// ----------------------------------------------------------------------

var savedDim;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

window.addEventListener('unload', function(event) {
    finish();
}, false);

window.addEventListener('DOMContentLoaded', function(event) {
    // From outside (e.g. selectedContact() in
    // conversations_overlay_external_impl.js), other events will be
    // attached to 'load', but we need to get stuff done before they
    // have a chance to run, so we listen on DOMContentLoaded, which
    // fires before load.
    if(event.target != document)
        return;

    // Make getPanels() + getTabs() into a sort-of <tabbrowser>
    // and kick-off initialization
    tabbedArea($('#deck'), $('#tabs'));

    // Initialize implementation (found in conversations_impl.js).
    init($('#deck'), $('#tabs'));

    if(window.isStandAlone()) {
        // This must come after initialization, or channel won't be there.
        channel.on(
            function(ev) (ev.name == 'message' &&
                          ev.dir == 'in' &&
                          ev.xml.body != undefined),
            function(message) {
                popUp();
            });

        srvWindowWatcher.registerNotification(windowObserver);
    }
}, false);


// GUI ACTIONS
// ----------------------------------------------------------------------

function isStandAlone() {
    return window == top;
}


// DEVELOPER UTILITIES
// ----------------------------------------------------------------------

function d(msg) {
    dump('SP - Conversations - ' + msg + '\n');
}


// ACTUAL IMPLEMENTATION
// ----------------------------------------------------------------------

Components
    .classes['@mozilla.org/moz/jssubscript-loader;1']
    .getService(Components.interfaces.mozIJSSubScriptLoader)
    .loadSubScript('chrome://sameplace/content/conversations/conversations_impl.js');


if(window.isStandAlone()) {
    // API OVERRIDES
    // ----------------------------------------------------------------------

    var __selectedContact = selectedContact;
    selectedContact = function() {
        if(window.isHidden())
            window.show();

        window.focus();

        __selectedContact.apply(null, arguments);
    }

    // GUI REACTIONS
    // ----------------------------------------------------------------------

    var windowObserver = {
        observe: function(subject, topic, data) {
            if(topic == 'domwindowclosed' &&
               window.isHidden() &&
               window.isLastWindow()) {
                d('last window close detected, shutting down...');
                window.close();
            }
        }
    };

    window.addEventListener('close', function(event) {
        requestedClose(event);
    }, false);

    window.addEventListener('unload', function() {
         srvWindowWatcher.unregisterNotification(windowObserver);

        // finalize conversation implementation
        finish();
    }, false)

    function requestedClose(event) {
        d('requested close');
        if(window.isLastWindow()) {
            d('last window, accepting');
            return true;
        } else {
            d('hiding instead of closing');
            event.preventDefault();
            window.hide();
        }
    }

    window.addEventListener('conversation/close', function(event) {
        if(getCount() == 1)
            window.hide();
    }, false);

    // GUI ACTIONS
    // ----------------------------------------------------------------------

    function hide() {
        if(window.isHidden())
            return;

        window.minimize();
    }

    function show() {
        window.restore();
    }

    function isHidden() {
        return window.windowState == window.STATE_MINIMIZED;
    }

    function isLastWindow() {
        var enumWindows = srvWindowMediator.getEnumerator('');
        var count = 0;
        while(enumWindows.hasMoreElements()) {
            enumWindows.getNext();
            count++;
        }
        return count == 1;
    }

    function popUp() {
        var shouldPopup = true;
        var shouldGetAttention = true;

        if(shouldGetAttention)
            window.getAttention();

        if(shouldPopup) {
            if(window.windowState == window.STATE_MINIMIZED)
                window.restore();
        }
    }
}
