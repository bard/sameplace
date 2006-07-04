// ----------------------------------------------------------------------
// GLOBAL DEFINITIONS

var module = new ModuleManager();
var Client = module.require('class', 'xmpp4moz/client');
var observerService = Components
    .classes["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);

var ns_notes = new Namespace('http://hyperstruct.net/mozeskine/protocol/0.1.4#notes');
var ns_agent = new Namespace('http://hyperstruct.net/mozeskine/protocol/0.1.4#agent');
var ns_muc = new Namespace('http://jabber.org/protocol/muc#user');
var ns_xul = new Namespace('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul');


// ----------------------------------------------------------------------
// GLOBAL STATE

var client, userJid, roomAddress, roomNick, roomTopic = '';


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
    _('notes').contentDocument
        .addEventListener('click', clickedRemoveButton, false);

    _('chat-output').contentWindow.addEventListener(
        'resize', function(event) {
            setCroppedContent(
                _('chat-output').contentDocument.getElementById('topic'),
                roomTopic);
        }, false);
        
    client = new Client();
    client.on(
        {tag: 'message', direction: 'in', stanza: function(s) {
                return s.body.toString();
            }}, function(message) { receiveChatMessage(message); });
    client.on(
        {tag: 'message', direction: 'in', stanza: function(s) {
                return s.ns_notes::x.toXMLString();
            }}, function(message) { receiveAction(message); });
    client.on(
        {tag: 'message', direction: 'in', stanza: function(s) {
                return s.@type == 'groupchat' && s.subject.toString();
            }}, function(message) { receiveRoomTopic(message); });
    client.on(
        {tag: 'presence', direction: 'in', stanza: function(s) {
                return s.ns_muc::x.toXMLString();
            }}, function(presence) { receivePresence(presence) });
}

function finish() {
    disconnect();
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


// ----------------------------------------------------------------------
// GUI ACTIONS

function jabberDebug(text) {
    var debugLine = cloneBlueprint('debug-line');
    debugLine.getElementsByAttribute('role', 'content')[0].textContent = text;
    
    _('jabber-debug').appendChild(debugLine);
    _('jabber-debug').ensureElementIsVisible(debugLine);
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
    sender.textContent = from.match(/\/(.+)$/)[1];
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
    roomTopic = content;

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
    var doc = _('notes').contentDocument;
    var wnd = _('notes').contentWindow;

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
        wnd, function() {
            doc.getElementById('notes').appendChild(note);
        });
}

function eraseExistingNote(id) {
    var doc = _('notes').contentDocument;

    var note = doc.getElementById(id);
    if(note)
        note.parentNode.removeChild(note);
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
        client.send(
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
// XMPP SESSION START/STOP/DISPLAY

function connect() {
    var connectionParams = {
        userAddress: undefined,
        userPassword: undefined,
        userServerHost: undefined,
        userServerPort: undefined,
        roomAddress: undefined,
        roomNick: undefined,
        confirm: false
    };
    window.openDialog('connect.xul', 'connect', 'chrome,modal,centerscreen', connectionParams);

    if(!connectionParams.confirm)
        return;

    userJid     = connectionParams.userAddress + '/Mozeskine';
    roomAddress = connectionParams.roomAddress;
    roomNick    = connectionParams.roomNick;
        
    client.signOn(
        userJid, connectionParams.userPassword,
        {server: connectionParams.userServerHost,
                port: connectionParams.userServerPort,
                continuation: 
            function() {
                client.send(userJid, <presence to={roomAddress + '/' + roomNick}/>);
            }});        
}

function disconnect() {
    client.signOff(userJid);
}

function debug() {
    var debugWindow = window.open('debug.xul', 'mozeskine-debug', 'chrome,alwaysRaised');

    client.on(
        {tag: 'data'}, function(data) {
            if(!debugWindow.closed)
                debugWindow.display(data.direction + '/DATA:\n' + data.content);
        });

    // TODO when client will support removal of listeners:
    //     debugWindow.addEventListener(
    //         'unload', function(event) {
    //             client.forget({tag: 'data'}, listenerReference);
    //         }, false);
}

// ----------------------------------------------------------------------
// NETWORK ACTIONS

function sendMessage(text) {
    client.send(
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
    client.send(userJid, packet);
}

function sendNoteRemoval(id) {
    var packet = <message to={roomAddress} type="groupchat"/>;
    packet.ns_notes::x.remove.@id = id;
    client.send(userJid, packet);
}


// ----------------------------------------------------------------------
// NETWORK REACTIONS

function receiveChatMessage(message) {
    displayChatMessage(
        message.stanza.@from.toString(),
        message.stanza.body);

    observerService.notifyObservers(
        null, 'im-incoming', message.stanza.toString());
}

function receiveRoomTopic(message) {
    var nick = message.stanza.@from.toString().match(/\/(.+)$/)[1];
    
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
            item.setAttribute('nick', nick);
            var label = document.createElement('label');
            label.setAttribute('value', nick);
            item.appendChild(label);
            _('participants').appendChild(item);
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
