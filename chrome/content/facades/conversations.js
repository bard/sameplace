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

function init(_dom, onlyHostsConversations) {
    dom = _dom;

    dom.mPanelContainer.addEventListener(
        'select', function(event) {
            var panel = dom.getBrowserAtIndex(
                dom.mTabContainer.selectedIndex);
            if(panel.contentDocument.location.href == 'about:blank')
                return;
            if(isConversation(panel))
                focused(panel.getAttribute('account'),
                        panel.getAttribute('address'));
        }, false);

    if(onlyHostsConversations) {
        dom.mPrefs = proxy.create(dom.mPrefs, {
            getBoolPref: function(originalTarget, prefName) {
                if(prefName == 'browser.tabs.autoHide')
                    return false;
                else
                    return originalTarget(prefName);
            }
        });
        
        dom.setStripVisibilityTo(true);

        dom.setAttribute('handleCtrlPageUpDown', 'false');

        var tabbox = dom.ownerDocument.getAnonymousElementByAttribute(dom, 'anonid', 'tabbox') ||
            // firefox 1.5...
            dom.ownerDocument.getAnonymousNodes(dom)[1];
        tabbox.setAttribute('handleCtrlTab', false);
    }
}


// REACTIONS
// ----------------------------------------------------------------------

function focused(account, address) {
    var focusEvent = dom.ownerDocument.createEvent('Event');
    focusEvent.initEvent('conversation/focus', true, false);
    get(account, address).removeAttribute('unread');
    get(account, address).dispatchEvent(focusEvent);
}

function opened(account, address) {
    var openEvent = dom.ownerDocument.createEvent('Event');
    openEvent.initEvent('conversation/open', true, false);
    get(account, address).dispatchEvent(openEvent);

    if(isCurrent(account, address))
        focused(account, address);
}

function closed(account, address) {
    var closeEvent = dom.ownerDocument.createEvent('Event');
    closeEvent.initEvent('conversation/close', true, false);
    var conversation = get(account, address);
    conversation.dispatchEvent(closeEvent);
    // Firefox 1.5 doesn't do cleanup on closed browser, so we do.
    conversation.removeAttribute('src');
    conversation.removeAttribute('account');
    conversation.removeAttribute('address');
}


// ACTIONS
// ----------------------------------------------------------------------

function create(account, address) {
    var browser = (dom.currentURI.spec == 'about:blank' ?
                   dom.selectedBrowser :
                   dom.getBrowserForTab(dom.addTab()));

    browser.addEventListener(
        'load', function(event) {
            if(!event.target)
                return;
            if(event.target.location.href == 'about:blank')
                return;
            
            opened(account, address);
            
            browser.removeEventListener(
                'load', arguments.callee, true);

            browser.contentWindow.addEventListener(
                'beforeunload', function(event) {
                    conversations.closed(account, address);
                }, false);
        }, true);

    return browser;
}

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
        dom.ownerDocument.commandDispatcher.advanceFocus();
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
            dom.ownerDocument.commandDispatcher.advanceFocus();
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

function isConversation(panel) {
    return panel.hasAttribute('account') && panel.hasAttribute('address');
}

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


// DEVELOPER TOOLS
// ----------------------------------------------------------------------

function eventInfo(e) {
    var lines = [];
    for each(var name in ['originalTarget', 'target', 'currentTarget'])
        if(e[name] instanceof XULElement)
            lines.push(name + ': ' + e[name].tagName);
        else if(e[name] instanceof HTMLDocument)
            lines.push(name + ': ' + e[name].location.href);
        else
            lines.push(name + ': ' + e[name]);
    return lines.join('\n');
}