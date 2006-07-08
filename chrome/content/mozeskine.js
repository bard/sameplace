// ----------------------------------------------------------------------
// GLOBAL DEFINITIONS

const Cc = Components.classes;
const Ci = Components.interfaces;

const pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefBranch);
const mediatorService = Cc['@mozilla.org/appshell/window-mediator;1']
    .getService(Ci.nsIWindowMediator);
const loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
    .getService(Ci.mozIJSSubScriptLoader);

loader.loadSubScript('chrome://mozeskine/content/xmpp4moz/xmpp.js');
var urlRegexp = new RegExp('(http:\/\/|www.)[^ \\t\\n\\f\\r"<>|()]*[^ \\t\\n\\f\\r"<>|,.!?(){}]');

var ns_notes = new Namespace('http://hyperstruct.net/mozeskine/protocol/0.1.4#notes');
var ns_agent = new Namespace('http://hyperstruct.net/mozeskine/protocol/0.1.4#agent');
var ns_muc = new Namespace('http://jabber.org/protocol/muc#user');
var ns_xul = new Namespace('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul');


// ----------------------------------------------------------------------
// GLOBAL STATE

var channel, userJid, roomTopic = '';


// ----------------------------------------------------------------------
// GUI INITIALIZATION

function init(event) {
    if(!event.target)
        return;

    _('chat-input')
        .addEventListener('keypress', pressedKeyInChatInput, false);
    _('chat-output').contentDocument
        .addEventListener('click', clickedSaveButton, false);
    _('chat-output').contentDocument
        .addEventListener('click', clickedHeader, false);
    _('chat-output').contentWindow.
        addEventListener(
            'resize', function(event) {
                displayRoomTopic();
            }, false);
    _('room-address').value = pref.getCharPref('extensions.mozeskine.roomAddress');
    _('room-nick').value    = pref.getCharPref('extensions.mozeskine.roomNick');

    channel = XMPP.createChannel();

    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.body.toString();
            }}, function(message) { receiveChatMessage(message); });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.ns_notes::x.toXMLString();
            }}, function(message) { receiveAction(message); });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.ns_muc::x.toXMLString();
            }}, function(presence) { receivePresence(presence) });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.@type == 'groupchat' && s.subject.toString();
            }}, function(message) { receiveRoomTopic(message); });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.ns_muc::x.toXMLString();
            }}, function(presence) { receivePresence(presence) });
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
// GUI UTILITIES

function setCroppedContent(element, content) {
    element.textContent = content;
    var containerWidth = element.parentNode.offsetWidth;

    while(element.offsetWidth > containerWidth) {
        content = content.substring(0, content.length-1);
        element.textContent = content + '\u2026';
    }
} 

function _(id) {
    return document.getElementById(id);
}

function scrollTextBox(textBox) {
    var textArea = textBox
        .ownerDocument
        .getAnonymousNodes(textBox)[0]
        .firstChild;
    textArea.scrollTop = textArea.scrollHeight;        
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
    var enumerator = mediatorService.getEnumerator('');
    while(enumerator.hasMoreElements()) {
        var window = enumerator.getNext();
        if(window.name == name)
            return window;
    }
}

// ----------------------------------------------------------------------
// GUI ACTIONS

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

function displayChatMessage(from, content) {
    var doc = _('chat-output').contentDocument;
    var wnd = _('chat-output').contentWindow;

    var actions = doc.createElement('div');
    actions.setAttribute('class', 'actions');

    var saveAction = doc.createElement('a');
    saveAction.setAttribute('class', 'action');
    saveAction.textContent = 'Save';
    actions.appendChild(saveAction);

    var sender = doc.createElement('span');
    var m = from.match(/\/(.+)$/);
    sender.textContent = m ? m[1] : from;
    sender.setAttribute('class', 'sender');
    var body = doc.createElement('span');
    body.setAttribute('class', 'body');
    body.textContent = content;

    var message = doc.createElement('li');
    message.setAttribute('class', 'message');
    message.appendChild(sender);
    message.appendChild(body);
    message.appendChild(actions);

    scrollingOnlyIfAtBottom(
        wnd, function() {
            doc.getElementById('messages').appendChild(message);
        });
}

function displayRoomTopic(content) {
    roomTopic = roomTopic || content || '';

    setCroppedContent(
        _('chat-output').contentDocument.getElementById('topic'),
        roomTopic);
}

function displayEvent(content, additionalClass) {
    var doc = _('chat-output').contentDocument;
    var wnd = _('chat-output').contentWindow;

    var body = doc.createElement('span');
    body.setAttribute('class', 'body');
    body.textContent = content;

    var event = doc.createElement('li');
    event.setAttribute('class', additionalClass ?
                       'event ' + additionalClass :
                       'event');
    event.appendChild(body);

    scrollingOnlyIfAtBottom(
        wnd, function() {
            doc.getElementById('messages').appendChild(event);
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

function clickedSaveButton(event) {
    if(event.target.className != 'action')
        return;

    var messageItem = event.target.parentNode.parentNode;

    var child = messageItem.firstChild;
    while(child && child.getAttribute && child.getAttribute('class') != 'body') 
        child = child.nextSibling;

    if(child)
        sendNoteAddition(child.textContent);
}

function clickedHeader(event) {
    if(event.target.id != 'header' && event.target.id != 'topic')
        return;

    var input = { value: '' };
    var check = { value: false };
    if(Components
       .classes["@mozilla.org/embedcomp/prompt-service;1"]
       .getService(Components.interfaces.nsIPromptService)
       .prompt(null, 'Mozeskine', 'Set topic for this room:', input, null, check))
        XMPP.send(
            userJid,
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
                
            if(event.currentTarget.value.match(/^\s*$/))
                return;
                    
            sendMessage(event.currentTarget.value);
            event.currentTarget.value = '';
        }
    }
}


// ----------------------------------------------------------------------
// NETWORK ACTIONS

function joinRoom(address, nick) {
    userJid = XMPP.activeSessionNames[0];
    roomAddress = address;

    XMPP.send(
        userJid,
        <presence to={address + '/' + nick}/>);
    _('chat-input').focus();

    pref.setCharPref('extensions.mozeskine.roomAddress', _('room-address').value);
    pref.setCharPref('extensions.mozeskine.roomNick', _('room-nick').value);    
}

function sendMessage(text) {
    var roomAddress = _('room-address').value;
    XMPP.send(
        userJid,
        <message to={roomAddress} type="groupchat">
        <body>{text}</body>
        </message>);
}

function sendNoteAddition(text) {
    var packet = <message to={roomAddress} type="groupchat"/>;
    packet.ns_notes::x.append = text;
    packet.ns_notes::x.append.@id = userJid + '/' + (new Date()).getTime();
    lastId = packet.ns_notes::x.append.@id;
    XMPP.send(userJid, packet);
}

function sendNoteRemoval(id) {
    var packet = <message to={roomAddress} type="groupchat"/>;
    packet.ns_notes::x.remove.@id = id;
    XMPP.send(userJid, packet);
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
    var from = message.stanza.@from.toString();
    var m = from.match(/\/(.+)$/);
    var nick = m ? m[1] : from;
    
    displayEvent(nick + ' set the topic to "' + message.stanza.subject + '"', 'topic');
    displayRoomTopic(message.stanza.subject.toString());
}

function receivePresence(presence) {
    var nick = presence.stanza.@from.toString().match(/\/(.+)$/)[1];
    var item = _('participants').getElementsByAttribute('nick', nick)[0];

    if(item) {
        switch(presence.stanza.@type.toString()) {
        case 'unavailable':
            _('participants').removeChild(item);
            displayEvent(nick + ' left the room', 'leave');
            break;
        default:
            break;
        }
    } else {
        switch(presence.stanza.@type.toString()) {
        case 'unavailable':
            break;
        default:
            item = document.createElement('richlistitem');
            item.setAttribute('nick', nick); // TODO: namespace this
            item.setAttribute('orient', 'horizontal');
            item.setAttribute('align', 'center');
            item.setAttribute('class', 'participant');
            var image = document.createElement('image');
            var label = document.createElement('label');
            label.setAttribute('value', nick);
            item.appendChild(image);
            item.appendChild(label);

            if(presence.stanza.ns_xul::x.length() > 0) {
                var agentFrame = document.createElement('iframe');
                agentFrame.setAttribute('class', 'box-inset');
                
                item.appendChild(agentFrame);
            }

            _('participants').appendChild(item);

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
            
            displayEvent(nick + ' entered the room', 'join');
        }
    }
}

function receiveAction(message) {
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
