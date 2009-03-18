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
var Cu = Components.utils;

var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');
var srvObserver = Cc["@mozilla.org/observer-service;1"]
    .getService(Ci.nsIObserverService);

var MAX_MESSAGE_CACHE = 100;

var util = load('chrome://sameplace/content/lib/util_impl.js', {});
Cu.import('resource://xmpp4moz/namespaces.jsm');


// STATE
// ----------------------------------------------------------------------

var channel;
var messageCache = {};
var getPanels, getTabs;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function dateToStamp(date) {
    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }
    
    return (date.getUTCFullYear() +
            pad(date.getUTCMonth()+1) +
            pad(date.getUTCDate()) + 'T' +
            pad(date.getUTCHours()) + ':' +
            pad(date.getUTCMinutes()) + ':' +
            pad(date.getUTCSeconds()));
}

function init(xulPanels, xulTabs) {
    getPanels = function() { return xulPanels; };
    getTabs   = function() { return xulTabs; };
    
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

    channel.on({
        event     : 'message',
        direction : 'in',
        stanza    : function(s) {
            return (s.ns_event::x != undefined ||
                    s.ns_chatstates::* != undefined);
        }
    }, function(message) {
        receivedChatState(message);
    });

    channel.on({
        event     : 'presence',
        direction : 'out',
        stanza    : function(s) {
            return s.ns_muc::x != undefined && s.@type != 'unavailable'; 
       }
    }, function(presence) { sentMUCJoinPresence(presence) });

    channel.on({
        event     : 'presence',
        direction : 'in',
        stanza    : function(s) {
            return (s.@type == undefined || s.@type == 'unavailable') &&
                s.ns_muc_user::x == undefined;
        }
    }, receivedContactPresence);

    getTabs().addEventListener('select', function(event) {
        // It's important that this be a call-by-name rather than a
        // call-by-reference since other places (e.g. overlay_mail.js)
        // will advice selectedTab()
        selectedTab(event)
    }, false);

    getPanels().addEventListener('click', clickedInConversation, true);

    getPanels().addEventListener('conversation/close', function(event) {
        var account = event.target.getAttribute('account');
        var address = event.target.getAttribute('address');

        var messages = cacheFor(account, address);
        var message = messages[messages.length - 1];
        if (message) {
            if (message.stanza.ns_delay::x == undefined ) {
                message.stanza.ns_delay::x.@stamp = dateToStamp(new Date());
                message.stanza.ns_delay::x.@from = "SamePlace/Internal";
            }
        }

        if(XMPP.isMUC(account, address))
            exitRoom(account, address,
                     XMPP.JID(util.getJoinPresence(account, address).stanza.@to).resource);
    }, false);

    srvObserver.addObserver(uriObserver, 'xmpp-uri-invoked', false);
}

function finish() {
    srvObserver.removeObserver(uriObserver, 'xmpp-uri-invoked', false);
    channel.release();
}

// OBSERVER REACTIONS
// ----------------------------------------------------------------------

var uriObserver = {
    observe: function(subject, topic, data) {
        try {
            var entity = XMPP.entity(subject);
            selectedContact(decodeURIComponent(entity.account), entity.address);
        } catch(e) {
            Cu.reportError(e)
        }
    }
};


// GUI REACTIONS
// ----------------------------------------------------------------------

function clickedInConversation(event) {
    if(event.button != 0)
        return;

    var htmlAnchor =
        event.target instanceof HTMLAnchorElement ?
        event.target :
        (event.target.parentNode instanceof HTMLAnchorElement ?
         event.target.parentNode : null);

    // XXX only recognizes <a href="...">link</a> and <a
    // href="..."><img/></a>.
    if(htmlAnchor) {
        event.preventDefault();
        util.openURL(htmlAnchor.href);
    }
}

function selectedContact(account, address) {
    var xulPanel = get(account, address);
    if(xulPanel)
        getPanels().selectedTab = xulPanel.tab;
    else
        create(account, address, function(xulPanel) {
            getPanels().selectedTab = xulPanel.tab;
        });
}

function selectedTab(event) {
    var xulTab = event.target.selectedItem;
    var xulPanel = getPanels().getBrowserForTab(xulTab);
    xulPanel.contentWindow.focus();
    util.removeClass(xulTab, 'unread');
}

function opened(xulPanel) {
    if(getPanels().childNodes.length == 1)
        getPanels().selectedTab = xulPanel.tab;

    var account = xulPanel.getAttribute('account');
    var address = xulPanel.getAttribute('address');
    
    cacheFor(account, address)
        .forEach(function(message) { xulPanel.xmppChannel.receive(message); });

    updatePresenceIndicator(account, address);

    var openEvent = document.createEvent('Event');
    openEvent.initEvent('conversation/open', true, false);
    xulPanel.dispatchEvent(openEvent);
}

function requestedCopy(event) {
    Cc['@mozilla.org/widget/clipboardhelper;1']
        .getService(Ci.nsIClipboardHelper)
        .copyString(getCurrent().contentWindow.getSelection().toString());
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function toggle() {
    util.toggleClass(document.documentElement, 'expanded')
    // XXX we shouldn't peek into the outside world. instead, generate
    // a "toggle" event and let the overlay react.
    util.toggleClass(frameElement.parentNode, 'expanded');
}

// XXX this is incorrect.  It assumes that if an outgoing available
// presence with a MUC namespaced <x> is in the cache, the room is
// joined.  However, such presence is removed from cache only when
// user intentionally leaves the room, not when he's forced to
// (because of /kick or disconnection).

function isJoinedMUC(account, address) {
    return XMPP.cache.first(
        XMPP.q()
            .event('presence')
            .direction('out')
            .account(account)
            .to(address)
            .child(ns_muc,'x'));
}

function updatePresenceIndicator(account, address) {
    var xulPanel = get(account, address);
    if(!xulPanel)
        return;

    var xulTab = xulPanel.tab;
    var availability, show, status;
    if(isJoinedMUC(account, address)) {
        availability = 'available';
        show = '';
        status = '';
    } else {
        var presence = XMPP.presencesOf(account, address)[0];
        if(!presence)
            // Contact is offline, and indicator is offline by
            // default, so...
            return;
        
        availability = presence.stanza.@type.toString() || 'available';
        show         = presence.stanza.show.toString();
        status       = presence.stanza.status.text();
    }
        
    if(xulTab.getAttribute('status') == status &&
       xulTab.getAttribute('show') == show &&
       xulTab.getAttribute('availability') == availability)
        // Guard against mere re-assertions of status.  Google sends
        // these out a lot...
        return;

    xulTab.setAttribute('availability', availability);
    xulTab.setAttribute('show', show);
    xulTab.setAttribute('status', status);
}

function simulateDrop(data, contentType) {
    var xulPanel = getPanels().selectedPanel;
    xulPanel.contentDocument
        .getElementById('dnd-sink')
        .textContent = (<data content-type={contentType}>{data}</data>).toXMLString();

    var dropEvent = document.createEvent('Event');
    dropEvent.initEvent('hsDrop', true, false);
    xulPanel.contentDocument.getElementById('dnd-sink').dispatchEvent(dropEvent);
}

function create(account, address, nextAction) {
    var xulConversations = getPanels();
    var xulTab = xulConversations.addTab();
    var xulPanel = xulConversations.getBrowserForTab(xulTab);
    xulTab.setAttribute('tooltiptext', address);
    xulPanel.tab = xulTab;

    xulPanel.addEventListener('load', function(event) {
        xulPanel.removeEventListener('load', arguments.callee, true);

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
    }, true);

    xulPanel.setAttribute('account', account);
    xulPanel.setAttribute('address', address);
    xulPanel.setAttribute('src', util.getDefaultAppUrl());

    return xulPanel;
}

function get(account, address) {
    var xulPanel = getPanels().firstChild;
    while(xulPanel) {
        if(xulPanel.getAttribute('address') == address &&
           xulPanel.getAttribute('account') == account)
            return xulPanel;
        xulPanel = xulPanel.nextSibling;
    }
    return null;
}

function getCount() {
    return getPanels().browsers.length;
}

function isCurrent(xulPanel) {
    return getPanels().selectedBrowser == xulPanel;
}

function getCurrent() {
    return getPanels().selectedBrowser;
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function sentMUCJoinPresence(presence) {
    var room = XMPP.JID(presence.stanza.@to);
    var account = presence.session.name;
    var address = room.address;

    if(!get(account, address))
        create(account, address, function(xulPanel) {
            getPanels().selectedTab = xulPanel.tab;
        });
}

function receivedContactPresence(presence) {
    var account = presence.account;
    var address = XMPP.JID(presence.stanza.@from).address;
    updatePresenceIndicator(account, address);
}

function receivedChatState(message) {
    var xulPanel = get(message.account, XMPP.JID(message.stanza.@from).address);
    if(!xulPanel)
        return;
    var xulTab = xulPanel.tab;

    if(message.stanza.ns_chatstates::* != undefined)
        xulTab.setAttribute(
            'chatstate', message.stanza.ns_chatstates::*[0].localName());
    else if(message.stanza.ns_event::x != undefined) {
        if(message.stanza.ns_event::x.composing != undefined) // XXX shouldn't that be ns_event::composing?
            xulTab.setAttribute('chatstate', 'composing');
        else
            xulTab.setAttribute('chatstate', 'active');
    }
}

function seenDisplayableMessage(message) {
    var account = message.account;
    var address = getContact(message).address;

    var xulPanel = get(account, address) || create(account, address);

    if(!isCurrent(xulPanel))
        util.addClass(xulPanel.tab, 'unread');
}

function sentChatActivation(message) {
// XXX remove
//    selectedContact(message.account,
//                    XMPP.JID(message.stanza.@to).address);
}


// NETWORK ACTIONS
// ----------------------------------------------------------------------

function exitRoom(account, roomAddress, roomNick) {
    XMPP.send(account,
              <presence to={roomAddress + '/' + roomNick} type="unavailable">
              <x xmlns={ns_muc}/>
              </presence>);
}


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

function getContact(message) {
    // XXX should probably use 'direction' field here
    //var address = message.direction == 'in' ?
    //XMPP.JID(message.stanza.@from).address : XMPP.JID(message.stanza.@to).address;

    return XMPP.JID(message.stanza.@from != undefined ?
                    message.stanza.@from : message.stanza.@to);
}


// GUI UTILITIES
// ----------------------------------------------------------------------


// UTILITIES
// ----------------------------------------------------------------------

function load(url, context) {
    var loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
        .getService(Ci.mozIJSSubScriptLoader);

    if(!context)
        // load everything in current context
        loader.loadSubScript(url);
    else if(arguments.length == 2) {
        // load everything in specified context and also return it
        loader.loadSubScript(url, context);
        return context;
    } else {
        // load some things in current or specified context
        context = context || this;
        var tmpContext = {};
        loader.loadSubScript(url, tmpContext);
        for each(var name in Array.slice(arguments, 2)) {
            this[name] = tmpContext[name];
        }
        return context;
    }
}