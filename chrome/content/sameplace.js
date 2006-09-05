// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;

const prefBranch = Components
    .classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefService)
    .getBranch('extensions.sameplace.');
const pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefBranch);
const mediator = Cc['@mozilla.org/appshell/window-mediator;1']
    .getService(Ci.nsIWindowMediator);
const prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);

const ns_notes = new Namespace('http://hyperstruct.net/sameplace/protocol/0.1.4#notes');
const ns_agent = new Namespace('http://hyperstruct.net/sameplace/protocol/0.1.4#agent');
const ns_muc_user = new Namespace('http://jabber.org/protocol/muc#user');
const ns_muc = new Namespace('http://jabber.org/protocol/muc');
const ns_xul = new Namespace('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul');
const ns_roster = new Namespace('jabber:iq:roster');

var urlRegexp = new RegExp('(http:\/\/|www.)[^ \\t\\n\\f\\r"<>|()]*[^ \\t\\n\\f\\r"<>|,.!?(){}]');
var smileyMap = {
    '0:-)':  'angel',
    ':\'(':  'crying',
    '>:-)':  'devil-grin',
    'B-)':   'glasses',
    ':-*':   'kiss',
    ':-(|)': 'monkey',
    ':-|':   'plain',
    ':-(':   'sad',
    ':-)':   'smile',
    ':-D':   'smile-big',
    ':-0':  'surprise',
    ';-)':   'wink'
};
var smileyRegexp;

(function() {
    var smileySymbols = [];
    for(var symbol in smileyMap)
        smileySymbols.push(symbol);

    smileyRegexp = smileySymbols.map(
        function(symbol) {
            return symbol.replace(/(\(|\)|\*|\|)/g, '\\$1');
        }).join('|');
})();


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;
var debugMode = false;
var pendingJoins = {};


// GUI INITIALIZATION AND FINALIZATION
// ----------------------------------------------------------------------

function init(event) {
    if(!event.target)
        return;

    if(window == top) 
        orientHorizontal();
    else 
        orientVertical();

    _('contact-list').selectedIndex = -1;

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
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.body.length() > 0 && s.@type != 'error';
            }}, function(message) { receivedChatMessage(message); });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.@type == 'error';
            }}, function(message) { receivedErrorMessage(message); });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return (s.body.toString() &&
                        s.body.toString().search(urlRegexp) != -1);
            }}, function(message) { receivedMessageWithURL(message); });
    channel.on(
        {event: 'message', direction: 'out', stanza: function(s) {
                return s.@type != 'groupchat';
            }}, function(message) { sentChatMessage(message) });

    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.ns_muc_user::x.length() > 0;
            }}, function(presence) { receivedMUCPresence(presence) });
    channel.on(
        {event: 'presence', direction: 'out', stanza: function(s) {
                return s.ns_muc::x.length() > 0 && s.@type != 'unavailable';
            }}, function(presence) { sentMUCPresence(presence) });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.@type == 'groupchat' && s.subject.toString();
            }}, function(message) { receivedRoomTopic(message); });
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
    XMPP.cache.presence.forEach(receivedPresence);        
}

function finish() {
    for(var conversation, i=0; conversation = _('conversations').childNodes[i]; i++)
        closeConversation(
            conversation.getAttribute('account'),
            conversation.getAttribute('address'),
            conversation.getAttribute('resource'),
            conversation.getAttribute('type'));
    
    channel.release();
}

// SUBSYSTEMS
// ----------------------------------------------------------------------

var contacts = {
    // interface glue

    get: function(account, address) {
        return x('//*[@id="contact-list"]//*[' +
                 '@address="' + address + '" and ' +
                 '@account="' + account + '"]');
    },

    add: function(account, address) {
        var contact;
        contact = cloneBlueprint('contact');
        contact.setAttribute('address', address);
        contact.setAttribute('account', account);
        contact.getElementsByAttribute('role', 'name')[0]
        .setAttribute('value', XMPP.JID(address).username);
        _('contact-list').appendChild(contact);
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
        var previouslyTalking = _('contact-list', {current: 'true'});
        if(previouslyTalking) 
            previouslyTalking.setAttribute('current', 'false');

        var contact = this.get(account, address) || this.add(account, address);
        contact.setAttribute('current', 'true');
        _(contact, {role: 'pending'}).value = 0;
    },

    contactExists: function(account, address, subscription) {
        var contact = this.get(account, address) || this.add(account, address);;

        if(!contact.hasAttribute('availability'))
            contact.setAttribute('availability', 'unavailable');

        if(subscription)
            contact.setAttribute('subscription', subscription);

        return contact;
    },

    resourceChangedPresence: function(account, address, resource, availability, show, status) {
        var contact = this.contactExists(account, address);

        if(availability == undefined)
            availability = 'available';
        if(show)
            show = show.toString();
        if(status)
            status = status.toString();

        var contactPresences = XMPP.cache.presence.filter(
            function(presence) {
                return (presence.session.name == account &&
                        XMPP.JID(presence.stanza.@from).address == address);
            });


        if(contactPresences.some(
               function(p) {
                   return ((p.stanza.show == undefined || p.stanza.show == 'chat') &&
                           p.stanza.@type == undefined);
               })) {
            contact.setAttribute('availability', 'available');
            contact.setAttribute('show', '');
        }
        else if(contactPresences.some(
                    function(p) {
                        return (p.stanza.show == 'away' ||
                                p.stanza.show == 'xa');
                    })) {
            contact.setAttribute('availability', 'available');
            contact.setAttribute('show', 'away');
        }
        else if(contactPresences.some(
                    function(p) {
                        return (p.stanza.show == 'dnd');
                    })) {
            contact.setAttribute('availability', 'available');
            contact.setAttribute('show', 'dnd');
        }
        else {
            contact.setAttribute('availability', 'unavailable');
            contact.setAttribute('show', '');
        }
        this._reposition(contact);

        if(status)
            _(contact, {role: 'status'}).value = status;
        else
            _(contact, {role: 'status'}).removeAttribute('value');
    },

    _reposition: function(contact) {
        var availability = contact.getAttribute('availability');
        var show = contact.getAttribute('show');

        contact.style.opacity = 0;
        if(contact.getAttribute('open') == 'true')
            _('contact-list').insertBefore(contact, _('contact-list', {role: 'open'}).nextSibling);
        else if(availability == 'available' && show == '')
            _('contact-list').insertBefore(contact, _('contact-list', {role: 'online'}).nextSibling);
        else if(availability == 'available' && show == 'away')
            _('contact-list').insertBefore(contact, _('contact-list', {role: 'away'}).nextSibling);
        else if(availability == 'available' && show == 'dnd')
            _('contact-list').insertBefore(contact, _('contact-list', {role: 'dnd'}).nextSibling);
        else
            _('contact-list').appendChild(contact);
        fadeIn(contact);
    },
    
    startedConversationWith: function(account, address) {
        var contact = this.get(account, address) || this.add(account, address);
        contact.setAttribute('open', 'true');
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


// GUI UTILITIES (GENERIC)
// ----------------------------------------------------------------------
// Application-independent functions dealing with user interface.

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

function withContent(account, address, url, code) {
    var browser = findBrowser(account, address, url);
    
    if(browser) {
        code(browser.contentWindow);        
    } else {
        var tabBrowser = top.getBrowser();
        if(tabBrowser.currentURI.spec != 'about:blank')
            tabBrowser.selectedTab = tabBrowser.addTab();

        browser = tabBrowser.selectedBrowser;
        browser.setAttribute('account', account);
        browser.setAttribute('address', address);

        browser.addEventListener(
            'load', function(event) {
                if(event.target && event.target.location &&
                   event.target.location.href == url) {
                    browser.contentWindow.attach(account, address);
                    code(browser.contentWindow);
                }
            }, true);
        browser.loadURI(url);
    }       
}

function textToHTML(doc, text) {
    text = text.toString();
    var container = doc.createElement('span');
    
    var rx = new RegExp([urlRegexp.source, smileyRegexp].join('|'), 'g');
    
    var start = 0;
    var match = rx.exec(text);
    while(match) {
        container.appendChild(
            doc.createTextNode(
                text.substring(start, match.index)));

        start = rx.lastIndex;

        var translatedElement;
        if(match[0].match(smileyRegexp)) {
            translatedElement = doc.createElement('img');
            translatedElement.setAttribute('class', 'emoticon');
            translatedElement.
                setAttribute('src',
                             'chrome://sameplace/skin/emoticons/' +
                             smileyMap[match[0]] +
                             '.png');
        } else {
            translatedElement = doc.createElement('a');
            translatedElement.textContent = match[0];
        }
        container.appendChild(translatedElement);

        match = rx.exec(text);
    }
    container.appendChild(
        doc.createTextNode(
            text.substring(start, text.length)));

    return container;
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
        return prefix == 'xul' ? 
            'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul' : null;
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

function findBrowser(account, address, url) {
    var index = findBrowserIndex(account, address, url);
    if(index != -1)
        return window.top.getBrowser().getBrowserAtIndex(index);
}

function findBrowserIndex(account, address, url) {
    var tabBrowser = window.top.getBrowser();
    var browser;
    var numTabs = tabBrowser.mPanelContainer.childNodes.length;
    var index = 0;
    while (index < numTabs) {
        browser = tabBrowser.getBrowserAtIndex(index);
        if(browser.currentURI.spec == url &&
           browser.getAttribute('account') == account &&
           browser.getAttribute('address') == address)
            return index;
        index++;
    }
    return -1;
}

function findWindow(name) {
    var enumerator = mediator.getEnumerator('');
    while(enumerator.hasMoreElements()) {
        var window = enumerator.getNext();
        if(window.name == name)
            return window;
    }
    return null;
}

function growTextBox(textBox) {
    textBox.setAttribute('rows', parseInt(textBox.getAttribute('rows')) + 1);
}


// GUI UTILITIES (SPECIFIC)
// ----------------------------------------------------------------------
// Application-dependent functions dealing with interface.  They do
// not affect the domain directly.

function getBrowser() {
    // XXX Temporary: won't work well with stand-alone window.
    return top.gBrowser;
}

function withContactInfoOf(account, address, action) {
    // XXX will break on private conversations with participants
    action(getConversation(account, address)
           .contentDocument
           .getElementById('info'));
}

function isConversationOpen() {
    return getConversation.apply(null, arguments);
}

function isConversationCurrent() {
    return getConversation.apply(null, arguments) == _('conversations').selectedPanel;
}

function createConversation(account, address, resource, type) {
    function scrolledWindow(window) {
        window.wantBottom =
            (Math.abs(window.pageYOffset - window.scrollMaxY) < 24);
    }

    function resizedWindow(window) {
        if(window.wantBottom ||
           window.pageYOffset == 0) 
            window.scrollTo(window.pageXOffset, window.scrollMaxY);
    }

    function clickedLink(link, button) {
        switch(button) {
        case 0:
            getBrowser().loadURI(link);
            break;
        case 1:
            getBrowser().addTab(link);
            break;
        }
    }

    account = account.toString();
    address = address.toString();
    resource = resource.toString();
    type = type.toString();

    var conversation = cloneBlueprint('conversation');
    conversation.setAttribute('account', account);
    conversation.setAttribute('address', address);
    conversation.setAttribute('resource', resource);
    conversation.setAttribute('type', type);
    _('conversations').appendChild(conversation);

    _(conversation, {role: 'contact'}).value = XMPP.JID(address).username;

    var output = _(conversation, {role: 'chat-output'});

    output.addEventListener(
        'load', function(event) {
            var doc = output.contentDocument;
            doc.getElementById('address').textContent = address;

            if(type == 'groupchat')
                doc.getElementById('box-resources')
                    .getElementsByTagName('h3')[0].textContent = 'Participants';

            XMPP.cache.presence.forEach(
                function(presence) {
                    if(presence.session.name == account &&
                       XMPP.JID(presence.stanza.@from).address == address)
                        updateResources(
                            account, address,
                            XMPP.JID(presence.stanza.@from).resource,
                            presence.stanza.@type);
                });

            openedConversation(account, address, resource, type);
        }, true);

    output.contentWindow.addEventListener(
        'scroll', function(event) {
            scrolledWindow(event.currentTarget); },
        false);

    output.contentWindow.addEventListener(
        'resize', function(event) {
            resizedWindow(event.currentTarget); },
        false);

    output.contentWindow.addEventListener(
        'click', function(event) {
            if(event.target.nodeName == 'A')
                clickedLink(event.target.textContent, event.button);
        }, false);

    return conversation;
}

/**
 * Ensures that the correct conversation for the given combination of
 * parameters is open, then executes the given action.
 *
 * Criteria for selecting the correct conversation:
 *
 * - if type is "groupchat", select the conversation with the
 *   account/address combination, ignoring the resource (since there
 *   cannot be more than one groupchat conversation for a certain
 *   account/address combination);
 *
 * - if type is "chat" and a conversation of type "groupchat" with
 *   given account/address exists somewhere, then we have a
 *   conversation with a room participant.  Open it if not opened
 *   already, then execute action.
 *
 * - if type is "chat" an no conversation of type "groupchat" with
 *   given account/address exists already, this is a conversation with
 *   an ordinary contact.  If a conversation of type "chat" with given
 *   account/address exists already, reuse it changing the resource,
 *   otherwise create it.
 *
 */

function withConversation(account, address, resource, type, action) {
    var conversation;
    switch(type.toString()) {
    case 'headline':
        break;
    case 'groupchat':
        conversation = getConversation(account, address, null, 'groupchat');
        var chatOutput = _(conversation, {role: 'chat-output'});

        if(chatOutput.contentDocument.getElementById('messages'))
            action(conversation);
        else
            chatOutput.addEventListener(
                'load', function(event) { action(conversation); }, true);
        break;
    case 'normal':
    case 'chat':
    default:
        var roomConversation = getConversation(account, address, null, 'groupchat');
        if(roomConversation) {
            conversation =
                getConversation(account, address, resource, 'chat') ||
                createConversation(account, address, resource, 'chat');
        }
        else {
            conversation = getConversation(account, address, null, 'chat');
            if(conversation) {
                conversation.setAttribute('resource', resource);
            } else
                conversation = createConversation(account, address, resource, 'chat');

            var chatOutput = _(conversation, {role: 'chat-output'});

            if(chatOutput.contentDocument.getElementById('messages'))
                action(conversation);
            else
                chatOutput.addEventListener(
                    'load', function(event) { action(conversation); }, true);
        }
        return conversation;
    }
}

function getConversation(account, address, resource, type) {
    return x('//*[' +
             '@role="conversation" and ' +
             (resource ? '@resource="' + resource + '" and ' : '') +
             (type ? '@type="' + type + '" and ': '') +
             '@account="' + account + '" and ' +
             '@address="' + address + '"]');
}


// GUI ACTIONS
// ----------------------------------------------------------------------
// Application-dependent functions dealing with user interface.  They
// affect the domain.

function attachContent(account, address, type) {
    top.xmppEnableContent(account, address, type);
}

function orientHorizontal() {
    _('box-main').setAttribute('orient', 'horizontal');
    _('splitter-main').setAttribute('orient', 'horizontal');
    _('box-auxiliary').setAttribute('orient', 'vertical');
}

function orientVertical() {
    _('box-main').setAttribute('orient', 'vertical');
    _('splitter-main').setAttribute('orient', 'vertical');
    _('box-auxiliary').setAttribute('orient', 'horizontal');
}

function cycleOrientation() {
    if(_('box-main').getAttribute('orient') == 'horizontal')
        orientVertical();
    else
        orientHorizontal();
}

function maximizeAuxiliary() {
    _('splitter-main').hidden = true;
    _('box-auxiliary').collapsed = false;
    _('conversations').collapsed = true;
}

function maximizeConversations() {
    _('splitter-main').hidden = true;
    _('box-auxiliary').collapsed = true;
    _('conversations').collapsed = false;
}

function displayAuxiliaryAndConversations() {
    _('conversations').collapsed = false;
    _('box-auxiliary').collapsed = false;
    _('splitter-main').hidden = false;    
}

function focusContent(account, address, url) {
    top.getBrowser().selectedTab =
        top.getBrowser().tabContainer.childNodes[
            findBrowserIndex(account, address, url)];
}

function focusConversation(account, address) {
    var conversation = getConversation(account, address);
    if(conversation) {
        if(_('conversations').collapsed)
            displayAuxiliaryAndConversations();

        _('conversations').selectedPanel = conversation;
        setTimeout(
            function() {
                _(conversation, {role: 'chat-input'}).focus();
            }, 100);
    }
    focusedConversation(account, address);
}

function changeConversationResource(account, address, resource, type, otherResource) {
    var conversation = getConversation(account, address, resource, type);
    if(conversation) 
        conversation.setAttribute('resource', otherResource);
}

function closeConversation(account, address, resource, type) {
    var conversation = getConversation(account, address, resource, type);

    if(conversation) {
        conversation.parentNode.removeChild(conversation);
        closedConversation(account, address, resource, type);        
    }
}

function updateResources(account, address, participantNick, availability) {
    var conversation = getConversation(account, address);
    if(!conversation)
        return;

    var doc = _(conversation, {role: 'chat-output'}).contentDocument;

    var participants = doc.getElementById('resources');
    var participant;
    for(var i=0; i<participants.childNodes.length; i++) {        
        if(participants.childNodes[i].textContent == participantNick) {
            participant = participants.childNodes[i];
            break;
        }
    }
    if(participant) {
        if(availability == 'unavailable')
            participants.removeChild(participant);
    } else {
        if(availability != 'unavailable') {
            var participant = doc.createElement('li');
            participant.textContent = participantNick;
            participants.insertBefore(participant, participants.firstChild);
        }
    }
}

function displayChatMessage(account, address, resource, direction, type, sender, body) {
    withConversation(
        account, address, resource, type,
        function(conversation) {
            var chatOutputWindow = _(conversation, {role: 'chat-output'}).contentWindow;
            var doc = chatOutputWindow.document;

            var htmlSender = doc.createElement('span');
            if(type == 'groupchat')
                htmlSender.textContent = XMPP.JID(sender).resource || address;
            else
                htmlSender.textContent = XMPP.JID(sender).username;
            htmlSender.setAttribute(
                'class', direction == 'in' ? 'contact' : 'user');

            var htmlBody = textToHTML(doc, body);
            htmlBody.setAttribute('class', 'body');

            var htmlTooltip = doc.createElement('span');
            htmlTooltip.setAttribute('class', 'tooltip');
            var time = new Date();
            htmlTooltip.textContent = (direction == 'in' ? 'Received at ' : 'Sent at ') +
                time.getHours() + ':' + time.getMinutes() + ':' + time.getSeconds();

            var message = doc.createElement('li');
            message.setAttribute('class', 'message');
            message.appendChild(htmlSender);
            message.appendChild(htmlBody);
            message.appendChild(htmlTooltip);

            scrollingOnlyIfAtBottom(
                chatOutputWindow, function() {
                    doc.getElementById('messages').appendChild(message);
                });
        });    
}

function displayEvent(account, address, resource, type, content, additionalClass) {
    withConversation(
        account, address, resource, type,
        function(conversation) {
            var chatOutputWindow = _(conversation, {role: 'chat-output'}).contentWindow;
            var doc = chatOutputWindow.document;

            var body = doc.createElement('span');
            body.setAttribute('class', 'body');
            body.textContent = content;

            var event = doc.createElement('li');
            event.setAttribute('class', additionalClass ?
                               'event ' + additionalClass :
                               'event');
            event.appendChild(body);

            scrollingOnlyIfAtBottom(
                chatOutputWindow, function() {
                    doc.getElementById('messages').appendChild(event);
                });
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
            sendChatMessage(
                getAncestorAttribute(event.currentTarget, 'account'),
                getAncestorAttribute(event.currentTarget, 'address'),
                getAncestorAttribute(event.currentTarget, 'resource'),
                getAncestorAttribute(event.currentTarget, 'type'),
                dropdata.data);
        }
    }
};

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

function requestedAttachContent(event) {
    attachContent(getAncestorAttribute(event.target, 'account'),
                  getAncestorAttribute(event.target, 'address'),
                  getAncestorAttribute(event.target, 'type'));
}

function requestedCycleMaximize(command) {
    if(!_('conversations').collapsed &&
       !_('box-auxiliary').collapsed) 
        maximizeConversations();
    else if(_('conversations').collapsed &&
            !_('box-auxiliary').collapsed)
        displayAuxiliaryAndConversations();
    else if(_('box-auxiliary').collapsed &&
            !_('conversations').collapsed)
        maximizeAuxiliary();
}

function clickedContact(contact) {
/*    focusConversation(contact.getAttribute('account'),
                      contact.getAttribute('address'));
*/
    doubleClickedContact(contact);
}

function doubleClickedContact(contact) {
    if(isConversationOpen(contact.getAttribute('account'),
                          contact.getAttribute('address'),
                          '',
                          'groupchat') ||
       isConversationOpen(contact.getAttribute('account'),
                          contact.getAttribute('address'),
                          null,
                          'chat'))
        focusConversation(contact.getAttribute('account'),
                          contact.getAttribute('address'));
    else {
        withConversation(contact.getAttribute('account'),
                          contact.getAttribute('address'),
                          '',
                          'chat',
                          function() {
                              focusConversation(contact.getAttribute('account'),
                                                contact.getAttribute('address'));
                          });
    }
}

function requestedCloseConversation(event) {
    (getAncestorAttribute(event.target, 'type') == 'groupchat' ?
        exitRoom :
        closeConversation).call(null,
                                getAncestorAttribute(event.target, 'account'),
                                getAncestorAttribute(event.target, 'address'),
                                getAncestorAttribute(event.target, 'resource'),
                                getAncestorAttribute(event.target, 'type'));
}

function requestedOpenConversation() {
    var request = {
        address: undefined,
        nick: undefined,
        confirm: false,
        account: undefined,
        type: undefined
    };

    window.openDialog(
        'chrome://sameplace/content/open.xul',
        'sameplace-open-conversation', 'modal,centerscreen',
        request);

    if(request.confirm)
        if(request.type == 'groupchat')
            joinRoom(request.account, request.address, request.nick);
        else
            if(isConversationOpen(request.account,
                                  request.address,
                                  null,
                                  'chat'))
                focusConversation(request.account,
                                  request.address);
            else
                withConversation(request.account, request.address,
                                 '',
                                 'chat',
                                 function() {
                                     focusConversation(request.account,
                                                       request.address);
                                 });
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
   
    window.top.document.getElementById('statusbar-display').label =
        'Account: <' + get('account') + '>, ' +
        'Address: <' + get('address') + '>, ' +
        'Resource: <' + get('resource') + '>, ' +
        'Subscription: <' + get('subscription') + '>, ' +
        'Type: <' + get('type') + '>';
}

function pressedKeyInChatInput(event) {
    if(event.keyCode == KeyEvent.DOM_VK_RETURN) {
        var textBox = event.currentTarget;
        if(event.ctrlKey)
            textBox.value += '\n';
        else {
            event.preventDefault();
                
            if(textBox.value.match(/^\s*$/))
                return;

            if(getAncestorAttribute(textBox, 'type') == 'groupchat') 
                sendChatMessage(
                    getAncestorAttribute(textBox, 'account'),
                    getAncestorAttribute(textBox, 'address'),
                    null,
                    'groupchat',
                    textBox.value);
            else
                sendChatMessage(
                    getAncestorAttribute(textBox, 'account'),
                    getAncestorAttribute(textBox, 'address'),
                    getAncestorAttribute(textBox, 'resource'),
                    getAncestorAttribute(textBox, 'type'),
                    textBox.value);
            textBox.value = '';
            textBox.setAttribute('rows', 1);
        }
    }
}

function openedConversation(account, address, resource, type) {
    contacts.startedConversationWith(account, address, resource);
    _('conversations').collapsed = false;
    if(_('conversations').childNodes.length == 1)
        contacts.nowTalkingWith(account, address);
}

function closedConversation(account, address, resource, type) {
    contacts.stoppedConversationWith(account, address, resource);
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

function setRoomTopic(account, roomAddress, content) {
    XMPP.send(account, 
              <message to={roomAddress} type="groupchat">
              <subject>{content}</subject>
              </message>);
}

function sendChatMessage(account, address, resource, type, text) {
    var jid = address;
    if(resource)
        jid += '/' + resource;
    
    XMPP.send(account,
              <message to={jid} type={type}>
              <body>{text}</body>
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
            address + ' wants to add you to his/her contact list.\nDo you accept?',
            'Also add ' + address + ' to my contact list', check);
        reciprocate = check.value;        
    }
    else {
        accept = prompts.confirm(
            null, 'Contact notification',
            address + ' wants to add you to his/her contact list.\nDo you accept?');

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
    displayChatMessage(
        message.session.name,
        from.address, from.resource,
        message.direction,
        message.stanza.@type,
        message.stanza.@from,
        message.stanza.body);
}

function receivedErrorMessage(message) {
    var from = XMPP.JID(message.stanza.@from);
    displayEvent(
        message.session.name,
        from.address, from.resource,
        'chat',
        'Error: code ' + message.stanza.error.@code,
        'error');
}

function sentChatMessage(message) {
    var from = XMPP.JID(message.stanza.@to);
    displayChatMessage(
        message.session.name,
        from.address, from.resource,
        message.direction,
        message.stanza.@type,
        message.session.name,
        message.stanza.body);
}

function receivedMessageWithURL(message) {
    if(_('conversations', {address: XMPP.JID(message.stanza.@from).address, role: 'follow'})
       .getAttribute('checked') == 'true') {
        var url = message.stanza.body.toString().match(urlRegexp)[0];
        window.top.getBrowser().addTab(url);   
    }
}

function receivedRoomTopic(message) {
    var from = XMPP.JID(message.stanza.@from);
    withConversation(
        message.session.name, from.address, '', 'groupchat',
        function(conversation) {
            var doc = _(conversation, {role: 'chat-output'}).contentDocument;
            doc.getElementById('topic').textContent = message.stanza.subject;
        });

    displayEvent(
        message.session.name,
        from.address, from.resource,
        'groupchat',
        from.nick + ' set the topic to "' +
        message.stanza.subject + '"', 'topic');
}

function receivedRoster(iq) {
    for each(var item in iq.stanza..ns_roster::item) {
        contacts.contactExists(
            iq.session.name,
            item.@jid,
            item.@subscription);
    }
}

function receivedPresence(presence) {
    var from = XMPP.JID(presence.stanza.@from);

    contacts.resourceChangedPresence(
        presence.session.name,
        from.address,
        from.resource,
        presence.stanza.@type,
        presence.stanza.show,
        presence.stanza.status);

    updateResources(
        presence.session.name, from.address,
        from.resource,
        presence.stanza.@type.toString());
}

function sentMUCPresence(presence) {
    var room = XMPP.JID(presence.stanza.@to);
    pendingJoins[room.address] = room.nick;
}

function receivedMUCPresence(presence) {
    var from = XMPP.JID(presence.stanza.@from);

    if(presence.stanza.@type != 'unavailable') {
        var from = XMPP.JID(presence.stanza.@from);
        if(pendingJoins[from.address] &&
           pendingJoins[from.address] == from.nick) {
            createConversation(presence.session.name,
                               from.address,
                               from.nick,
                               'groupchat');    
            delete pendingJoins[from.address];
            focusConversation(presence.session.name, from.address);
            // XXX handle stanza.@from = bareAddress && type == 'error' to cleanup joins
        }
    }

    var eventMessage, eventClass;
    if(presence.stanza.@type.toString() == 'unavailable') {
        eventMessage = from.nick + ' left the room';
        eventClass = 'leave';
    } else {
        eventMessage = from.nick + ' entered the room';
        eventClass = 'join';
    }
    
    displayEvent(
        presence.session.name, from.address, from.resource, 'groupchat',
        eventMessage, eventClass);

    if(presence.stanza.@type.toString() == 'unavailable')
        closeConversation(presence.session.name, from.address, from.resource, 'groupchat');

    contacts.resourceChangedPresence(
        presence.session.name,
        from.address, 
        from.resource,
        presence.stanza.@type);

    if(presence.stanza.@type != 'unavailable')
        contacts.startedConversationWith(
            presence.session.name, from.address);


        // EXPERIMENTAL
//         if(presence.stanza.ns_xul::x.length() > 0) {
//             var agentFrame = document.createElement('iframe');
//             agentFrame.setAttribute('class', 'box-inset');
                
//             participant.appendChild(agentFrame);
//         }

        // EXPERIMENTAL
//         if(presence.stanza.ns_xul::x.length() > 0) {
//             var agentWidget = 
//                 (new DOMParser())
//                 .parseFromString(presence.stanza.ns_xul::x.*[0], 'text/xml')
//                 .documentElement;

//             function addWidget(event) {
//                 agentFrame.contentDocument.documentElement.appendChild(agentWidget);
//                 agentFrame.contentWindow.removeEventListener('load', addWidget, false);
//             }
//             agentFrame.addEventListener('load', addWidget, false);
//             agentFrame.setAttribute('src', 'agent.xul');
//         }
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


