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
var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');

var MAX_MESSAGE_CACHE = 10;


// STATE
// ----------------------------------------------------------------------

var channel;
var messageCache = {};


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init() {
    window.addEventListener('contact/select', selectedContact, false);
    
    // locate message window here and
    
    channel = XMPP.createChannel();
}

function finish() {
    channel.release();
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function selectedContact(event) {
    var account = event.target.getAttribute('account');
    var address = event.target.getAttribute('address');

    var xulPanel = get(account, address);
    if(xulPanel)
        getConversations().selectedTab = xulPanel.tab;
    else
        open(account, address, function(xulPanel) {
            getConversations().selectedTab = xulPanel.tab;
        });
}

// NETWORK REACTIONS
// ----------------------------------------------------------------------


// UTILITIES
// ----------------------------------------------------------------------


// GUI ACTIONS
// ----------------------------------------------------------------------

function getConversations() {
    return top.document.getElementById('sameplace-conversations');
}

function open(account, address, nextAction) {
    var xulConversations = getConversations();
    var xulTab = xulConversations.addTab();
    var xulPanel = xulConversations.getBrowserForTab(xulTab);
    xulTab.setAttribute('tooltiptext', address);
    xulPanel.tab = xulTab;

    afterLoad(xulPanel, function() {
        XMPP.connectPanel(xulPanel, account, address);
        // Using beforeunload because sometimes, by the time 'unload'
        // fired, xulPanel would already have lost account/address
        // attributes.
        xulPanel.contentWindow.addEventListener('beforeunload', function(event) {
            var closeEvent = document.createEvent('Event');
            closeEvent.initEvent('conversation/close', true, false);
            xulPanel.dispatchEvent(closeEvent);
        }, false);

        opened(xulPanel);

        if(typeof(nextAction) == 'function')
            nextAction(xulPanel);
    });
    xulPanel.setAttribute('account', account);
    xulPanel.setAttribute('address', address);
    xulPanel.setAttribute('src', getDefaultAppUrl());

    return xulPanel;
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function opened(xulPanel) {
    if(getConversations().childNodes.length == 1)
        getConversations().selectedTab = xulPanel.tab;

    var account = xulPanel.getAttribute('account');
    var address = xulPanel.getAttribute('address');
    
    cacheFor(account, address)
        .forEach(function(message) { xulPanel.xmppChannel.receive(message); });

    //if(!XMPP.isMUC(account, address))
    //updatePresenceIndicator(account, address);

    var openEvent = document.createEvent('Event');
    openEvent.initEvent('conversation/open', true, false);
    xulPanel.dispatchEvent(openEvent);
}


// OTHER ACTIONS
// ----------------------------------------------------------------------

function getDefaultAppUrl() {
    return pref.getCharPref('defaultAppUrl');
}

function cacheFor(account, address) {
    if(!messageCache[account])
        messageCache[account] = {};
    if(!messageCache[account][address])
        messageCache[account][address] = [];
    return messageCache[account][address];
}

function cachePut(message) {
    var cache = cacheFor(message.account, getContact(message).address);
    if(cache.length > MAX_MESSAGE_CACHE)
        cache.shift();
    cache.push(message);
}


// UTILITIES
// ----------------------------------------------------------------------

