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
if(typeof(ns_muc) == 'undefined')
    var ns_muc      = 'http://jabber.org/protocol/muc';
if(typeof(ns_muc_user) == 'undefined')
    var ns_muc_user = 'http://jabber.org/protocol/muc#user';


// STATE
// ----------------------------------------------------------------------

var channel;
var messageCache = {};
var getPanels, getTabs;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

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
        if(XMPP.isMUC(account, address))
            exitRoom(account, address,
                     XMPP.JID(getJoinPresence(account, address).stanza.@to).resource);
    }, false);
}

function finish() {
    channel.release();
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function clickedInConversation(event) {
    event.preventDefault();

    var htmlAnchor =
        event.target instanceof HTMLAnchorElement ?
        event.target :
        (event.target.parentNode instanceof HTMLAnchorElement ?
         event.target.parentNode : null);

    // XXX only recognizes <a href="...">link</a> and <a
    // href="..."><img/></a>.
    if(htmlAnchor)
        openURL(htmlAnchor.href);
    
}

function selectedContact(account, address) {
    var xulPanel = get(account, address);
    if(xulPanel)
        getPanels().selectedTab = xulPanel.tab;
    else
        open(account, address, function(xulPanel) {
            getPanels().selectedTab = xulPanel.tab;
        });
}

function selectedTab(event) {
    var xulTab = event.target.selectedItem;
    var xulPanel = getPanels().getBrowserForTab(xulTab);
    xulPanel.contentWindow.focus();
    removeClass(xulTab, 'unread');
}

function opened(xulPanel) {
    if(getPanels().childNodes.length == 1)
        getPanels().selectedTab = xulPanel.tab;

    var account = xulPanel.getAttribute('account');
    var address = xulPanel.getAttribute('address');
    
    cacheFor(account, address)
        .forEach(function(message) { xulPanel.xmppChannel.receive(message); });

    if(!XMPP.isMUC(account, address))
        updatePresenceIndicator(account, address);

    var openEvent = document.createEvent('Event');
    openEvent.initEvent('conversation/open', true, false);
    xulPanel.dispatchEvent(openEvent);
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function openURL(url) {
    if(!url.match(/^((https?|ftp|file):\/\/|(xmpp|mailto):)/))
        return;
    
    function canLoadPages(w) {
        return (w && 
                typeof(w.getBrowser) == 'function' &&
                'addTab' in w.getBrowser());
    }

    var candidates = [
        top, 
        Cc['@mozilla.org/appshell/window-mediator;1']
            .getService(Ci.nsIWindowMediator)
            .getMostRecentWindow('navigator:browser')]
        .filter(canLoadPages);

    if(candidates.length > 0)
        candidates[0].getBrowser().selectedTab =
        candidates[0].getBrowser().addTab(url);
    else
        Cc['@mozilla.org/uriloader/external-protocol-service;1']
        .getService(Ci.nsIExternalProtocolService)
        .loadUrl(Cc['@mozilla.org/network/io-service;1']
                 .getService(Ci.nsIIOService)
                 .newURI(url, null, null));
}

function toggle() {
    toggleClass(document.documentElement, 'expanded')
    // XXX we shouldn't peek into the outside world. instead, generate
    // a "toggle" event and let the overlay react.
    toggleClass(frameElement.parentNode, 'expanded');
}

// XXX make it clear that this is not to be called for MUCs

function updatePresenceIndicator(account, address) {
    var xulPanel = get(account, address);
    if(!xulPanel)
        return;

    var xulTab = xulPanel.tab;
    
    var presence = XMPP.presencesOf(account, address)[0]; // XXX won't handle conversation with offline contact!

    if(!presence)
        return;

    var availability = presence.stanza.@type.toString() || 'available';
    var show         = presence.stanza.show.toString();
    var status       = presence.stanza.status.text();

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

function open(account, address, nextAction) {
    var xulConversations = getPanels();
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


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function sentMUCJoinPresence(presence) {
    var room = XMPP.JID(presence.stanza.@to);
    var account = presence.session.name;
    var address = room.address;

    if(!get(account, address))
        open(account, address, function(xulPanel) {
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

    var xulPanel = get(account, address) || open(account, address);

    if(!isCurrent(xulPanel))
        addClass(xulPanel.tab, 'unread');
}

function sentChatActivation(message) {
    selectedContact(message.account,
                    XMPP.JID(message.stanza.@to).address);
}


// NETWORK ACTIONS
// ----------------------------------------------------------------------

function getJoinPresence(account, address) {
    return XMPP.cache.first(XMPP.q()
                            .event('presence')
                            .account(account)
                            .direction('out')
                            .to(address)
                            .child(ns_muc, 'x'));
}
                           
function exitRoom(account, roomAddress, roomNick) {
    XMPP.send(account,
              <presence to={roomAddress + '/' + roomNick} type="unavailable">
              <x xmlns={ns_muc}/>
              </presence>);
}


// OTHER ACTIONS
// ----------------------------------------------------------------------

function getDefaultAppUrl() {
    var url = pref.getCharPref('defaultAppUrl');
    if(/^chrome:\/\//.test(url) && !hostAppIsMail())
        // Thunderbird's content policy won't allow applications
        // served from file://.  For all others, we turn security up a
        // notch and convert chrome:// URLs to file://.
        return chromeToFileUrl(url);
    else
        return url;
}

function hostAppIsMail() {
    return (Components.classes['@mozilla.org/xre/app-info;1']
            .getService(Components.interfaces.nsIXULAppInfo)
            .ID == '{3550f703-e582-4d05-9a08-453d09bdfdc6}');
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


// UTILITIES
// ----------------------------------------------------------------------

function setClass(xulElement, aClass, state) {
    if(state)
        addClass(xulElement, aClass);
    else
        removeClass(xulElement, aClass);
}

function toggleClass(xulElement, aClass) {
    if(hasClass(xulElement, aClass))
        removeClass(xulElement, aClass);
    else
        addClass(xulElement, aClass);
}

function hasClass(xulElement, aClass) {
    return xulElement.getAttribute('class').split(/\s+/).indexOf(aClass) != -1;
}

function addClass(xulElement, newClass) {
    var classes = xulElement.getAttribute('class').split(/\s+/);
    if(classes.indexOf(newClass) == -1)
        xulElement.setAttribute('class', classes.concat(newClass).join(' '));
}

function removeClass(xulElement, oldClass) {
    var classes = xulElement.getAttribute('class').split(/\s+/);
    var oldClassIndex = classes.indexOf(oldClass);
    if(oldClassIndex != -1) {
        classes.splice(oldClassIndex, 1);
        xulElement.setAttribute('class', classes.join(' '));
    }
}

