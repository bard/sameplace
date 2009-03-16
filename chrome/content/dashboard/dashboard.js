/*
 * Copyright 2008-2009 by Massimiliano Mirra
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
var Cr = Components.results;
var Cu = Components.utils;

Cu.import('resource://xmpp4moz/xmpp.jsm');
Cu.import('resource://xmpp4moz/namespaces.jsm');
Cu.import('resource://xmpp4moz/task.jsm');
Cu.import('resource://sameplace/main.jsm');


// INITIALIZATION
// ----------------------------------------------------------------------

var dashboard = {};

dashboard.init = function() {
    $$('widget').forEach(function(xulWidget) {
        var xulToggle = document.createElement('button');
        xulToggle.setAttribute('image', xulWidget.getAttribute('image'));
        xulToggle.setAttribute('tooltiptext', xulWidget.getAttribute('title'));
        xulToggle.setAttribute('type', 'checkbox');
        xulToggle.setAttribute('autoCheck', 'false');
        xulToggle.setAttribute('control', xulWidget.getAttribute('id'));
        xulToggle.setAttribute('checked', !xulWidget.hidden);

        xulToggle.addEventListener('command', function(event) {
            xulWidget.hidden = !xulWidget.hidden;
            xulToggle.setAttribute('checked', !xulWidget.hidden);
        }, false);

        $('#widgets-toolbar').insertBefore(xulToggle, $('#widgets-toolbar >toolbarspring'));
    });

    $('#widgets').addEventListener('widget/hide', function(event) {
        $('#widgets-toolbar > button[control="' + event.target.getAttribute('id') + '"]').checked = false;
    }, false);

    $('#more-widgets').open = function(event) {
        event.target.blur();
        util.openURL(event.target.getAttribute('href'));
    };

    // Let widgets know that we finished loading.  Widget will listen
    // to this instead of 'load' event on window because when window
    // loads, 'sameplace' global object might not have been
    // initialized yet.
    var loadEvent = document.createEvent('Event');
    loadEvent.initEvent('dashboard/load', true, false);
    $('#widgets').dispatchEvent(loadEvent);
}


// FINALIZATION
// ----------------------------------------------------------------------

dashboard.finish = function() {
    var unloadEvent = document.createEvent('Event');
    unloadEvent.initEvent('dashboard/unload', true, false);
    window.dispatchEvent(unloadEvent);
}


// REACTIONS
// ----------------------------------------------------------------------


// ACTIONS
// ----------------------------------------------------------------------

dashboard.openPreferences = function(paneID) {
    var instantApply;
    try {
        instantApply = Cc['@mozilla.org/preferences-service;1']
            .getService(Ci.nsIPrefBranch)
            .getBoolPref('browser.preferences.instantApply', false);
    } catch(e) {
        instantApply = false;
        Cu.reportError(e);
    }

    var features = 'chrome,titlebar,toolbar,centerscreen' +
        (instantApply ? ',dialog=no' : '');

    var prefWindow = Cc['@mozilla.org/appshell/window-mediator;1']
        .getService(Ci.nsIWindowMediator)
        .getMostRecentWindow('SamePlace:Preferences');

    if(prefWindow) {
        prefWindow.focus();
        if(paneID) {
            var pane = prefWindow.document.getElementById(paneID);
            prefWindow.document.documentElement.showPane(pane);
        }
    } else {
        window.openDialog.apply(null, ['chrome://sameplace/content/preferences/preferences.xul',
                                       'SamePlace:Preferences',
                                       features].concat(Array.slice(arguments)));
    }
};

dashboard.notify = function(label, value, image, priority, buttons) {
    $('#notify').appendNotification(
        label,
        value,
        image,
        priority && $('#notify')['PRIORITY_' + priority.toUpperCase()],
        buttons);
};
