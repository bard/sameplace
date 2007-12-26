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

var DEFAULT_INTERACTION_URL = chromeToFileUrl('chrome://sameplace/content/app/chat.xhtml');


// STATE
// ----------------------------------------------------------------------

var channel;
var messageCache = {};


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init() {
    channel = XMPP.createChannel();

    tabbedArea($('#deck'), $('#tabs'));

    channel.on({
        event     : 'message',
        direction : 'in',
        stanza    : function(s) {
            return ((s.@type != 'error' && s.body.text() != undefined) ||
                    (s.@type == 'error'))
        }
    }, function(message) {
        cachePut(message);
        seenDisplayableMessage(message);
    });

    channel.on({
        event     : 'message',
        direction : 'out',
        stanza    : function(s) {
            return s.body.text() != undefined && s.@type != 'groupchat';
        }
    }, function(message) {
        cachePut(message);
        seenDisplayableMessage(message);
    });
}

// GUI REACTIONS
// ----------------------------------------------------------------------

function selectedContact(account, address) {
    var xulConversations = $('#deck');
    var xulPanel = get(account, address);
    if(xulPanel)
        xulConversations.selectedTab = xulPanel.tab;
    else {
        var xulTab = xulConversations.addTab();
        var xulPanel = xulConversations.getBrowserForTab(xulTab);
        xulPanel.tab = xulTab;

        afterLoad(xulPanel, function() {
            XMPP.connectPanel(xulPanel, account, address);
            xulPanel.contentWindow.addEventListener('unload', function(event) {
                closed(xulPanel);
            }, false);

            opened(xulPanel);
            focus(xulPanel);
        });
        xulPanel.setAttribute('account', account);
        xulPanel.setAttribute('address', address);
        xulPanel.setAttribute('src', DEFAULT_INTERACTION_URL);
    }
}

function closed(xulPanel) {
    var closeEvent = document.createEvent('Event');
    closeEvent.initEvent('conversation/close', true, false);
    xulPanel.dispatchEvent(closeEvent);
}

function opened(xulPanel) {
    if($('#deck').childNodes.length == 1)
        $('#deck').selectedTab = xulPanel.tab;

    cacheFor(xulPanel.getAttribute('account'),
             xulPanel.getAttribute('address'))
        .forEach(function(message) { xulPanel.xmppChannel.receive(message); });

    var openEvent = document.createEvent('Event');
    openEvent.initEvent('conversation/open', true, false);
    xulPanel.dispatchEvent(openEvent);
}

// GUI ACTIONS
// ----------------------------------------------------------------------

function get(account, address) {
    return $('#deck > [account="' + account + '"][address="' + address + '"]');
}

function focus(xulPanel) {
    $('#deck').selectedTab = xulPanel.tab;
    xulPanel.contentWindow.focus();
}

function getCount() {
    return $('#deck').browsers.length;
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function seenDisplayableMessage(message) {
    if(message.stanza.ns_http_auth::confirm != undefined)
        // Balk at auth requests since these are handled elsewhere.
        // We have to do this since auth requests usually have a
        // <body> and upstream channel listener will send them our
        // way.
        return;

    var account = message.account;
    var address = getContact(message).address;
    
    var xulPanel = get(account, address);
    if(!xulPanel) {
        var xulConversations = $('#deck');
        var xulTab = xulConversations.addTab();
        xulPanel = xulConversations.getBrowserForTab(xulTab);
        xulPanel.tab = xulTab;

        afterLoad(xulPanel, function() {
            XMPP.connectPanel(xulPanel, account, address);
            xulPanel.contentWindow.addEventListener('unload', function(event) {
                closed(xulPanel);
            }, false);

            opened(xulPanel);
            // Not focusing here, as it's not the result of user's intention
        });
        xulPanel.setAttribute('account', account);
        xulPanel.setAttribute('address', address);
        xulPanel.setAttribute('src', DEFAULT_INTERACTION_URL);
    }
}

function sentChatActivation(message) {
    
}


// NETWORK ACTIONS
// ----------------------------------------------------------------------


// OTHER ACTIONS
// ----------------------------------------------------------------------

function cacheFor(account, address) {
    if(!messageCache[account])
        messageCache[account] = {};
    if(!messageCache[account][address])
        messageCache[account][address] = [];
    return messageCache[account][address];
}

function cachePut(message) {
    var cache = cacheFor(message.account, getContact(message).address);
    if(cache.length > 10)
        cache.shift();
    cache.push(message);
}


// UTILITIES
// ----------------------------------------------------------------------

function chromeToFileUrl(url) {
    return Cc['@mozilla.org/chrome/chrome-registry;1']
    .getService(Ci.nsIChromeRegistry)
    .convertChromeURL(
        Cc['@mozilla.org/network/io-service;1']
        .getService(Ci.nsIIOService)
        .newURI(url, null, null)).spec;
}

function getContact(message) {
    // XXX should probably use 'direction' field here
    //var address = message.direction == 'in' ?
    //XMPP.JID(message.stanza.@from).address : XMPP.JID(message.stanza.@to).address;

    return XMPP.JID(message.stanza.@from != undefined ?
                    message.stanza.@from : message.stanza.@to);
}

function afterLoad(contentPanel, action) {
    contentPanel.addEventListener(
        'load', function(event) {
            if(event.target != contentPanel.contentDocument)
                return;

            // The following appears not to work if reference to
            // contentPanel is not the one carried by event object.
            contentPanel = event.currentTarget;
            contentPanel.contentWindow.addEventListener(
                'load', function(event) {
                    action(contentPanel);
                }, false);

            contentPanel.removeEventListener('load', arguments.callee, true);
        }, true);
}
