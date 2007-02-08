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

const ns_muc_user = 'http://jabber.org/protocol/muc#user';
const ns_muc      = 'http://jabber.org/protocol/muc';
const ns_xul      = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const ns_roster   = 'jabber:iq:roster';
const ns_xhtml_im = 'http://jabber.org/protocol/xhtml-im';
const ns_xhtml    = 'http://www.w3.org/1999/xhtml';


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
        <feature var='http://jabber.org/protocol/xhtml-im'/>
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

    new AutoComplete(
        _('contact'), _('contact-completions'),
        function(input, xulCompletions) {
            for each(var iq in XMPP.cache.roster) {
                for each(var item in iq.stanza..ns_roster::item) {
                    var account = iq.session.name;
                    var address = item.@jid;
                    var nick = XMPP.nickFor(account, address);
                    var presence = XMPP.presenceSummary(account, address);
                    if(nick.toLowerCase().indexOf(input.toLowerCase()) == 0) {
                        var xulCompletion = document.createElement('menuitem');
                        xulCompletion.setAttribute('class', 'menuitem-iconic');
                        xulCompletion.setAttribute('label', nick);
                        xulCompletion.setAttribute('value', account + ' ' + address);
                        xulCompletion.setAttribute('availability', presence.stanza.@type.toString() || 'available');
                        xulCompletion.setAttribute('show', presence.stanza.show.toString());
                        xulCompletions.appendChild(xulCompletion);
                    }
                }
            }
        },
        function(choice) {
            var parts = choice.split(' ');
            var account = parts[0];
            var address = parts[1];
            requestedCommunicate(account, address, 'chat', getDefaultAppUrl());
        });
}

function finish() {
    for(var conversation, i=0; conversation = _('conversations').childNodes[i]; i++)
        closeConversation(
            attr(conversation, 'account'), attr(conversation, 'address'));

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

function withConversation(account, address, resource, type, forceOpen, action) {
    var conversation = getConversation(account, address);

    if(!conversation && forceOpen)
        interactWith(
            account, address, resource, type,
            getDefaultAppUrl(), 'main',
            function(contentPanel) {
                action(contentPanel);
                openedConversation(account, address, type);
            });
    else
        action(conversation.contentDocument);
}

if(typeof(x) == 'function') {
    function getConversation(account, address) {    
        return x('//*[@id="conversations"]' +
                 '//*[@account="' + account + '" and ' +
                 '    @address="' + address + '"]');
    }
} else {
    function getConversation(account, address){
        var conversationsForAccount =
            _('conversations').getElementsByAttribute('account', account);
        for(var i=0; i<conversationsForAccount.length; i++){
            if(conversationsForAccount[i].getAttribute('address') == address)
                return conversationsForAccount[i];
        }
    }
}


// GUI ACTIONS
// ----------------------------------------------------------------------
// Application-dependent functions dealing with user interface.  They
// affect the domain.

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

function interactWith(account, address, resource, type,
                      where, target, afterLoadAction) {
    if(typeof(where) == 'string') 
        // "where" is a url
        createInteractionPanel(account, address, resource, type,
                               where, target, afterLoadAction);
    else
        // "where" is a content panel
        XMPP.enableContentDocument(where, account, address, type);
}

function createInteractionPanel(account, address, resource, type,
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
                    XMPP.enableContentDocument(contentPanel, account, address, type);
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
        conversation.setAttribute('message-type', type);

        // XMPP.enableContentDocument will set this as well, but if
        // several messages arrive in a flurry (is when we come online
        // and the server sends in those messages that were addressed
        // to us while we were offline) we will need to identify the
        // newly created panel *before* XMPP.enableContentDocument has
        // a chance to do its work.
        
        conversation.setAttribute('account', account);
        conversation.setAttribute('address', address);
        
        conversation.addEventListener(
            'click', function(event) {
                clickedElementInConversation(event);
            }, true);

        queuePostLoadAction(
            conversation, function(document) {
                XMPP.enableContentDocument(conversation, account, address, type);
                if(afterLoadAction)
                    afterLoadAction(conversation);
            });

        conversation.contentDocument.location.href = url;
        return conversation;
        break;

    default:
        throw new Error('Unexpected. (' + target + ')');
        break;
    }
}

function focusCurrentConversation() {
    var conversation = getCurrentConversation2();

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
            if(isConversationOpen(request.account, request.address))
                focusConversation(request.account, request.address);
            else
                withConversation(
                    request.account, request.address, null, 'chat', true, 
                    function() {
                        focusConversation(request.account, request.address);
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

function requestedCommunicate(account, address, type, url) {
    if(url == getDefaultAppUrl()) {
        if(type == 'groupchat' && !isConversationOpen(account, address))        
            promptOpenConversation(account, address, type);
        else 
            withConversation(
                account, address, null, type, true, function() {
                    focusConversation(account, address);
                });
    } else
        interactWith(
            account, address, null, type,
            url, 'additional');
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
}

function focusedConversation(account, address) {
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
                 attr(element, 'message-type'),
                 getBrowser().selectedBrowser);
}

function requestedCloseConversation(element) {
    if(attr(element, 'message-type') == 'groupchat')
        exitRoom(attr(element, 'account'),
                 attr(element, 'address'),
                 attr(element, 'resource'));

    closeConversation(attr(element, 'account'),
                      attr(element, 'address'),
                      attr(element, 'resource'),
                      attr(element, 'message-type'));
}

function requestedOpenConversation() {
    promptOpenConversation();    
}

function openedConversation(account, address, type) {
    contacts.startedConversationWith(account, address, type);
    
    if(_('conversations').childNodes.length == 1)
        contacts.nowTalkingWith(account, address);
}

function closedConversation(account, address) {
    contacts.stoppedConversationWith(account, address);
    if(_('conversations').childNodes.length == 0)
        _('conversations').collapsed = true;
    else if(!_('conversations').selectedPanel) {
        _('conversations').selectedPanel = _('conversations').lastChild;
        focusedConversation(
            _('conversations').lastChild.getAttribute('account'),
            _('conversations').lastChild.getAttribute('address'));
    } else
        focusedConversation(
            _('conversations').selectedPanel.getAttribute('account'),
            _('conversations').selectedPanel.getAttribute('address'));
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
              <presence to={roomAddress + '/' + roomNick} type="unavailable"/>);
}

function joinRoom(account, roomAddress, roomNick) {
    XMPP.send(account,
              <presence to={roomAddress + '/' + roomNick}>
              <x xmlns='http://jabber.org/protocol/muc'/>
              </presence>);
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function seenChatMessage(message) {
    var contact = XMPP.JID(
        (message.stanza.@from != undefined ?
         message.stanza.@from : message.stanza.@to));

    var wConversation = getConversation(message.session.name, contact.address);
    if(!wConversation) {
        interactWith(
            message.session.name, contact.address,
            contact.resource, message.stanza.@type,
            getDefaultAppUrl(), 'main',
            function(contentPanel) {
                openedConversation(message.session.name,
                                   contact.address,
                                   message.stanza.@type);
                contentPanel.xmppChannel.receive(message);
            });
    } else {
        // with wConversation formerly being the container of
        // conversation, this was always true.        
        //if(!wConversation.contentDocument ||
        //(wConversation.contentDocument &&
        //!wConversation.contentDocument.getElementById('xmpp-incoming')))
        //{

        queuePostLoadAction(
            wConversation, function(contentPanel) {
                contentPanel.xmppChannel.receive(message);
            });
    }

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
    var type = 'groupchat';

    interactWith(
        account, address, resource, type,
        getDefaultAppUrl(), 'main',
        function(interactionPanel) {
            openedConversation(account, address, type);
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
        'Subscription: <' + get('subscription') + '>, ' +
        'Type: <' + get('message-type') + '>';
}

