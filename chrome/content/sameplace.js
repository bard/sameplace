// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;

const prefBranch = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');
const pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefBranch);
const mediator = Cc['@mozilla.org/appshell/window-mediator;1']
    .getService(Ci.nsIWindowMediator);
const prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);

const ns_muc_user = new Namespace('http://jabber.org/protocol/muc#user');
const ns_muc = new Namespace('http://jabber.org/protocol/muc');
const ns_xul = new Namespace('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul');
const ns_roster = new Namespace('jabber:iq:roster');

// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;
var debugMode = false;


// GUI INITIALIZATION AND FINALIZATION
// ----------------------------------------------------------------------

function init(event) {
    if(!event.target)
        return;

    _('contacts').selectedIndex = -1;

    channel = XMPP.createChannel();

    channel.on(
        {event: 'iq', direction: 'in', stanza: function(s) {
                return s.ns_roster::query.length() > 0;
            }},
        function(iq) { receivedRoster(iq); });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.@type == undefined || s.@type == 'unavailable';
            }},
        function(presence) { receivedPresence(presence) });
    channel.on(
        {event: 'presence', direction: 'out', stanza: function(s) {
                return s.@type == undefined || s.@type == 'unavailable';
            }},
        function(presence) { sentPresence(presence) });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.body.length() > 0 && s.@type != 'error';
            }}, function(message) { receivedChatMessage(message); });
    channel.on(
        {event: 'message', direction: 'out', stanza: function(s) {
                return s.body.length() > 0 && s.@type != 'groupchat';
            }}, function(message) { sentChatMessage(message) });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.@type == 'subscribed';
            }},
        function(presence) { receivedSubscriptionApproval(presence); });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.@type == 'subscribe';
            }},
        function(presence) { receivedSubscriptionRequest(presence); });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.ns_muc_user::x.length() > 0;
            }}, function(presence) { receivedMUCPresence(presence) });
    channel.on(
        {event: 'presence', direction: 'out', stanza: function(s) {
                return s.ns_muc::x.length() > 0 && s.@type != 'unavailable';
            }}, function(presence) { sentMUCPresence(presence) });
    channel.on(
        {event: 'message', direction: 'in'},
        function(message) {
            contacts.gotMessageFrom(
                message.session.name, XMPP.JID(message.stanza.@from).address);
        });

    if(debugMode) {
        document.addEventListener(
            'mouseover', function(event) {
                hoveredMousePointer(event);
            }, false);
        _('devel-shortcut').hidden = false;
    }

    for each(var pluginInfo in prefBranch.getChildList('plugin.', {})) {
        var pluginOverlayURL = prefBranch.getCharPref(pluginInfo);
        document.loadOverlay(pluginOverlayURL, null);
    }

    XMPP.cache.roster.forEach(receivedRoster);
    XMPP.cache.presenceIn.forEach(receivedPresence);
    XMPP.cache.presenceOut.forEach(sentPresence);

    _('conversations').addEventListener(
        'DOMNodeInserted', function(event) {
            _('box-conversations').collapsed = 
                (_('conversations').childNodes.length == 0);
        }, false);

    _('conversations').addEventListener(
        'DOMNodeRemoved', function(event) {
            _('box-conversations').collapsed = 
                (_('conversations').childNodes.length == 0);
        }, false);
}

function finish() {
    for(var conversation, i=0; conversation = _('conversations').childNodes[i]; i++)
        closeConversation(
            attr(conversation, 'account'), attr(conversation, 'address'));

    channel.release();
}

// SUBSYSTEMS
// ----------------------------------------------------------------------

var contacts = {
    // interface glue

    get: function(account, address) {
        return x('//*[@id="contacts"]//*[' +
                 '@address="' + address + '" and ' +
                 '@account="' + account + '"]');
    },

    add: function(account, address) {
        var contact;
        contact = cloneBlueprint('contact');
        contact.setAttribute('address', address);
        contact.setAttribute('account', account);
        contact.setAttribute('type', 'chat');
        contact.setAttribute('availability', 'unavailable');
        contact.getElementsByAttribute('role', 'name')[0].setAttribute('value', address);
        _('contacts').appendChild(contact);
        return contact;
    },

    // domain reactions

    gotMessageFrom: function(account, address) {
        var contact = this.get(account, address) || this.add(account, address);

        if(contact.getAttribute('current') != 'true') {
            var pending = parseInt(_(contact, {role: 'pending'}).value);
            _(contact, {role: 'pending'}).value = pending + 1;
        }
    },

    messagesSeen: function(account, address) {
        var contact = this.get(account, address) || this.add(account, address);

        _(contact, {role: 'pending'}).value = 0;
    },

    nowTalkingWith: function(account, address) {
        var previouslyTalking = _('contacts', {current: 'true'});
        if(previouslyTalking)
            previouslyTalking.setAttribute('current', 'false');

        var contact = this.get(account, address) || this.add(account, address);
        contact.setAttribute('current', 'true');
        _(contact, {role: 'pending'}).value = 0;
    },

    contactChangedRelationship: function(account, address, subscription, name) {
        var contact = this.get(account, address) || this.add(account, address);

        if(subscription)
            if(subscription == 'remove') {
                _('contacts').removeChild(contact);
                return;
            }
            else
                contact.setAttribute('subscription', subscription);

        var nameElement = contact.getElementsByAttribute('role', 'name')[0];
        if(name)
            nameElement.setAttribute('value', name);
        else if(name == '' || !nameElement.hasAttribute('value'))
            nameElement.setAttribute('value', address);
    },

    resourceChangedPresence: function(account, address) {
        var contact = this.get(account, address) || this.add(account, address);
        var summary = XMPP.presenceSummary(account, address);

        contact.setAttribute('availability', summary.stanza.@type.toString() || 'available');
        contact.setAttribute('show', summary.stanza.show.toString());

        this._reposition(contact);

        if(summary.stanza.status == undefined ||
           summary.stanza.status == '')
            _(contact, {role: 'status'}).removeAttribute('value');
        else
            _(contact, {role: 'status'}).value = summary.stanza.status;
    },

    _reposition: function(contact) {
        var availability = contact.getAttribute('availability');
        var show = contact.getAttribute('show');

        contact.style.opacity = 0;
        if(contact.getAttribute('open') == 'true')
            _('contacts').insertBefore(contact, _('contacts', {role: 'open'}).nextSibling);
        else if(availability == 'available' && show == '')
            _('contacts').insertBefore(contact, _('contacts', {role: 'online'}).nextSibling);
        else if(availability == 'available' && show == 'away')
            _('contacts').insertBefore(contact, _('contacts', {role: 'away'}).nextSibling);
        else if(availability == 'available' && show == 'dnd')
            _('contacts').insertBefore(contact, _('contacts', {role: 'dnd'}).nextSibling);
        else
            _('contacts').insertBefore(contact, _('contacts', {role: 'offline'}).nextSibling);
        fadeIn(contact);
    },

    startedConversationWith: function(account, address, type) {
        var contact = this.get(account, address) || this.add(account, address);
        contact.setAttribute('open', 'true');
        contact.setAttribute('type', type);
        this._reposition(contact);
    },

    stoppedConversationWith: function(account, address) {
        var contact = this.get(account, address);
        if(contact) {
            contact.setAttribute('open', 'false');
            this._reposition(contact);
        }
    }
};


// UTILITIES (GENERIC)
// ----------------------------------------------------------------------
// Application-independent functions not dealing with user interface.

function isChromeUrl(string) {
    return /^chrome:\/\//.test(string);
}

function chromeToFileUrl(url) {
    return Cc["@mozilla.org/chrome/chrome-registry;1"]
        .getService(Ci.nsIChromeRegistry)
        .convertChromeURL(
            Cc["@mozilla.org/network/io-service;1"]
            .getService(Ci.nsIIOService)
            .newURI(url, null, null)).spec;
}


// GUI UTILITIES (GENERIC)
// ----------------------------------------------------------------------
// Application-independent functions dealing with user interface.

function getDefaultAppUrl() {
    var url = prefBranch.getCharPref('defaultAppUrl');
    return isChromeUrl(url) ? chromeToFileUrl(url) : url;
}

function fadeIn(element, stepValue, stepInterval) {
    var stepValue = stepValue || 0.1;
    var stepInterval = stepInterval || 150;

    function fadeStep() {
        if(element.style.opacity == 1)
            return;

        var targetOpacity = parseFloat(element.style.opacity) + stepValue;
        if(targetOpacity > 1)
            targetOpacity = 1;

        element.style.opacity = targetOpacity;

        window.setTimeout(fadeStep, stepInterval);
    }

    fadeStep();
}

function attr(element, attributeName) {
    if(element.hasAttribute(attributeName))
        return element.getAttribute(attributeName);
    else
        return getAncestorAttribute(element, attributeName);
}

function getAncestorAttribute(element, attributeName) {
    while(element.parentNode && element.parentNode.hasAttribute) {
        if(element.parentNode.hasAttribute(attributeName))
            return element.parentNode.getAttribute(attributeName);
        element = element.parentNode;
    }
    return null;
}

function x() {
    var contextNode, path;
    if(arguments[0] instanceof Ci.nsIDOMElement ||
       arguments[0] instanceof Ci.nsIDOMDocument) {
        contextNode = arguments[0];
        path = arguments[1];
    }
    else {
        path = arguments[0];
        contextNode = document;
    }

    function resolver(prefix) {
        switch(prefix) {
        case 'xul':
            return 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
            break;
        case 'html':
            return 'http://www.w3.org/1999/xhtml';
            break;
        }
    }

    return document.evaluate(
        path, contextNode, resolver, XPathResult.ANY_UNORDERED_NODE_TYPE, null).
        singleNodeValue;
}

function cloneBlueprint(role) {
    return x('//*[@id="blueprints"]/*[@role="' + role + '"]').
        cloneNode(true);
}

function _(element, descendantQuery) {
    if(typeof(element) == 'string')
        element = document.getElementById(element);

    if(typeof(descendantQuery) == 'object')
        for(var attrName in descendantQuery)
            element = element.getElementsByAttribute(
                attrName, descendantQuery[attrName])[0];

    return element;
}

function scrollingOnlyIfAtBottom(window, action) {
    var shouldScroll = ((window.scrollMaxY - window.pageYOffset) < 24);
    action();
    if(shouldScroll)
        window.scrollTo(0, window.scrollMaxY);
}


// GUI UTILITIES (GENERIC)
// ----------------------------------------------------------------------

function queuePostLoadAction(contentPanel, action) {
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
        }, true);
}


// GUI UTILITIES (SPECIFIC)
// ----------------------------------------------------------------------
// Application-dependent functions dealing with interface.  They do
// not affect the domain directly.

function getBrowser() {
    return top.getBrowser();
}

function getTop() {
    return top;
}

function isConversationOpen(account, address) {
    return getConversation(account, address) != undefined;
}

function isConversationCurrent(account, address) {
    return _('conversations').selectedPanel == getConversation(account, address);
}

function withConversation(account, address, resource, type, forceOpen, action) {
    var conversation = getConversation(account, address);

    if(!conversation && forceOpen)
        openAttachPanel(
            account, address, resource, type,
            getDefaultAppUrl(),
            'mini', function(contentPanel) {
                action(contentPanel);
                openedConversation(account, address, type);
            });
    else
        action(_(conversation, {role: 'chat'}).contentDocument);
}

function getConversation(account, address) {
    return x('//*[@id="conversations"]' +
             '//*[@account="' + account + '" and ' +
             '    @address="' + address + '"]');
}


// GUI ACTIONS
// ----------------------------------------------------------------------
// Application-dependent functions dealing with user interface.  They
// affect the domain.

function setTabbedLayout() {
    _('layout-stacked').hidden = true;
    _('layout-tabbed').hidden = false;
    _('tabpanel-conversations').appendChild(_('conversations'));
    _('tabpanel-contacts').appendChild(_('contacts'));
}

function setStackedLayout() {
    _('layout-tabbed').hidden = true;
    _('layout-stacked').hidden = false;
    _('box-conversations').appendChild(_('conversations'));
    _('box-contacts').appendChild(_('contacts'));
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

function attachContentDocument(contentPanel, account, address, type) {
    XMPP.enableContentDocument(contentPanel, account, address, type);
}

function openAttachPanel(account, address, resource, type, documentHref, target, action) {
    var contentPanel;
    if(target == 'main') {
        if(getBrowser().contentDocument.location.href != 'about:blank' &&
           !documentHref.match(/^javascript:/))
            getBrowser().selectedTab = getBrowser().addTab();

        contentPanel = getBrowser().selectedBrowser;
    } else {
        var conversation = cloneBlueprint('conversation');
        _('conversations').appendChild(conversation);
        _(conversation, {role: 'contact'}).value = XMPP.nickFor(account, address);
        contentPanel = _(conversation, {role: 'chat'});
        conversation.setAttribute('account', account);
        conversation.setAttribute('address', address);
        conversation.setAttribute('resource', resource);
        conversation.setAttribute('type', type);
        conversation.setAttribute('url', documentHref);
        contentPanel.addEventListener(
            'click', function(event) {
                if(event.target.localName == 'a' &&
                   event.target.isDefaultNamespace('http://www.w3.org/1999/xhtml')) {
                    event.preventDefault();
                    if(event.button == 0)
                        getBrowser().loadURI(event.target.getAttribute('href'));
                    else if(event.button == 1) {
                        getBrowser().selectedTab = getBrowser().addTab(event.target.getAttribute('href'));
                    }
                }
            }, true);
    }

    queuePostLoadAction(
        contentPanel, function(document) {
            XMPP.enableContentDocument(contentPanel, account, address, type);

            if(documentHref == getDefaultAppUrl())
                openedConversation(account, address, type);

            if(action) 
                action(contentPanel);
        });
    
    contentPanel.contentDocument.location.href = documentHref;

    return contentPanel;
}

function maximizeAuxiliary() {
    _('splitter-main').hidden = true;
    _('box-auxiliary').collapsed = false;
    _('box-conversations').collapsed = true;
}

function maximizeConversations() {
    _('splitter-main').hidden = true;
    _('box-auxiliary').collapsed = true;
    _('box-conversations').collapsed = false;
}

function displayAuxiliaryAndConversations() {
    _('box-conversations').collapsed = false;
    _('box-auxiliary').collapsed = false;
    _('splitter-main').hidden = false;
}

function focusConversation(account, address) {
    var conversation = getConversation(account, address);

    if(conversation) {
        _('conversations').selectedPanel = conversation;
        focusedConversation(account, address);
        conversation.focus();
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
        'chrome://sameplace/content/open.xul',
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
                    request.account, request.address, null, null, true, 
                    function() {
                        focusConversation(request.account, request.address);
                    });
}


// GUI REACTIONS
// ----------------------------------------------------------------------

var chatOutputDropObserver = {
    getSupportedFlavours: function () {
        var flavours = new FlavourSet();
        flavours.appendFlavour('text/unicode');
        return flavours;
    },
    onDragOver: function(event, flavour, session) {},

    onDrop: function(event, dropdata, session) {
        if(dropdata.data != '') {
            var element = event.currentTarget;
            XMPP.send(
                attr(element, 'account'),
                <message to={attr(element, 'address')} type={attr(element, 'type')}>
                <body>{dropdata.data}</body>
                </message>);
        }
    }
};

function requestedAttachBrowser(element) {
    attachContentDocument(getBrowser().selectedBrowser,
                          attr(element, 'account'),
                          attr(element, 'address'),
                          attr(element, 'type'));
}

function requestedUpdateContactTooltip(element) {
    _('contact-tooltip', {role: 'name'}).value =
        XMPP.nickFor(attr(element, 'account'), attr(element, 'address'));
    _('contact-tooltip', {role: 'address'}).value = attr(element, 'address');
    _('contact-tooltip', {role: 'account'}).value = attr(element, 'account');

    if(attr(element, 'type') == 'groupchat') 
        _('contact-tooltip', {role: 'subscription'}).parentNode.hidden = true;
    else {
        _('contact-tooltip', {role: 'subscription'}).parentNode.hidden = false;
        var subscription = attr(element, 'subscription');
        switch(subscription) {
        case 'both':
            subscription = 'Both see when other is online';
            break;
        case 'from':
            subscription = 'Contact sees when you are online';
            break;
        case 'to':
            subscription = 'You see when contact is online';
            break;
        case 'none':
            subscription = 'Neither sees when other is online';
            break;
        }
    }

    _('contact-tooltip', {role: 'subscription'}).value = subscription;
}

function requestedChangeStatusMessage(event) {
    if(event.keyCode != KeyEvent.DOM_VK_RETURN)
        return;

    changeStatusMessage(event.target.value);
    document.commandDispatcher.advanceFocus();
}

function requestedSetContactAlias(element) {
    var account = attr(element, 'account');
    var address = attr(element, 'address');
    var alias = { value: XMPP.nickFor(account, address) };

    var confirm = prompts.prompt(
        null, 'Alias Change', 'Choose an alias for ' + address, alias, null, {});

    if(confirm)
        XMPP.send(account,
                  <iq type="set"><query xmlns="jabber:iq:roster">
                  <item jid={address} name={alias.value}/>
                  </query></iq>);
}

function requestedRemoveContact(element) {
    var account = attr(element, 'account');
    var address = attr(element, 'address');

    XMPP.send(account,
              <iq type="set"><query xmlns="jabber:iq:roster">
              <item jid={address} subscription="remove"/>
              </query></iq>);
}

function focusedConversation(account, address) {
    contacts.nowTalkingWith(account, address);
}

function requestedAddContact() {
    var request = {
        contactAddress: undefined,
        subscribeToPresence: undefined,
        confirm: false,
        account: undefined
    };

    window.openDialog(
        'chrome://sameplace/content/add.xul',
        'sameplace-add-contact', 'modal,centerscreen',
        request);

    if(request.confirm)
        addContact(request.account, request.contactAddress, request.subscribeToPresence);
}

function requestedOpenAttachPanel(contactElement, documentHref, target) {
    var account = attr(contactElement, 'account');
    var address = attr(contactElement, 'address');
    var type = attr(contactElement, 'type') || 'chat';

    openAttachPanel(account, address, null, type, documentHref, target);
}

function requestedCycleMaximize(command) {
    if(!_('box-conversations').collapsed &&
       !_('box-auxiliary').collapsed)
        maximizeConversations();
    else if(_('box-conversations').collapsed &&
            !_('box-auxiliary').collapsed)
        displayAuxiliaryAndConversations();
    else if(_('box-auxiliary').collapsed &&
            !_('box-conversations').collapsed)
        maximizeAuxiliary();
}

function clickedContact(contact) {
    var account = contact.getAttribute('account');
    var address = contact.getAttribute('address');
    var type = contact.getAttribute('type');

    if(type == 'groupchat') 
        promptOpenConversation(account, address, type);
    else 
        withConversation(
            account, address, null, type, true, function() {
                focusConversation(account, address);
            });
}

function requestedCloseConversation(element) {
    if(attr(element, 'type') == 'groupchat')
        exitRoom(attr(element, 'account'),
                 attr(element, 'address'),
                 attr(element, 'resource'));

    closeConversation(attr(element, 'account'),
                      attr(element, 'address'));
}

function requestedCloseConversation(element) {
    if(attr(element, 'type') == 'groupchat')
        exitRoom(attr(element, 'account'),
                 attr(element, 'address'),
                 attr(element, 'resource'));

    closeConversation(attr(element, 'account'),
                      attr(element, 'address'),
                      attr(element, 'resource'),
                      attr(element, 'type'));
}

function requestedOpenConversation() {
    promptOpenConversation();    
}

function clickedTopic(event) {
    var input = { value: '' };
    var check = { value: false };

    if(prompts.prompt(null, 'SamePlace', 'Set topic for this room:', input, null, check))
        setRoomTopic(getAncestorAttribute(event.target, 'account'),
                     getAncestorAttribute(event.target, 'address'),
                     input.value);
}

function hoveredMousePointer(event) {
    if(!event.target.hasAttribute)
        return;

    var get = (event.target.hasAttribute('account')) ?
        (function(attributeName) { return event.target.getAttribute(attributeName); }) :
        (function(attributeName) { return getAncestorAttribute(event.target, attributeName); });

    getTop().document.getElementById('statusbar-display').label =
        'Account: <' + get('account') + '>, ' +
        'Address: <' + get('address') + '>, ' +
        'Resource: <' + get('resource') + '>, ' +
        'Subscription: <' + get('subscription') + '>, ' +
        'Type: <' + get('type') + '>';
}

function openedConversation(account, address, type) {
    contacts.startedConversationWith(account, address, type);
    
    if(_('conversations').childNodes.length == 1)
        contacts.nowTalkingWith(account, address);
}

function closedConversation(account, address) {
    contacts.stoppedConversationWith(account, address);
    if(_('conversations').childNodes.length == 0)
        _('box-conversations').collapsed = true;
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

function acceptSubscriptionRequest(account, address) {
    XMPP.send(
        account,
        <presence to={address} type="subscribed"/>);
}

function addContact(account, address, subscribe) {
    XMPP.send(
        account,
        <iq type='set' id='set1'>
        <query xmlns='jabber:iq:roster'>
        <item jid={address}/>
        </query></iq>);

    XMPP.send(account, <presence to={address} type="subscribe"/>)
        }

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

// XXX OBSOLETE

function setRoomTopic(account, roomAddress, content) {
    XMPP.send(account,
              <message to={roomAddress} type="groupchat">
              <subject>{content}</subject>
              </message>);
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function receivedSubscriptionRequest(presence) {
    var account = presence.session.name;
    var address = presence.stanza.@from.toString();
    var accept, reciprocate;
    if(contacts.get(account, address) == undefined ||
       contacts.get(account, address).getAttribute('subscription') == 'none') {
        var check = {value: true};
        accept = prompts.confirmCheck(
            null, 'Contact notification',
            address + ' wants to add ' + presence.stanza.@to + ' to his/her contact list.\nDo you accept?',
            'Also add ' + address + ' to my contact list', check);
        reciprocate = check.value;
    }
    else {
        accept = prompts.confirm(
            null, 'Contact notification',
            address + ' wants to add ' + presence.stanza.@to + ' you to his/her contact list.\nDo you accept?');

    }
    if(accept) {
        acceptSubscriptionRequest(account, address);
        if(reciprocate)
            addContact(account, address);
    }
}

function receivedSubscriptionApproval(presence) {
    prompts.alert(
        null, 'Contact Notification',
        presence.stanza.@from + ' has accepted to be added to your contact list.');
}

function receivedChatMessage(message) {
    var from = XMPP.JID(message.stanza.@from);

    var wConversation = getConversation(message.session.name, from.address);
    if(!wConversation) {
        openAttachPanel(
            message.session.name, from.address,
            from.resource, message.stanza.@type,
            getDefaultAppUrl(),
            'mini',
            function(contentPanel) {
                contentPanel.xmppChannel.receive(message);
            });
        openedConversation(message.session.name, from.address, message.stanza.@type);
    } else if(!wConversation.contentDocument ||
              (wConversation.contentDocument &&
               !wConversation.contentDocument.getElementById('xmpp-incoming'))) {

        queuePostLoadAction(
            _(wConversation, {role: 'chat'}), function(contentPanel) {
                contentPanel.xmppChannel.receive(message);
            });
    }
}

function sentChatMessage(message) {
    var to = XMPP.JID(message.stanza.@to);

    if(!getConversation(message.session.name, to.address))
        withConversation(
            message.session.name, to.address,
            to.resource, message.stanza.@type,
            true,
            function(document) {
                document.getElementById('xmpp-incoming').textContent =
                    message.stanza.toXMLString();
            });
}

function receivedRoster(iq) {
    for each(var item in iq.stanza..ns_roster::item) {
        contacts.contactChangedRelationship(
            iq.session.name,
            item.@jid,
            item.@subscription,
            item.@name.toString());
    }
}

function receivedPresence(presence) {
    var from = XMPP.JID(presence.stanza.@from);

    contacts.resourceChangedPresence(presence.session.name, from.address);
}

function sentPresence(presence) {
    _('status-message').value = presence.stanza.status.toString();
    _('status-message').setAttribute('draft', 'false');
}

function sentMUCPresence(presence) {
    var room = XMPP.JID(presence.stanza.@to);

    openAttachPanel(
        presence.session.name, room.address, room.resource, 'groupchat',
        getDefaultAppUrl(), 'mini',
        function(contentPanel) {
            focusConversation(presence.session.name, room.address);
        });
}

function receivedMUCPresence(presence) {
    var from = XMPP.JID(presence.stanza.@from);

    contacts.resourceChangedPresence(
        presence.session.name,
        from.address,
        from.resource,
        presence.stanza.@type);
}

// DEVELOPER UTILITIES
// ----------------------------------------------------------------------

function quickTest() {
    XMPP.up('foo@jabber.sameplace.cc/Firefox',
            {password: 'foo', continuation: function(jid) {
                    joinRoom(jid, 'a@places.sameplace.cc', 'foobarfoobar');
                }});
}

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
