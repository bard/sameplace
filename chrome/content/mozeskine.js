// ----------------------------------------------------------------------
// GLOBAL DEFINITIONS

const Cc = Components.classes;
const Ci = Components.interfaces;

const pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefBranch);
const mediator = Cc['@mozilla.org/appshell/window-mediator;1']
    .getService(Ci.nsIWindowMediator);
const prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);

var urlRegexp = new RegExp('(http:\/\/|www.)[^ \\t\\n\\f\\r"<>|()]*[^ \\t\\n\\f\\r"<>|,.!?(){}]');

var ns_notes = new Namespace('http://hyperstruct.net/mozeskine/protocol/0.1.4#notes');
var ns_agent = new Namespace('http://hyperstruct.net/mozeskine/protocol/0.1.4#agent');
var ns_muc = new Namespace('http://jabber.org/protocol/muc#user');
var ns_xul = new Namespace('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul');


// ----------------------------------------------------------------------
// GLOBAL STATE

var channel, account = {};


// ----------------------------------------------------------------------
// GUI INITIALIZATION

function init(event) {
    if(!event.target)
        return;

    _('contact-list').selectedIndex = -1;

    channel = XMPP.createChannel();

    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.ns_muc::x.toXMLString();
            }}, function(presence) { receiveMUCPresence(presence) });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.body.toString();
            }}, function(message) { receiveChatMessage(message); });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.ns_notes::x.toXMLString();
            }}, function(message) { receiveNoteAction(message); });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.@type == 'groupchat' && s.subject.toString();
            }}, function(message) { receiveRoomTopic(message); });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return (s.body.toString() &&
                        s.body.toString().search(urlRegexp) != -1);
            }}, function(message) { receiveMessageWithURL(message); });
}

function finish() {
    channel.release();
}


// ----------------------------------------------------------------------
// UTILITIES

function JID(string) {
    var m = string.match(/^(.+?)@(.+?)(?:\/|$)(.*$)/);
    var jid = {
        username: m[1],
        hostname: m[2],
        resource: m[3],
        nick: m[3],
        address: m[1] + '@' + m[2],
        full: m[3] ? string : null
    }

    return jid;
}


// ----------------------------------------------------------------------
// GUI UTILITIES (GENERIC)

// Note: only place here functions that will work with any GUI.  See
// GUI UTILITIES (SPECIFIC) for functions specific to this GUI.

function getAncestorAttribute(element, attributeName) {
    while(element.parentNode) {
        if(element.parentNode.hasAttribute(attributeName))
            return element.parentNode.getAttribute(attributeName);
        element = element.parentNode;
    }
}

function withDocumentOf(window, action) {
    if(window.document.location.href == 'about:blank' ||
       !window.document.getElementsByTagName('body'))
        window.addEventListener(
            'load', function(event) {
                action(event.target);
            }, false);
    else
        action(window.document);
}
withDocumentOf.doc = 'Execute an action if document has loaded, \
otherwise schedule it for when it has finished loading.';

function x() {
    var contextNode, path;
    if(arguments[0] instanceof XULElement) {
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

function _(id) {
    return document.getElementById(id);
}

function scrollingOnlyIfAtBottom(window, action) {
    var scroll = !(window.pageYOffset < window.scrollMaxY);
    action();
    if(scroll)
        window.scrollTo(0, window.document.height);
}

function findBrowser(url) {
    var tabBrowser = window.top.getBrowser();
    var browser;
    var numTabs = tabBrowser.mPanelContainer.childNodes.length;
    var index = 0;
    while (index < numTabs) {
        browser = tabBrowser.getBrowserAtIndex(index);
        if (url == browser.currentURI.spec)
            return browser;
        index++;
    }
}

function findWindow(name) {
    var enumerator = mediator.getEnumerator('');
    while(enumerator.hasMoreElements()) {
        var window = enumerator.getNext();
        if(window.name == name)
            return window;
    }
}


// ----------------------------------------------------------------------
// GUI UTILITIES (SPECIFIC)

function withNotesWindow(code) {
    var browser = findBrowser('chrome://mozeskine/content/notes.html');
        
    if(browser)
        code(browser.contentWindow);
    else {
        var tabBrowser = window.top.getBrowser();

        if(tabBrowser.currentURI.spec != 'about:blank') 
            tabBrowser.selectedTab = tabBrowser.addTab();
        
        browser = tabBrowser.selectedBrowser;

        browser.addEventListener(
            'click', clickedRemoveButton, false);

        browser.addEventListener(
            'load', function(event) {
                code(browser.contentWindow);
            }, true);
        
        browser.loadURI('chrome://mozeskine/content/notes.html');        
    } 
}

function withContactInfoOf(address, action) {
    action(_('contact-infos').getElementsByAttribute('address', address)[0]);
}


// ----------------------------------------------------------------------
// GUI ACTIONS

function ensureConversationIsOpen(address, resource, type) {
    var conversation = _('conversations').getElementsByAttribute('address', address)[0];
    if(!conversation) {
        conversation = cloneBlueprint('conversation');
        conversation.setAttribute('address', address);
        conversation.setAttribute('resource', resource);
        conversation.setAttribute('type', type);
        _('conversations').appendChild(conversation);
        _('conversations').selectedPanel = conversation;

        conversation.getElementsByAttribute('role', 'chat-input')[0]
            .addEventListener('keypress', pressedKeyInChatInput, false);
        conversation.getElementsByAttribute('role', 'chat-output')[0]
            .addEventListener('click', clickedSaveButton, true);
        conversation.getElementsByAttribute('role', 'chat-output')[0]
            .focus();
    }
    return conversation;
}

function ensureContactInfoIsOpen(address, resource, type) {
    var contactInfo = _('contact-infos').getElementsByAttribute('address', address)[0];
    if(!contactInfo) {
        contactInfo = cloneBlueprint('contact-info');
        contactInfo.setAttribute('address', address);
        contactInfo.setAttribute('resource', resource);
        contactInfo.setAttribute('type', type);
        _('contact-infos').appendChild(contactInfo);
        _('contact-infos').selectedPanel = contactInfo;
    }
    return contactInfo;
}

function displayChatMessage(from, content) {
    // TODO REFACTOR
    var chatOutput = _('conversations')
        .getElementsByAttribute('address', JID(from).address)[0]
        .getElementsByAttribute('role', 'chat-output')[0];
    
    var doc = chatOutput.contentDocument;
    var wnd = chatOutput.contentWindow;

    var actions = doc.createElement('div');
    actions.setAttribute('class', 'actions');

    var saveAction = doc.createElement('a');
    saveAction.setAttribute('class', 'action');
    saveAction.textContent = 'Save';
    actions.appendChild(saveAction);

    var sender = doc.createElement('span');
    sender.textContent = JID(from).resource || JID(from).address;
    sender.setAttribute('class', 'sender');
    var body = doc.createElement('span');
    body.setAttribute('class', 'body');
    body.textContent = content;

    var message = doc.createElement('li');
    message.setAttribute('class', 'message');
    message.appendChild(sender);
    message.appendChild(body);
    message.appendChild(actions);

    withDocumentOf(
        wnd, function(doc) {
            scrollingOnlyIfAtBottom(
                wnd, function() {
                    doc.getElementById('messages').appendChild(message);
                });            
        });
}

function displayEvent(content, additionalClass) {
    // TODO REFACTOR
    var chatOutput = _('conversations')
        .getElementsByAttribute('role', 'chat-output')[0];
    
    var doc = chatOutput.contentDocument;
    var wnd = chatOutput.contentWindow;

    var body = doc.createElement('span');
    body.setAttribute('class', 'body');
    body.textContent = content;

    var event = doc.createElement('li');
    event.setAttribute('class', additionalClass ?
                       'event ' + additionalClass :
                       'event');
    event.appendChild(body);

    withDocumentOf(
        wnd, function(doc) {
            scrollingOnlyIfAtBottom(
                wnd, function() {
                    doc.getElementById('messages').appendChild(event);
                });            
        });
}

function displayNewNote(id, content) {
    withNotesWindow(
        function(window) {
            var doc = window.document;

            var actions = doc.createElement('div');
            actions.setAttribute('class', 'actions');

            var removeAction = doc.createElement('a');
            removeAction.setAttribute('class', 'action');
            removeAction.textContent = 'Remove';
            actions.appendChild(removeAction);

            var body = doc.createElement('span');
            body.setAttribute('class', 'body');
            body.textContent = content;

            var note = doc.createElement('li');
            note.setAttribute('id', id);
            note.setAttribute('class', 'note');
            note.appendChild(body);
            note.appendChild(actions);

            scrollingOnlyIfAtBottom(
                window, function() {
                    doc.getElementById('notes').appendChild(note);
                });            
        });
}

function eraseExistingNote(id) {
    withNotesWindow(
        function(window) {
            var doc = window.document;
            var note = doc.getElementById(id);
            if(note)
                note.parentNode.removeChild(note);            
        });
}


// ----------------------------------------------------------------------
// GUI REACTIONS

function requestedCloseConversation() {
    closeConversation(_('conversations').selectedPanel.getAttribute('address'));
}

function requestedOpenConversation() {
    var params = {
        contactId: undefined,
        isRoom: false,
        roomNick: undefined,
        confirm: false
    };

    window.openDialog(
        'chrome://mozeskine/content/open.xul',
        'mozeskine-open-conversation', 'modal,centerscreen',
        params);

    if(params.confirm)
        openConversation(params.contactId, params.roomNick);
}

function clickedSaveButton(event) {
    if(event.target.className != 'action')
        return;

    var roomAddress = getAncestorAttribute(event.currentTarget, 'address');

    var messageItem = event.target.parentNode.parentNode;

    var child = messageItem.firstChild;
    while(child && child.getAttribute && child.getAttribute('class') != 'body') 
        child = child.nextSibling;

    if(child)
        sendNoteAddition(roomAddress, child.textContent);
}

function clickedTopic(event) {
    var roomAddress = getAncestorAttribute(event.target, 'address');
    
    var input = { value: '' };
    var check = { value: false };

    if(prompts.prompt(null, 'Mozeskine', 'Set topic for this room:', input, null, check))
        XMPP.send(account, 
                  <message to={roomAddress} type="groupchat">
                  <subject>{input.value}</subject>
                  </message>);
}

function clickedRemoveButton(event) {
    if(event.target.className != 'action')
        return;

    var note = event.target.parentNode.parentNode;
    sendNoteRemoval(note.id);
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

            var roomAddress = getAncestorAttribute(textBox, 'address');
            sendChatMessage(roomAddress, textBox.value);
            textBox.value = '';
        }
    }
}


// ----------------------------------------------------------------------
// NETWORK ACTIONS

// Note: these should *not* contain code to fetch information from the
// GUI, a separate function should do that instead and pass
// information here via function parameters.

function closeConversation(roomAddress) {
    XMPP.send(account, <presence to={roomAddress + '/' + nick}/>);
}

function openConversation(roomAddress, roomNick) {
    XMPP.send(account, <presence to={roomAddress + '/' + roomNick}/>);
}

function sendChatMessage(roomAddress, text) {
    alert(account.jid)
    XMPP.send(account,
              <message to={roomAddress} type="groupchat">
              <body>{text}</body>
              </message>);
}

function sendNoteAddition(roomAddress, text) {
    var packet = <message to={roomAddress} type="groupchat"/>;
    packet.ns_notes::x.append = text;
    packet.ns_notes::x.append.@id = account.jid + '/' + (new Date()).getTime();
    lastId = packet.ns_notes::x.append.@id;
    XMPP.send(account, packet);
}

function sendNoteRemoval(roomAddress, id) {
    var packet = <message to={roomAddress} type="groupchat"/>;
    packet.ns_notes::x.remove.@id = id;
    XMPP.send(account, packet);
}


// ----------------------------------------------------------------------
// NETWORK REACTIONS

function receiveChatMessage(message) {
    displayChatMessage(
        message.stanza.@from.toString(),
        message.stanza.body);
}

function receiveMessageWithURL(message) {
    if(!_('follow-mode').checked)
        return;
    
    var url = message.stanza.body.toString().match(urlRegexp)[0];
    window.top.getBrowser().addTab(url);
}

function receiveRoomTopic(message) {
    var from = JID(message.stanza.@from);
    displayEvent(from.nick + ' set the topic to "' +
                 message.stanza.subject + '"', 'topic');
    
    withContactInfoOf(
        from.address, function(info) {
            info.getElementsByAttribute('role', 'topic')[0].textContent =
                message.stanza.subject.toString();
        });
}

function receiveMUCPresence(presence) {
    var from = JID(presence.stanza.@from);

    var conversation = ensureConversationIsOpen(from.address);
    var contactInfo = ensureContactInfoIsOpen(from.address);
    var participants = contactInfo.getElementsByAttribute('role', 'participants')[0];
    var participant = participants.getElementsByAttribute('nick', from.nick)[0];

    if(participant) {
        switch(presence.stanza.@type.toString()) {
        case 'unavailable':
            participants.removeChild(participant);
            displayEvent(from.nick + ' left the room', 'leave');
            break;
        default:
            break;
        }
    } else {
        switch(presence.stanza.@type.toString()) {
        case 'unavailable':
            break;
        default:
            participant = document.createElement('richlistitem');
            participant.setAttribute('nick', from.nick); // TODO: namespace this
            participant.setAttribute('orient', 'horizontal');
            participant.setAttribute('align', 'center');
            participant.setAttribute('class', 'participant');
            var image = document.createElement('image');
            var label = document.createElement('label');
            label.setAttribute('value', from.nick);
            participant.appendChild(image);
            participant.appendChild(label);

            // EXPERIMENTAL
            if(presence.stanza.ns_xul::x.length() > 0) {
                var agentFrame = document.createElement('iframe');
                agentFrame.setAttribute('class', 'box-inset');
                
                participant.appendChild(agentFrame);
            }

            participants.appendChild(participant);

            if(presence.stanza.ns_xul::x.length() > 0) {
                var agentWidget = 
                    (new DOMParser())
                    .parseFromString(presence.stanza.ns_xul::x.*[0], 'text/xml')
                    .documentElement;

                function addWidget(event) {
                    agentFrame.contentDocument.documentElement.appendChild(agentWidget);
                    agentFrame.contentWindow.removeEventListener('load', addWidget, false);
                }
                agentFrame.addEventListener('load', addWidget, false);
                agentFrame.setAttribute('src', 'agent.xul');
            }
            
            displayEvent(from.nick + ' entered the room', 'join');
        }
    }
}

function receiveNoteAction(message) {
    for each(var action in message.stanza.ns_notes::x.*) {
        switch(action.name().toString()) {
        case ns_notes + '::append':
            displayNewNote(action.@id, action.*[0]);
            break;
        case ns_notes + '::remove':
            eraseExistingNote(action.@id);
            break;
        default:
            break;
        }
    }
}
