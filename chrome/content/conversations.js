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

load('chrome://sameplace/content/lib/proxy.js', this);


// GLOBAL STATE
// ----------------------------------------------------------------------

var dom;


// INITIALIZATION
// ----------------------------------------------------------------------

function init(_dom) {
    dom = _dom;

    var customHandlers = {
        getBoolPref: function(originalTarget, prefName) {
            if(prefName == 'browser.tabs.autoHide')
                return false;
            else
                return originalTarget(prefName);
        }
    };
    dom.mPrefs = proxy.create(dom.mPrefs, customHandlers);
    dom.setStripVisibilityTo(true);

    dom.setAttribute('handleCtrlPageUpDown', 'false');
    document.getAnonymousElementByAttribute(dom, 'anonid', 'tabbox')
        .setAttribute('handleCtrlTab', false);

    dom.addEventListener(
        'load', function(event) {
            if(event.originalTarget != dom)
                return;
            dom.collapsed = false;
        }, true);

    dom.mPanelContainer.addEventListener(
        'select', function(event) {
            var panel = dom.getBrowserAtIndex(
                dom.mTabContainer.selectedIndex);

            if(panel.contentDocument.location.href == 'about:blank')
                return;
            focused(panel.getAttribute('account'),
                    panel.getAttribute('address'));
        }, false);
}


// REACTIONS
// ----------------------------------------------------------------------

function focused(account, address) {
    var focusEvent = document.createEvent('Event');
    focusEvent.initEvent('conversation/focus', true, false);
    get(account, address).removeAttribute('unread');
    get(account, address).dispatchEvent(focusEvent);
}

function opened(account, address) {
    var openEvent = document.createEvent('Event');
    openEvent.initEvent('conversation/open', true, false);
    get(account, address).dispatchEvent(openEvent);

    if(isCurrent(account, address))
        focused(account, address);
}

function closed(account, address) {
    var closeEvent = document.createEvent('Event');
    closeEvent.initEvent('conversation/close', true, false);
    get(account, address).dispatchEvent(closeEvent);
}


// ACTIONS
// ----------------------------------------------------------------------

function switchToNext() {
    var i = getIndexForConversation(
        current.getAttribute('account'),
        current.getAttribute('address'));

    if(i == dom.tabContainer.childNodes.length-1)
        dom.selectedTab = dom.tabContainer.firstChild;
    else
        dom.selectedTab = dom.tabContainer.childNodes[i+1];
}

function switchToUnread() {
    for(var i=0, panels = dom.browsers; i<panels.length; i++)
        if(panels[i].getAttribute('unread') == 'true') {
            focus(panels[i].getAttribute('account'),
                  panels[i].getAttribute('address'));
            return;
        }
}

function close(account, address) {
    var i = getIndexForConversation(account, address);
    if(i > -1)
        if(dom.tabContainer.childNodes.length == 1)
            dom.selectedBrowser.setAttribute('src', 'about:blank');
        else
            dom.removeTab(dom.tabContainer.childNodes[i]);
}

function focusCurrent() {
    var conversation = current;
    if(conversation) {
        conversation.contentWindow.focus();
        document.commandDispatcher.advanceFocus();
    }
}

function focus(account, address) {
    var i = getIndexForConversation(account, address);
    if(i > -1) {
        var conversation = dom.browsers[i];
        focused(account, address);
        dom.selectedTab = dom.tabContainer.childNodes[i];

        // Force a separate thread, otherwise input area gets focus
        // but cursor does not appear.
        setTimeout(function() {
                       conversation.contentWindow.focus();
                       document.commandDispatcher.advanceFocus();
                   }, 0);

    }
}


// UTILITIES
// ----------------------------------------------------------------------

__defineGetter__(
    'current', function() {
        return dom.selectedBrowser;
    });

__defineGetter__(
    'count', function() {
        if(dom.browsers.length == 1 &&
           dom.browsers[0].currentURI.spec == 'about:blank')
            return 0;
        else
            return dom.browsers.length;
    });

function isOpen(account, address) {
    return get(account, address) != undefined;
}

function isCurrent(account, address) {
    return current == get(account, address);
}

function get(account, address) {
    var i = getIndexForConversation(account, address);
    if(i > -1)
        return dom.getBrowserAtIndex(i);
}

function getIndexForConversation(account, address) {
    var browsers = dom.browsers;
    for(var i=0; i<browsers.length; i++)
        if(browsers[i].getAttribute('account') == account &&
           browsers[i].getAttribute('address') == address)
            return i;
    return -1;
}


// UTILITIES (GENERIC)
// ----------------------------------------------------------------------

function load(url, context) {
    Cc['@mozilla.org/moz/jssubscript-loader;1']
        .getService(Ci.mozIJSSubScriptLoader)
        .loadSubScript(url, context);
}
