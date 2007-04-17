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

const Cc = Components.classes;
const Ci = Components.interfaces;

const prefBranch = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');
const srvPrompt = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);
const srvProtocol = Cc['@mozilla.org/uriloader/external-protocol-service;1']
    .getService(Ci.nsIExternalProtocolService);


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;
var messageCache = {};
var conversations = {};
load('chrome://sameplace/content/conversations.js', conversations);


// GUI INITIALIZATION AND FINALIZATION
// ----------------------------------------------------------------------

function init(event) {
    if(!event.target)
        return;

    channel = XMPP.createChannel(
        <query xmlns="http://jabber.org/protocol/disco#info">
        <feature var="http://jabber.org/protocol/muc"/>
        <feature var="http://jabber.org/protocol/muc#user"/>
        <feature var="http://jabber.org/protocol/xhtml-im"/>
        <feature var="http://jabber.org/protocol/chatstates"/>
        </query>);

    channel.on(
        {event: 'presence', direction: 'out', stanza: function(s) {
                return (s.@type == undefined || s.@type == 'unavailable') &&
                    s.ns_muc::x == undefined && s.@to == undefined;
            }},
        function(presence) { sentAvailablePresence(presence) });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.body.length() > 0 && s.@type != 'error';
            }}, function(message) { seenChatMessage(message); });
    channel.on(
        {event: 'message', direction: 'out', stanza: function(s) {
                return s.body.length() > 0 && s.@type != 'groupchat';
            }}, function(message) { seenChatMessage(message) });
    channel.on(
        {event: 'message', direction: 'out', stanza: function(s) {
                return s.ns_chatstates::active.length() > 0;
            }}, function(message) { seenOutgoingChatActivation(message); });
    channel.on(
        {event: 'message', stanza: function(s) {
                return s.@type != 'error' && s.body.length() > 0;
            }}, function(message) { seenCachableMessage(message); });
    channel.on(
        {event: 'presence', direction: 'out', stanza: function(s) {
                return s.ns_muc::x.length() > 0 && s.@type != 'unavailable';
            }}, function(presence) { sentMUCPresence(presence) });

    contacts = _('contacts').contentWindow;
    contacts.onRequestedCommunicate = function() {
        requestedCommunicate.apply(null, arguments);
    };

    XMPP.cache.fetch({
        event: 'presence',
        direction: 'out',
        }).forEach(sentAvailablePresence);


    // Wiring events from conversation subsystem to contact subsystem
    // and elsewhere

    conversations.init(_('conversations'));

    _('conversations').addEventListener(
        'conversation/open', function(event) {
            var panel = event.originalTarget;
            contacts.startedConversationWith(panel.getAttribute('account'),
                                             panel.getAttribute('address'));
            _('contact-toolbox', {role: 'attach'}).hidden = false;
        }, false);

    _('conversations').addEventListener(
        'conversation/focus', function(event) {
            var panel = event.originalTarget;
            contacts.nowTalkingWith(panel.getAttribute('account'),
                                    panel.getAttribute('address'));

            _('contact').value = XMPP.nickFor(panel.getAttribute('account'),
                                              panel.getAttribute('address'));
        }, false);

    _('conversations').addEventListener(
        'conversation/close', function(event) {
            var panel = event.originalTarget;
            contacts.stoppedConversationWith(
                panel.getAttribute('account'),
                panel.getAttribute('address'));

            if(conversations.count == 1) {
                _('conversations').collapsed = true;
                _('contact-toolbox', {role: 'attach'}).hidden = true;
                _('contact').value = '';
            }
        }, false);

    // Setting up contact autocompletion

    behaviour.autoComplete(_('contact'));

    _('contact').addEventListener(
        'complete', function(event) {
            buildContactCompletions(event.target);
        }, false);

    _('contact').addEventListener(
        'completed', function(event) {

            // Switching tab.  Need to focus current content window,
            // since going back will restore focus, and we don't want
            // focus on contact textbox.  XXX This must be handled by
            // the conversation subsystem.

            _('conversations').contentWindow.focus();
            requestedCommunicate(
                event.target.getAttribute('account'),
                event.target.getAttribute('address'),
                getDefaultAppUrl());
        }, false);

    // Filling shared application menu

    initApplicationMenu(_('menu-applications'));
}

function finish() {
    channel.release();
}


// NETWORK UTILITIES
// ----------------------------------------------------------------------

function fetchFeed(feedUrl, continuation) {
    if(!Ci.nsIFeed) {
        continuation(null);
        return;
    }
    
    var req = new XMLHttpRequest();

    req.onload = function() {
        var data = req.responseText;

        var ioService = Cc['@mozilla.org/network/io-service;1']
        .getService(Ci.nsIIOService);
        var uri = ioService.newURI(feedUrl, null, null);

        if(data.length) {
            var parser = Cc['@mozilla.org/feed-processor;1']
                .createInstance(Ci.nsIFeedProcessor);
            try {
                parser.listener = {
                    handleResult: function(result) {
                        continuation(result.doc.QueryInterface(Ci.nsIFeed));
                    }
                };
                parser.parseFromString(data, uri);
            }
            catch(e) {
                continuation(null, e);
            }
        }
    };

    req.open('GET', feedUrl, true);
    try {
        req.send(null);
    } catch(e) {
        continuation(null, e)
    }
}


// GUI UTILITIES (GENERIC)
// ----------------------------------------------------------------------
// Application-independent functions dealing with user interface.

function hasAncestor(element, parentName, parentNamespace) {
    var elementDoc = element.ownerDocument;
    while(element != elementDoc) {
        if(element.localName == parentName &&
           (!parentNamespace || element.isDefaultNamespace(parentNamespace)))
            return element;
        element = element.parentNode;
    }
    return false;
}


// GUI UTILITIES (SPECIFIC)
// ----------------------------------------------------------------------
// Application-dependent functions dealing with interface.  They do
// not affect the domain directly.

function getDefaultAppUrl() {
    var url = prefBranch.getCharPref('defaultAppUrl');
    return isChromeUrl(url) ? chromeToFileUrl(url) : url;
}

function getBrowser() {
    if(top.getBrowser)
        return top.getBrowser();

    return undefined;
}


// GUI ACTIONS
// ----------------------------------------------------------------------
// Application-dependent functions dealing with user interface.  They
// affect the domain.

function focusStatus() {
    _('status-message').focus();
}

function viewHelp() {
    openLink('http://help.sameplace.cc', true);
}

function visitForum() {
    openLink('http://forum.sameplace.cc', true);
}

function reportBug() {
    openLink('http://bugs.sameplace.cc', true);
}

function initApplicationMenu(menuPopup) {
    fetchFeed(
        'http://apps.sameplace.cc/feed.xml',
        function(feed, e) {
            if(!feed) throw e;

            var menus = {};
            function menuFor(category) {
                if(!menus[category]) {
                    var menu = document.createElement('menu');
                    menu.setAttribute('label', category);
                    menu.setAttribute('tooltiptext', category);
                    menuPopup.insertBefore(menu, menuPopup.getElementsByTagName('menuseparator')[0]);

                    var popup = document.createElement('menupopup');
                    menu.appendChild(popup);
                    menus[category] = popup;
                }
                return menus[category];
            }

            for(var i=0; i<feed.items.length; i++) {
                var item = feed.items.queryElementAt(i, Ci.nsIFeedEntry);

                var menuItem = document.createElement('menuitem');
                menuItem.setAttribute('label', item.fields.getProperty('title'));
                menuItem.setAttribute('value', item.fields.getProperty('link'));
                menuItem.setAttribute('tooltiptext', item.fields.getProperty('description'));
                menuFor(item.fields.getProperty('dc:subject')).appendChild(menuItem);
            }
        });
}

function buildContactCompletions(xulCompletions) {
    function presenceDegree(stanza) {
        if(stanza.@type == undefined && stanza.show == undefined)
            return 4;
        else if(stanza.@type == 'unavailable')
            return 0;
        else
            switch(stanza.show.toString()) {
            case 'chat': return 5; break;
            case 'dnd':  return 3; break;
            case 'away': return 2; break;
            case 'xa':   return 1; break;
            default:
                throw new Error('Unexpected. (' + stanza.toXMLString() + ')');
            }
    }

    var input = xulCompletions.parentNode.value;
    var completions = [];
    for each(var iq in XMPP.cache.roster) {
        for each(var item in iq.stanza..ns_roster::item) {
            var account = iq.session.name;
            var address = item.@jid;
            var nick    = XMPP.nickFor(account, address);
            if(nick.toLowerCase().indexOf(input.toLowerCase()) == 0) {
                var presence = XMPP.presenceSummary(account, address);
                completions.push({
                    label        : nick,
                    account      : account,
                    address      : address,
                    show         : presence.stanza.show.toString(),
                    presence     : presence,
                    availability : presence.stanza.@type.toString() || 'available' });
            }
        }
    }

    XMPP.cache.fetch({
        event: 'presence',
        direction: 'out',
        stanza: function(s) {
                return s.ns_muc::x.length() > 0;
            }
        }).forEach(
            function(presence) {
                var account = presence.session.name;
                var address = XMPP.JID(presence.stanza.@to).address;
                if(address.toLowerCase().indexOf(input.toLowerCase()) == 0)
                    completions.push({
                        label: address,
                        account: account,
                        address: address,
                        show: presence.stanza.show.toString(),
                        presence: presence,
                        availability: 'available' });
            });
        
    completions
        .sort(
            function(a, b) {
                var diff = presenceDegree(b.presence.stanza) - presenceDegree(a.presence.stanza);
                if(diff == 0)
                    diff = (a.label.toLowerCase() < b.label.toLowerCase()) ? -1 : 1;
                return diff;
            })
        .forEach(
            function(completion) {
                var xulCompletion = document.createElement('menuitem');
                xulCompletion.setAttribute('class', 'menuitem-iconic');
                xulCompletion.setAttribute('label', completion.label);
                xulCompletion.setAttribute('account', completion.account);
                xulCompletion.setAttribute('address', completion.address);
                xulCompletion.setAttribute('availability', completion.availability);
                xulCompletion.setAttribute('show', completion.show);
                xulCompletions.appendChild(xulCompletion);
            });
}

function openLink(url, newTab) {
    if(url.match(/^javascript:/))
        srvPrompt.alert(
            window, 'SamePlace: Security Notification',
            'This link contains javascript code and has been disabled as a security measure.');
    else if(hostAppIsBrowser() &&
            url.match(/^(https?|ftp|file):\/\//))
        // XXX handle xmpp and mailto as well
        openLinkInternally(url, newTab);
    else
        openLinkExternally(url);
}

function openLinkExternally(url) {
    srvProtocol.loadUrl(
        Cc['@mozilla.org/network/io-service;1']
        .getService(Ci.nsIIOService)
        .newURI(url, null, null));
}

function openLinkInternally(url, newTab) {
    if(newTab) 
        getBrowser().selectedTab = getBrowser().addTab(url);        
    else
        getBrowser().loadURI(url);
}

function updateAttachTooltip() {
    _('attach-tooltip', {role: 'message'}).value =
        'Make this conversation channel available to ' +
        getBrowser().currentURI.spec;
}

function changeStatusMessage(message) {
    for each(var account in XMPP.accounts)
        if(XMPP.isUp(account)) {
            var stanza = XMPP.cache.find({
                event: 'presence',
                direction: 'out',
                account: account.jid
                }).stanza.copy();
            
            if(message)
                stanza.status = message;
            else
                delete stanza.status;
            
            XMPP.send(account, stanza);
        }
}

/**
 * Interact with a contact in a new or existing interaction space.
 *
 * If "where" is a string, it is assumed to be an URL.  A new
 * interaction space is created and afterLoadAction is executed
 * immediately thereafter.  Target can be "main" (tipically for
 * conversation, opened in sidebar) or "additional".
 *
 */

function interactWith(account, address,
                      where, target, afterLoadAction) {
    if(typeof(where) == 'string') {
        // "where" is a url
        if(target == 'main') {
            if(conversations.isOpen(account, address))
                afterLoadAction(conversations.get(account, address));
            else
                createInteractionPanel(account, address,
                                       where, target, afterLoadAction);
        } else {
            createInteractionPanel(account, address,
                                   where, target, afterLoadAction);
        }
    } else
        // "where" is a content panel
        enableInteraction(account, address, where);
}

function enableInteraction(account, address, panel, createSocket) {
    XMPP.enableContentDocument(
        panel, account, address,
        isMUC(account, address) ? 'groupchat' : 'chat', createSocket);

    var url = panel.getAttribute('src');
    if(/^https?:\/\//.test(url))
        XMPP.send(account,
                  <presence to={address}>
                  <interact xmlns="http://dev.hyperstruct.net/xmpp4moz/protocol" url={url}/>
                  </presence>);
}

function createInteractionPanel(account, address,
                                url, container,
                                afterLoadAction) {
    var panel;
    if(container == 'additional') {
        if(!(url.match(/^javascript:/) ||
             getBrowser().contentDocument.location.href == 'about:blank'))
            getBrowser().selectedTab = getBrowser().addTab();
        
        panel = getBrowser().selectedBrowser;
    } else {
        panel = conversations.create(account, address);

        panel.addEventListener(
            'click', function(event) {
                clickedElementInConversation(event);
            }, true);

        panel.addEventListener(
            'dragdrop', function(event) {
                nsDragAndDrop.drop(event, chatDropObserver);
                event.stopPropagation();
            }, true);
    }

    // XMPP.enableContentDocument will set account and address as
    // well, but if several messages arrive in a flurry (as when
    // we come online and the server sends in those messages that
    // were addressed to us while we were offline) we will need to
    // identify the newly created panel *before*
    // XMPP.enableContentDocument has a chance to do its work.
    
    panel.setAttribute('account', account);
    panel.setAttribute('address', address);
    
    if(url.match(/^javascript:/)) {
        enableInteraction(account, address, panel, true);
        panel.loadURI(url);
    } else {
        queuePostLoadAction(
            panel, function(p) {
                panel.contentWindow.addEventListener(
                    'beforeunload', function(event) {
                        conversations.closed(account, address);
                    }, true);
                enableInteraction(account, address, panel);
                if(afterLoadAction)
                    afterLoadAction(panel);
            });
        panel.setAttribute('src', url);
    }

    return panel;
}


// GUI REACTIONS
// ----------------------------------------------------------------------

var chatDropObserver = {
    getSupportedFlavours: function () {
        var flavours = new FlavourSet();
        flavours.appendFlavour('text/html');
        flavours.appendFlavour('text/unicode');
        return flavours;
    },

    onDrop: function(event, dropdata, session) {
        if(!dropdata.data)
            return;

        var document = event.currentTarget.contentDocument;
        var dropTarget = event.target;

        document.getElementById('dnd-sink').textContent = (
            <data content-type={dropdata.flavour.contentType}>
            {dropdata.data}
            </data>
            ).toXMLString();

        var synthEvent = document.createEvent('Event');
        synthEvent.initEvent('hsDrop', true, false);
        dropTarget.dispatchEvent(synthEvent);
    }
};

function requestedAdditionalInteraction(event) {
    var conversation = conversations.current;
    var account = attr(conversation, 'account');
    var address = attr(conversation, 'address');
    var url = event.target.value;

    if(url == 'current')
        enableInteraction(account, address, getBrowser().selectedBrowser);
    else
        requestedCommunicate(account, address, url);
}

function requestedCommunicate(account, address, url) {
    if(url == getDefaultAppUrl())
        if(isMUC(account, address) && !conversations.isOpen(account, address))
            promptOpenConversation(account, address, isMUC(account, address) ? 'groupchat' : 'chat');
        else
            interactWith(
                account, address,
                url, 'main', function(conversation) {
                    conversations.focus(account, address);
                });
    else
        interactWith(account, address, url, 'additional');
}

function pressedKeyInContactField(event) {
    if(event.keyCode == KeyEvent.DOM_VK_RETURN)
        conversations.focusCurrent();
}

function clickedElementInConversation(event) {
    var ancestorAnchor = hasAncestor(event.target, 'a', ns_xhtml);
    if(ancestorAnchor) {
        var newTab;
        
        switch(event.button) {
        case 0: newTab = false; break;
        case 1: newTab = true;  break;
        }

        if(newTab != undefined) {
            openLink(ancestorAnchor.getAttribute('href'), newTab);
            event.preventDefault();
        }
    }
}

function requestedChangeStatusMessage(event) {
    if(event.keyCode != KeyEvent.DOM_VK_RETURN)
        return;

    var message = event.target.value;
    if(message != '[no status message]')
        changeStatusMessage(event.target.value);
    
    document.commandDispatcher.advanceFocus();
    conversations.focusCurrent();
}

function requestedAddContact() {
    var request = {
        contactAddress: undefined,
        subscribeToPresence: undefined,
        confirm: false,
        account: undefined
    };

    window.openDialog(
        'chrome://sameplace/content/add_contact.xul',
        'sameplace-add-contact', 'modal,centerscreen',
        request);

    if(request.confirm)
        contacts.addContact(request.account, request.contactAddress, request.subscribeToPresence);
}

function requestedCloseConversation(element) {
    var account = attr(element, 'account');
    var address = attr(element, 'address');

    if(isMUC(account, address))
        exitRoom(account, address,
                 XMPP.JID(getJoinPresence(account, address).stanza.@to).resource);

    conversations.close(account, address);
}

function requestedOpenConversation() {
    window.openDialog(
        'chrome://sameplace/content/open_conversation.xul',
        'sameplace-open-conversation', 'centerscreen', {});
}


// NETWORK ACTIONS
// ----------------------------------------------------------------------
// Application-dependent functions dealing with the network.
//
// They SHOULD NOT fetch information from the interface, a separate
// function should instead be created that calls these ones and passes
// the gathered data via function parameters.

function exitRoom(account, roomAddress, roomNick) {
    XMPP.send(account,
              <presence to={roomAddress + '/' + roomNick} type="unavailable">
              <x xmlns={ns_muc}/>
              </presence>);
}

function joinRoom(account, roomAddress, roomNick) {
    XMPP.send(account,
              <presence to={roomAddress + '/' + roomNick}>
              <x xmlns='http://jabber.org/protocol/muc'/>
              </presence>);
}

function getJoinPresence(account, address) {
    return XMPP.cache.find({
        event: 'presence',
        direction: 'out',
        account: account,
        stanza: function(s) {
                return (s.@to != undefined &&
                        s.ns_muc::x.length() > 0 &&
                        XMPP.JID(s.@to).address == address);
            }});
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function seenCachableMessage(message) {
    var account = message.session.name;
    var address = message.direction == 'in' ?
        XMPP.JID(message.stanza.@from).address : XMPP.JID(message.stanza.@to).address;
    if(!messageCache[account])
        messageCache[account] = {};
    if(!messageCache[account][address])
        messageCache[account][address] = [];
    var cache = messageCache[account][address];
    if(cache.length > 10)
        cache.shift();
    cache.push(message);
}

// XXX Refactor this and seenChatMessage

function seenOutgoingChatActivation(message) {
    var contact = XMPP.JID(message.stanza.@to);

    var conversation = conversations.get(message.session.name, contact.address);
    if(!conversation) 
        conversation = interactWith(
            message.session.name, contact.address,
            getDefaultAppUrl(), 'main',
            function(contentPanel) {
                conversations.focus(message.session.name, contact.address);
                conversations.opened(message.session.name,
                                     contact.address,
                                     message.stanza.@type);
                
                contentPanel.xmppChannel.receive(message);
            });
    else if(!conversation.contentDocument ||
            (conversation.contentDocument &&
             !conversation.contentDocument.getElementById('xmpp-incoming'))) {

        // If conversation widget exists but it has no contentDocument
        // yet, or its contentDocument does not have the xmpp-incoming
        // element yet, it means that it has not been loaded, so
        // queing for when it is.
        
        queuePostLoadAction(
            conversation, function(contentPanel) {
                contentPanel.xmppChannel.receive(message);
            });
    }
}

function seenChatMessage(message) {
    function maybeSetUnread(conversation) {
        if(message.direction == 'in' &&
           !conversations.isCurrent(message.session.name,
                                  XMPP.JID(message.stanza.@from).address))
            conversation.setAttribute('unread', 'true');
    }

    var contact = XMPP.JID(
        (message.stanza.@from != undefined ?
         message.stanza.@from : message.stanza.@to));

    var conversation = conversations.get(message.session.name, contact.address);
    if(!conversation) 
        conversation = interactWith(
            message.session.name, contact.address,
            getDefaultAppUrl(), 'main',
            function(contentPanel) {
                conversations.opened(message.session.name,
                                     contact.address,
                                     message.stanza.@type);

                contentPanel.xmppChannel.receive(message);
                maybeSetUnread(contentPanel);
            });
    else if(!conversation.contentDocument ||
            (conversation.contentDocument &&
             !conversation.contentDocument.getElementById('xmpp-incoming'))) {

        // If conversation widget exists but it has no contentDocument
        // yet, or its contentDocument does not have the xmpp-incoming
        // element yet, it means that it has not been loaded, so
        // queing for when it is.
        
        queuePostLoadAction(
            conversation, function(contentPanel) {
                contentPanel.xmppChannel.receive(message);
                maybeSetUnread(conversation);
            });
    } else
        maybeSetUnread(conversation);
}

function sentAvailablePresence(presence) {
    var status = presence.stanza.status.toString();
    if(status) {
        _('status-message').value = status;
        _('status-message').setAttribute('draft', 'false');
    } else {
        _('status-message').value = '[Click or Ctrl+Alt+T to change status]';
        _('status-message').setAttribute('draft', 'true');
    }
}

function sentMUCPresence(presence) {
    var room = XMPP.JID(presence.stanza.@to);
    var account = presence.session.name;
    var address = room.address;

    interactWith(
        account, address,
        getDefaultAppUrl(), 'main',
        function(interactionPanel) {
            conversations.opened(account, address);
            conversations.focus(account, address);
        });
}


// DEVELOPER UTILITIES
// ----------------------------------------------------------------------

function getStackTrace() {
    var frame = Components.stack.caller;
    var str = "<top>";

    while (frame) {
        str += '\n' + frame;
        frame = frame.caller;
    }

    return str;
}

function log(msg) {
    Cc[ "@mozilla.org/consoleservice;1" ]
        .getService(Ci.nsIConsoleService)
        .logStringMessage(msg);
}

function hoveredMousePointer(event) {
    if(!event.target.hasAttribute)
        return;

    var get = (event.target.hasAttribute('account')) ?
        (function(attributeName) { return event.target.getAttribute(attributeName); }) :
        (function(attributeName) { return getAncestorAttribute(event.target, attributeName); });

    top.document.getElementById('statusbar-display').label =
        'Account: <' + get('account') + '>, ' +
        'Address: <' + get('address') + '>, ' +
        'Resource: <' + get('resource') + '>, ' +
        'Subscription: <' + get('subscription') + '>'
}

