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

const pref = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');
const srvPrompt = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;
var messageCache = {};
var conversations = load('chrome://sameplace/content/facades/conversations.js');


// GUI INITIALIZATION AND FINALIZATION
// ----------------------------------------------------------------------

function init(event) {
    initNetworkReactions();
    initConversations();
    initCustomWidgets();
    initApplicationMenu();

    XMPP.accounts.filter(XMPP.isUp).forEach(function(account) {
        autojoinRooms(account.jid);
    });
}

function initNetworkReactions() {
    channel = XMPP.createChannel(
            <query xmlns="http://jabber.org/protocol/disco#info">
            <feature var="http://jabber.org/protocol/muc"/>
            <feature var="http://jabber.org/protocol/muc#user"/>
            <feature var="http://jabber.org/protocol/xhtml-im"/>
            <feature var="http://jabber.org/protocol/chatstates"/>
            </query>);

    channel.on({
        event     : 'message',
        direction : 'in',
        stanza    : function(s) {
            return ((s.@type != 'error' && s.body != undefined) ||
                    (s.@type == 'error'))
        }
    }, function(message) { seenDisplayableMessage(message); });

    channel.on({
        event     : 'message',
        direction : 'out',
        stanza    : function(s) {
            return s.body.text() != undefined && s.@type != 'groupchat';
        }
    }, function(message) { seenDisplayableMessage(message) });
    
    channel.on({
        event     : 'message',
        direction : 'out',
        stanza    : function(s) {
            return s.ns_chatstates::active != undefined;
        }
    }, function(message) { seenOutgoingChatActivation(message); });
    
    channel.on({
        event  : 'message',
        stanza : function(s) {
            return s.@type != 'error' && s.body.text() != undefined;
        }
    }, function(message) { seenCachableMessage(message); });
    
    channel.on({
        event     : 'presence',
        direction : 'out',
        stanza    : function(s) {
            return s.ns_muc::x.length() > 0 && s.@type != 'unavailable'; 
       }
    }, function(presence) { sentMUCPresence(presence) });

    channel.on({
        event     : 'presence',
        direction : 'out',
        stanza    : function(s) {
            return (s.@type == undefined || s.@type == 'unavailable') &&
                s.ns_muc::x == undefined && s.@to == undefined;
        }
    }, function(presence) { sentAvailablePresence(presence) });
}

function initConversations() {
    switch(pref.getCharPref('conversationsArea')) {
    case 'appcontent':
        // This is the main browser/mail area.  We act as an off-site
        // manager for it.
        conversations.ui =
            top.document.getElementById('sameplace-conversations') ||
            top.getBrowser();
        conversations.init(conversations.ui, false);
        break;
    case 'left':
    case 'right':
        tabbedArea(_('conversations'), _('conversation-tabs'));
        conversations.ui = _('conversations');
        conversations.init(conversations.ui, false);
        break;
    default:
        break;
    }

    conversations.ui.addEventListener(
        'conversation/open', function(event) {
            if(getBrowser() && typeof(getBrowser().addTab) == 'function')
                _('contact-toolbox', {role: 'attach'}).hidden = false;
        }, false);

    conversations.ui.addEventListener(
        'conversation/focus', function(event) {
            _('contact').value = XMPP.nickFor(
                event.originalTarget.getAttribute('account'),
                event.originalTarget.getAttribute('address'));
        }, false);

    conversations.ui.addEventListener(
        'conversation/close', function(event) {
            var panel = event.originalTarget;
            var account = attr(panel, 'account');
            var address = attr(panel, 'address');
            
            if(XMPP.isMUC(account, address))
                exitRoom(account, address,
                         XMPP.JID(getJoinPresence(account, address).stanza.@to).resource);

            if(conversations.count == 1) {
                _('contact-toolbox', {role: 'attach'}).hidden = true;
                _('contact').value = '';
            }
        }, false);
}

function initCustomWidgets() {
    // Setting up contact autocompletion

    autoComplete(_('contact'));

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

            conversations.ui.contentWindow.focus();
            startInteraction(event.target.getAttribute('account'),
                             event.target.getAttribute('address'));
        }, false);
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
        continuation(null, e);
    }
}


// GUI UTILITIES (SPECIFIC)
// ----------------------------------------------------------------------
// Application-dependent functions dealing with interface.  They do
// not affect the domain directly.

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

function getBrowser() {
    if(top.getBrowser)
        return top.getBrowser();

    return undefined;
}


// GUI ACTIONS
// ----------------------------------------------------------------------
// Application-dependent functions dealing with user interface.  They
// affect the domain.

function isReceivingInput() {
    return (document.commandDispatcher.focusedWindow == _('conversations').contentWindow ||
            document.commandDispatcher.focusedWindow.parent == _('conversations').contentWindow);
}

function hide() {
    top.sameplace.frameFor('conversations').collapsed = true;
}

function initApplicationMenu() {
    var menuPopup = _('menu-applications');
    fetchFeed('http://apps.sameplace.cc/feed.xml', function(feed, e) {
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
    contactCompletionsFor(xulCompletions.parentNode.value).forEach(
        function(completion) {
            var address, label;
            if(completion.stanza.ns_muc::x != undefined) {
                address = XMPP.JID(completion.stanza.@to).address;
                label = address;
            } else {
                address = XMPP.JID(completion.stanza.@from).address;
                label = XMPP.nickFor(completion.account, address);
            }

            var xulCompletion = document.createElement('menuitem');
            xulCompletion.setAttribute('class', 'menuitem-iconic');
            xulCompletion.setAttribute('label', label);
            xulCompletion.setAttribute('account', completion.account);
            xulCompletion.setAttribute('address', address);
            xulCompletion.setAttribute('availability', completion.stanza.@type.toString() || 'available');
            xulCompletion.setAttribute('show', completion.stanza.show.toString());
            xulCompletions.appendChild(xulCompletion);
        });
}

function updateAttachTooltip() {
    _('attach-tooltip', {role: 'message'}).value =
        'Make this conversation channel available to ' +
        getBrowser().currentURI.spec;
}

/**********************************************************************

Begins an interaction.

At the very least, an interaction is described by the contact we're
interacting with (which in turn described by {account, address})
and by the content panel the interaction is taking place in.  Most
of the time (but optionally) it will also entail an URL to load in
the content panel, either to replace the current one, or to augment
it (e.g. javascript: URLs).

Optionally, execute some code once the panel is ready.

interact() does not create panels by itself, it's the caller's
responsibility to provide one.

Usage samples:

- Creating a panel, loading an application (given the url), and
  interacting with a contact (given by {contact, address}) within the
  application:

  var panel = conversations.create(account, address);
  interact(account, address, url, panel);

- Open an interaction in an arbitrary (i.e. not wrapped by a
  conversations object) tabbed browser, using the currently loaded
  application:

  var panel = getBrowser().selectedBrowser;
  interact(account, address, null, panel);

- Use an existing panel to interact, after having enriched its
  content with a remote script (probably enabling collaborative
  capabilities on an otherwise static page):

  var panel = getBrowser().selectedBrowser;
  interact(account, address, 'javascript:...', panel);

**********************************************************************/

function interact(account, address, url, panel, nextAction) {
    function activate() {
        XMPP.connectPanel(panel, account, address, /^javascript:/.test(url));
    }

    function notifyContact() {
        if(url != getDefaultAppUrl())
            XMPP.send(account,
                      <message to={address}>
                      <share xmlns={ns_x4m_ext} url={panel.currentURI.spec}/>
                      </message>);
    }

    nextAction = nextAction || function() {};
    panel.setAttribute('account', account);
    panel.setAttribute('address', address);

    if(!url) {
        activate();
        notifyContact();
        nextAction();
    }
    else if(url.match(/^javascript:/)) {
        panel.loadURI(url);
        activate();
        nextAction();
    }
    else {
        afterLoad(panel, function(panel) {
            activate();
            notifyContact();
            nextAction();
        });
        panel.setAttribute('src', url);
    }
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

// There seems to be no way for a window to know when it comes into
// view because its containing frame is un-collapsed, thus, we expose
// this so that the un-collapser may call it and let us know we are
// visible.  As a consequence of coming into view, we check whethere
// there is any current conversation, and if so, we in turn force a
// focused event on it.

function shown() {
    if(conversations.current)
        conversations.focused(conversations.current.getAttribute('account'),
                              conversations.current.getAttribute('address'));
}

function requestedAdditionalInteraction(event) {
    var conversation = conversations.current;
    var account = attr(conversation, 'account');
    var address = attr(conversation, 'address');
    var url = event.target.value;

    if(!(url.match(/^javascript:/) || getBrowser().currentURI.spec == 'about:blank' || url == 'current'))
        getBrowser().selectedTab = getBrowser().addTab();
    
    interact(account, address, url == 'current' ? null : url, getBrowser().selectedBrowser);
}

// Front-end to interact().  Start an interaction with a contact.
//
// interact() needs the panel where interaction will happen,
// startInteraction() does not -- it will open interaction in the
// local area.
//
// The url parameter is optional; if not given, will use the result of
// getDefaultAppUrl().
//
// Limitations: effectively assumes only one interaction per contact,
// since it checks for existing interactions based on {account,
// address} instead of {account, address, url}.

function startInteraction(account, address, url) {
    url = url || getDefaultAppUrl();

    // Short-circuit in case conversation is already open.
    if(conversations.isOpen(account, address)) {
        conversations.focus(account, address);
        return;
    }
    
    // If user joins a room then leaves it, entry is kept in contact
    // list.  If later he clicks on it, we will only receive {account,
    // address} coordinates, and no clue that it's a room, not a
    // person.  Since the course of action for opening a multi-user
    // conversation is different, we need the following check.
    if(XMPP.isMUC(account, address) && !conversations.isOpen(account, address)) {
        window.openDialog('chrome://sameplace/content/join_room.xul',
                          'sameplace-open-conversation', 'centerscreen',
                          account, address);
    } else {
        var panel = conversations.create(account, address);
        initPanel(panel); // XXX initPanel-after-create: repeated pattern, factor?
        interact(account, address, url, panel, function() {
            if(messageCache[account] && messageCache[account][address]) {
                messageCache[account][address].forEach(function(message) {
                    panel.xmppChannel.receive(message);
                });
            }
            conversations.focus(account, address);
        });
    }
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

function requestedOpenConversation(type) {
    switch(type) {
    case 'chat':
        window.openDialog(
            'chrome://sameplace/content/open_conversation.xul',
            'sameplace-open-conversation', 'centerscreen', null, 'contact@server.org');
        break;
    case 'groupchat':
        window.openDialog(
            'chrome://sameplace/content/join_room.xul',
            'sameplace-join-room', 'centerscreen', null, 'users@places.sameplace.cc');
        break;
    default:
        throw new Error('Unexpected. (' + type + ')');
    }
}


// NETWORK ACTIONS
// ----------------------------------------------------------------------
// Application-dependent functions dealing with the network.
//
// They SHOULD NOT fetch information from the interface, a separate
// function should instead be created that calls these ones and passes
// the gathered data via function parameters.

function autojoinRooms(account) {
    function delayedJoinRoom(account, roomAddress, roomNick, delay) {
        window.setTimeout(
            function() {
                joinRoom(account, roomAddress, roomNick);
            }, delay);
    }

    XMPP.send(account,
              <iq type="get">
              <query xmlns={ns_private}>
              <storage xmlns={ns_bookmarks}/>
              </query>
              <cache-control xmlns={ns_x4m_in}/>
              </iq>,
              function(reply) {
                  if(reply.stanza.@type != 'result')
                      return;
                  var delay = 500;
                  for each(var conf in reply
                           .stanza.ns_private::query
                           .ns_bookmarks::storage
                           .ns_bookmarks::conference) {
                      if(conf.@autojoin == 'true') {
                          delayedJoinRoom(account, conf.@jid, XMPP.JID(account).username, delay)
                          delay += 1000;
                      }
                  }
              });
}

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

    var panel = conversations.get(message.account, contact.address);
    if(!panel) {
        panel = conversations.create(message.account, contact.address);
        initPanel(panel);
        interact(message.account, contact.address, getDefaultAppUrl(), panel, function() {
            conversations.focus(message.account, contact.address);
            panel.xmppChannel.receive(message);
        });
    }
    else if(!panel.contentDocument ||
            (panel.contentDocument &&
             !panel.contentDocument.getElementById('xmpp-incoming'))) {
        
        // If conversation widget exists but it has no contentDocument
        // yet, or its contentDocument does not have the xmpp-incoming
        // element yet, it means that it has not been loaded, so
        // queing for when it is.
        
        afterLoad(panel, function(panel) {
            panel.xmppChannel.receive(message);
        });
    }
}

function seenDisplayableMessage(message) {
    if(message.stanza.ns_http_auth::confirm != undefined)
        // Balk at auth requests since these are handled elsewhere.
        // We have to do this since auth requests usually have a
        // <body> and upstream channel listener will send them our
        // way.
        return;

    function maybeSetUnread(conversation) {
        if(message.direction == 'in' &&
           !conversations.isCurrent(message.session.name,
                                  XMPP.JID(message.stanza.@from).address))
            conversation.setAttribute('unread', 'true');
    }

    var contact = XMPP.JID(
        (message.stanza.@from != undefined ?
         message.stanza.@from : message.stanza.@to));

    var panel = conversations.get(message.account, contact.address);
    if(!panel) {
        panel = conversations.create(message.account, contact.address);
        initPanel(panel);
        interact(message.account, contact.address, getDefaultAppUrl(), panel, function() {

            if(messageCache[message.account] && messageCache[message.account][contact.address]) {
                messageCache[message.account][contact.address].forEach(function(message) {
                    panel.xmppChannel.receive(message);
                });
            }

            // XXX was missing before -- might solve problems with
            // lost messages -- using messageCache as above should
            // work, too, but re-enable this line if message cache is
            // removed
            // panel.xmppChannel.receive(message);
            
            maybeSetUnread(panel);
        });
    }
    else if(!panel.contentDocument ||
            (panel.contentDocument &&
             !panel.contentDocument.getElementById('xmpp-incoming'))) {

        // If conversation widget exists but it has no contentDocument
        // yet, or its contentDocument does not have the xmpp-incoming
        // element yet, it means that it has not been loaded, so
        // queing for when it is.
        
        afterLoad(panel, function(panel) {
            panel.xmppChannel.receive(message);
            maybeSetUnread(panel);
        });
    } else
        maybeSetUnread(panel);
}

function sentAvailablePresence(presence) {
    autojoinRooms(presence.account);
}

function sentMUCPresence(presence) {
    var room = XMPP.JID(presence.stanza.@to);
    var account = presence.session.name;
    var address = room.address;

    var panel = conversations.get(account, address);
    if(!panel) {
        panel = conversations.create(account, address);
        initPanel(panel);
        interact(account, address, getDefaultAppUrl(), panel, function() {
            conversations.focus(account, address);
        })
    }
}

function initPanel(panel) {
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

function getMostRecentWindow() {
    return Cc['@mozilla.org/appshell/window-mediator;1']
        .getService(Ci.nsIWindowMediator)
        .getMostRecentWindow('navigator:browser');
}
