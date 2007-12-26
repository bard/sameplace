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
var MAX_MESSAGE_CACHE = 10;


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
            // Allow non-error messages with readable body [1] or
            // error messages in general [2] but not auth requests [3]
            return (((s.@type != 'error' && s.body.text() != undefined) || // [1]
                     (s.@type == 'error')) && // [2]
                    (s.ns_http_auth::confirm == undefined)) // [3]
        }
    }, function(message) {
        cachePut(message);
        seenDisplayableMessage(message);
    });

    channel.on({
        event     : 'message',
        direction : 'out',
        stanza    : function(s) {
            // Allow messages with readable bodies [1], except if they
            // belong to a groupchat [2] (we show those as they come
            // back)
            return (s.body.text() != undefined &&
                    s.@type != 'groupchat');
        }
    }, function(message) {
        cachePut(message);
        seenDisplayableMessage(message);
    });

    channel.on({
        event     : 'message',
        direction : 'out',
        stanza    : function(s) {
            return s.ns_chatstates::active != undefined;
        }
    }, function(message) {
        sentChatActivation(message);
    });
}

function finish() {
    channel.release();
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function selectedContact(account, address) {
    var xulPanel = get(account, address);
    if(xulPanel)
        focus(xulPanel);
    else
        open(account, address, function(xulPanel) { focus(xulPanel); });
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

function open(account, address, nextAction) {
    var xulConversations = $('#deck');
    var xulTab = xulConversations.addTab();
    var xulPanel = xulConversations.getBrowserForTab(xulTab);
    xulPanel.tab = xulTab;

    afterLoad(xulPanel, function() {
        XMPP.connectPanel(xulPanel, account, address);
        xulPanel.contentWindow.addEventListener('unload', function(event) {
            closed(xulPanel);
        }, false);

        opened(xulPanel);

        if(typeof(nextAction) == 'function')
            nextAction(xulPanel);
    });
    xulPanel.setAttribute('account', account);
    xulPanel.setAttribute('address', address);
    xulPanel.setAttribute('src', DEFAULT_INTERACTION_URL);
}

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
    var account = message.account;
    var address = getContact(message).address;
    
    if(!get(account, address))
        open(account, address);
}

function sentChatActivation(message) {
    selectedContact(message.account,
                    XMPP.JID(message.stanza.@to).address);
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
    if(cache.length > MAX_MESSAGE_CACHE)
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
