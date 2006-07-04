// ----------------------------------------------------------------------
// GLOBAL DEFINITIONS

var module = new ModuleManager();
var Client = module.require('class', 'xmpp4moz/client');
var moz = new Namespace('http://hyperstruct.net/mozeskine');
var muc = new Namespace('http://jabber.org/protocol/muc#user');
var observerService = Components
    .classes["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);


// ----------------------------------------------------------------------
// GLOBAL STATE

var client, userJid, roomAddress, roomNick;


// ----------------------------------------------------------------------
// GUI INITIALIZATION

function init(event) {
    if(!event.target)
        return;
                  
    _('chat-input').addEventListener(
        'keypress', function(event) {
            chatInputKeypress(event);
        }, false);

    _('chat-output').contentDocument.addEventListener(
        'click', function(event) {
            saveButtonClick(event);
        }, false);

    _('notes').contentDocument.addEventListener(
        'click', function(event) {
            removeButtonClick(event);
        }, false);

    client = new Client();
    client.on(
        {tag: 'data'}, function(data) {
            jabberDebug(data.direction + '/DATA:\n' + data.content);
        });
    client.on(
        {tag: 'message', direction: 'in', stanza: function(s) {
                return s.body.toString();
            }}, function(message) { receiveChatMessage(message); });
    client.on(
        {tag: 'message', direction: 'in', stanza: function(s) {
                return s.moz::x.toXMLString();
            }}, function(message) { receiveAction(message); });
    client.on(
        {tag: 'presence', direction: 'in', stanza: function(s) {
                return s.muc::x.toXMLString();
            }}, function(presence) { receivePresence(presence) });
}

function finish() {
    disconnect();
}


// ----------------------------------------------------------------------
// GUI ACTIONS

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

function cloneBlueprint(name) {
    return document
        .getElementById('blueprints')
        .getElementsByAttribute('role', name)[0]
        .cloneNode(true);
}

function jabberDebug(text) {
    var debugLine = cloneBlueprint('debug-line');
    debugLine.getElementsByAttribute('role', 'content')[0].textContent = text;
    
    _('jabber-debug').appendChild(debugLine);
    _('jabber-debug').ensureElementIsVisible(debugLine);
}


// ----------------------------------------------------------------------
// GUI REACTIONS

function saveButtonClick(event) {
    if(event.target.className != 'action')
        return;

    var messageItem = event.target.parentNode.parentNode;

    var child = messageItem.firstChild;
    while(child && child.getAttribute && child.getAttribute('class') != 'body') 
        child = child.nextSibling;

    if(child)
        sendNoteAddition(child.textContent);
}

function removeButtonClick(event) {
    if(event.target.className != 'action')
        return;

    var note = event.target.parentNode.parentNode;
    sendNoteRemoval(note.id);
}

function chatInputKeypress(event) {
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
// XMPP SESSION START/STOP

function connect() {
    var connectionParams = {
        userAddress: undefined,
        userPassword: undefined,
        userServer: undefined,
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
        {server: connectionParams.userServer, continuation: 
            function() {
                client.send(userJid, <presence to={roomAddress + '/' + roomNick}/>);
            }});        
}

function disconnect() {
    client.signOff(userJid);
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
    packet.moz::x.append = text;
    packet.moz::x.append.@id = userJid + '/' + (new Date()).getTime();
    lastId = packet.moz::x.append.@id;
    client.send(userJid, packet);
}

function sendNoteRemoval(id) {
    var packet = <message to={roomAddress} type="groupchat"/>;
    packet.moz::x.remove.@id = id;
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

function receivePresence(presence) {
    var nick = presence.stanza.@from.toString().match(/\/(.+)$/)[1];
    var item = _('participants').getElementsByAttribute('label', nick)[0];
    if(item) {
        switch(presence.stanza.@type.toString()) {
        case 'unavailable':
            _('participants').removeChild(item);
            break;
        default:
            break;
        }
    } else {
        switch(presence.stanza.@type.toString()) {
        case 'unavailable':
            break;
        default:
            _('participants').appendItem(nick);
        }
    }
}

function receiveAction(message) {
    for each(var action in message.stanza.moz::x.*) {
        switch(action.name().toString()) {
        case moz + '::append':
            displayNewNote(action.@id, action.*[0]);
            break;
        case moz + '::remove':
            eraseExistingNote(action.@id);
            break;
        default:
            break;
        }
    }
}


// ----------------------------------------------------------------------
// INTERFACE UPDATES

function displayChatMessage(from, content) {
    var doc = _('chat-output').contentDocument;

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

    var item = doc.createElement('li');
    item.setAttribute('class', 'message');
    item.appendChild(sender);
    item.appendChild(body);
    item.appendChild(actions);

    doc.getElementById('messages').appendChild(item);
    _('chat-output').contentWindow.scrollTo(0, doc.height);
}

function displayNewNote(id, content) {
    var doc = _('notes').contentDocument;

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

    doc.getElementById('notes').appendChild(note);
    _('notes').contentWindow.scrollTo(0, doc.height);
}

function eraseExistingNote(id) {
    var doc = _('notes').contentDocument;

    var note = doc.getElementById(id);
    if(note)
        note.parentNode.removeChild(note);
}