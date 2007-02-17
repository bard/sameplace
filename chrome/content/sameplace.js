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


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;


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
        {event: 'presence', direction: 'out', stanza: function(s) {
                return s.ns_muc::x.length() > 0 && s.@type != 'unavailable';
            }}, function(presence) { sentMUCPresence(presence) });

    contacts = _('contacts').contentWindow;
    contacts.onRequestedCommunicate = requestedCommunicate;

    XMPP.cache.presenceOut.forEach(sentAvailablePresence);

    _('conversations').addEventListener(
        'DOMNodeInserted', function(event) {
            if(event.target instanceof XULElement &&
               event.target.parentNode == _('conversations')) {
                var hideConversations = _('conversations').childNodes.length == 0;
                _('conversations').collapsed = hideConversations;
                _('contact-toolbox', {role: 'close'}).hidden = hideConversations;
                _('contact-toolbox', {role: 'attach'}).hidden = hideConversations;
                if(hideConversations)
                    _('contact').value = '';
            }
        }, false);

    _('conversations').addEventListener(
        'DOMNodeRemoved', function(event) {
            if(event.target instanceof XULElement &&
               event.target.parentNode == _('conversations')) {
                var hideConversations = _('conversations').childNodes.length == 1;
                _('contact-toolbox', {role: 'close'}).hidden = hideConversations;
                _('contact-toolbox', {role: 'attach'}).hidden = hideConversations;
                if(hideConversations)
                    _('contact').value = '';
            }
        }, false);

    behaviour.autoComplete(_('contact'));

    _('contact').addEventListener(
        'complete', function(event) {
            buildContactCompletions(event.target);
        }, false);

    _('contact').addEventListener(
        'completed', function(event) {
            requestedCommunicate(
                event.target.getAttribute('account'),
                event.target.getAttribute('address'),
                getDefaultAppUrl());
        }, false);
}

function finish() {
    for(var conversation, i=0; conversation = _('conversations').childNodes[i]; i++)
        closeConversation(
            conversation.getAttribute('account'),
            conversation.getAttribute('address'));

    channel.release();
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

function isConversationOpen(account, address) {
    return getConversation(account, address) != undefined;
}

function isConversationCurrent(account, address) {
    return getCurrentConversation() == getConversation(account, address);
}

function getCurrentConversation() {
    return _('conversations').selectedPanel;
}

if(typeof(x) == 'function') {
    function getConversation(account, address) {    
        return x('//*[@id="conversations"]' +
                 '//*[@account="' + account + '" and ' +
                 '    @address="' + address + '"]');
    }
} else {
    function getConversation(account, address) {
        var conversationsForAccount =
            _('conversations').getElementsByAttribute('account', account);
        for(var i=0; i<conversationsForAccount.length; i++){
            if(conversationsForAccount[i].getAttribute('address') == address)
                return conversationsForAccount[i];
        }
        return undefined;
    }
}


// GUI ACTIONS
// ----------------------------------------------------------------------
// Application-dependent functions dealing with user interface.  They
// affect the domain.

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
            var nick = XMPP.nickFor(account, address);
            var presence = XMPP.presenceSummary(account, address);
            if(nick.toLowerCase().indexOf(input.toLowerCase()) == 0)
                completions.push({
                    label: nick,
                    account: account,
                    address: address,
                    show: presence.stanza.show.toString(),
                    presence: presence,
                    availability: presence.stanza.@type.toString() || 'available' });
        }
    }

    for each(var presence in XMPP.cache.presenceOut)
        if(presence.stanza && presence.stanza.ns_muc::x.length() > 0) {
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
        }

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

function switchToUnread() {
    var conversation = _('conversations').firstChild;
    while(conversation) {
        if(conversation.getAttribute('unread') == 'true') {
            focusConversation(conversation.getAttribute('account'),
                              conversation.getAttribute('address'));
            return;
        }
        conversation = conversation.nextSibling;
    }
}

function switchToNext() {
    var current = getCurrentConversation();
    var next;

    if(!current || current == _('conversations').firstChild)
        next = _('conversations').lastChild;
    else
        next = current.previousSibling;

    if(next)
        focusConversation(next.getAttribute('account'),
                          next.getAttribute('address'));
}

function openInBrowser(url, newTab) {
    if(url.match(/^javascript:/)) {
        srvPrompt.alert(
            window, 'SamePlace: Security Notification',
            'This link contains javascript code and has been disabled as a security measure.');
        return;
    }

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
            var stanza;
            for each(var presence in XMPP.cache.presenceOut)
                if(presence.session.name == account.jid) {
                    stanza = presence.stanza.copy();
                    if(message)
                        stanza.status = message;
                    else
                        delete stanza.status;
                    break;
                }

            if(!stanza) {
                if(message)
                    stanza = <presence><status>{message}</status></presence>;
                else
                    stanza = <presence/>;
            }

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

function interactWith(account, address, resource,
                      where, target, afterLoadAction) {
    if(typeof(where) == 'string')
        // "where" is a url
        if(isConversationOpen(account, address)) {
            focusConversation(account, address);
            afterLoadAction(getConversation(account, address));
        } else
            createInteractionPanel(account, address, resource,
                                   where, target, afterLoadAction);
    else
        // "where" is a content panel
        XMPP.enableContentDocument(where, account, address,
                                   isMUC(account, address) ? 'groupchat' : 'chat');
}

function createInteractionPanel(account, address, resource,
                                url, target,
                                afterLoadAction) {
    switch(target) {
    case 'additional':
        if(!(url.match(/^javascript:/) ||
             getBrowser().contentDocument.location.href == 'about:blank')) {
            getBrowser().selectedTab = getBrowser().addTab();

            var contentPanel = getBrowser().selectedBrowser;

            queuePostLoadAction(
                contentPanel, function(document) {
                    XMPP.enableContentDocument(contentPanel, account, address,
                                               isMUC(account, address) ? 'groupchat' : 'chat');
                    if(afterLoadAction)
                        afterLoadAction(contentPanel);
                });

            contentPanel.loadURI(url);
        }
            
        return contentPanel;
        break;

    case 'main':
        var conversation = cloneBlueprint('conversation');
        _('conversations').appendChild(conversation);
        conversation.setAttribute('resource', resource);

        conversation.addEventListener(
            'click', function(event) {
                clickedElementInConversation(event);
            }, true);

        queuePostLoadAction(
            conversation, function(document) {
                XMPP.enableContentDocument(conversation, account, address, 
                                           isMUC(account, address) ? 'groupchat' : 'chat');
                if(afterLoadAction)
                    afterLoadAction(conversation);
            });

        // XMPP.enableContentDocument will set account and address as
        // well, but if several messages arrive in a flurry (as when
        // we come online and the server sends in those messages that
        // were addressed to us while we were offline) we will need to
        // identify the newly created panel *before*
        // XMPP.enableContentDocument has a chance to do its work.
        
        conversation.setAttribute('account', account);
        conversation.setAttribute('address', address);        
        conversation.setAttribute('src', url);
        return conversation;
        break;

    default:
        throw new Error('Unexpected. (' + target + ')');
        break;
    }
    return undefined;
}

function focusCurrentConversation() {
    var conversation = getCurrentConversation();

    if(conversation) {
        conversation.contentWindow.focus();
        document.commandDispatcher.advanceFocus(); //XXX maybe not needed
    }
}

function focusConversation(account, address) {
    var conversation = getConversation(account, address);

    if(conversation) {
        _('conversations').selectedPanel = conversation;
        focusedConversation(account, address);
        conversation.contentWindow.focus();
        document.commandDispatcher.advanceFocus();
    }
}

function closeConversation(account, address) {
    var conversation = getConversation(account, address);

    if(conversation) {
        conversation.parentNode.removeChild(conversation);
        closedConversation(account, address);
    }
}

function promptOpenConversation(account, address, type, nick) {
    var request = {
        address: address,
        account: account,
        type: type,
        nick: nick,
        confirm: false
    }

    window.openDialog(
        'chrome://sameplace/content/open_conversation.xul',
        'sameplace-open-conversation', 'modal,centerscreen',
        request);   

    if(request.confirm)
        if(request.type == 'groupchat')
            joinRoom(request.account, request.address, request.nick);
        else
            interactWith(
                request.account, request.address, null,
                getDefaultAppUrl(), 'main', function(conversation) {
                    focusConversation(request.account, request.address);
                    openedConversation(request.account, request.address);
                });
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

function requestedCommunicate(account, address, url) {
    if(url == getDefaultAppUrl())
        if(isMUC(account, address) && !isConversationOpen(account, address))
            promptOpenConversation(account, address, isMUC(account, address) ? 'groupchat' : 'chat');
        else
            interactWith(
                account, address, null,
                url, 'main', function(conversation) {
                    focusConversation(account, address);
                    openedConversation(account, address);
                });
    else
        interactWith(account, address, null, url, 'additional');
}

function pressedKeyInContactField(event) {
    if(event.keyCode == KeyEvent.DOM_VK_RETURN)
        focusCurrentConversation();
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
            openInBrowser(ancestorAnchor.getAttribute('href'), newTab);
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
    focusCurrentConversation();
}

function focusedConversation(account, address) {
    getConversation(account, address).removeAttribute('unread');
    contacts.nowTalkingWith(account, address);
    _('contact').value = XMPP.nickFor(account, address);
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

function requestedAttachBrowser(element) {
    interactWith(attr(element, 'account'),
                 attr(element, 'address'),
                 attr(element, 'resource'),
                 getBrowser().selectedBrowser);
}

function requestedCloseConversation(element) {
    var account = attr(element, 'account');
    var address = attr(element, 'address');
    var resource = attr(element, 'resource');

    if(isMUC(account, address))
        exitRoom(account, address, resource);

    closeConversation(account, address);
}

function requestedOpenConversation() {
    promptOpenConversation();    
}

function openedConversation(account, address) {
    contacts.startedConversationWith(account, address);
    
    if(_('conversations').childNodes.length == 1)
        contacts.nowTalkingWith(account, address);
}

function closedConversation(account, address) {
    contacts.stoppedConversationWith(account, address);
    if(_('conversations').childNodes.length == 0)
        _('conversations').collapsed = true;
    else {
        var conversation =
            _('conversations').selectedPanel ||
            _('conversations').lastChild;
        focusConversation(conversation.getAttribute('account'),
                          conversation.getAttribute('address'));
    }
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

function isMUC(account, address) {
    for each(var presence in XMPP.cache.presenceOut)
        if(presence.stanza.@to != undefined &&
           XMPP.JID(presence.stanza.@to).address == address &&
           presence.stanza.ns_muc::x.length() > 0)
            return true;

    return false;
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function seenChatMessage(message) {
    function maybeSetUnread(conversation) {
        if(message.direction == 'in' &&
           !isConversationCurrent(message.session.name,
                                  XMPP.JID(message.stanza.@from).address))
            conversation.setAttribute('unread', 'true');
    }

    var contact = XMPP.JID(
        (message.stanza.@from != undefined ?
         message.stanza.@from : message.stanza.@to));

    var conversation = getConversation(message.session.name, contact.address);
    if(!conversation) 
        conversation = interactWith(
            message.session.name, contact.address, contact.resource,
            getDefaultAppUrl(), 'main',
            function(contentPanel) {
                openedConversation(message.session.name,
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
    _('status-message').value = presence.stanza.status.toString() || '[no status message]';
    _('status-message').setAttribute('draft', 'false');
}

function sentMUCPresence(presence) {
    var room = XMPP.JID(presence.stanza.@to);
    var account = presence.session.name;
    var address = room.address;
    var resource = room.resource;

    interactWith(
        account, address, resource,
        getDefaultAppUrl(), 'main',
        function(interactionPanel) {
            openedConversation(account, address);
            focusConversation(account, address);
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

