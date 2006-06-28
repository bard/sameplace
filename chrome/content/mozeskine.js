// ----------------------------------------------------------------------
// GLOBAL DEFINITIONS

var module = new ModuleManager();
var Client = module.require('class', 'xmpp4moz/client');
var moz = new Namespace('http://hyperstruct.net/mozeskine');
var muc = new Namespace('http://jabber.org/protocol/muc#user');

// ----------------------------------------------------------------------
// GLOBAL STATE

var client, userJid, roomJid, roomNick;


// ----------------------------------------------------------------------
// GUI INITIALIZATION

function init(event) {
    if(!event.target)
        return;
                  
    var pref = Components
        .classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch);

    _('user-jid').value      = pref.getCharPref('extensions.mozeskine.userJid');
    _('user-password').value = pref.getCharPref('extensions.mozeskine.userPassword');
    _('room-jid').value      = pref.getCharPref('extensions.mozeskine.roomJid');
    _('room-nick').value     = pref.getCharPref('extensions.mozeskine.roomNick');

    if(!_('user-jid').value.match(/\//))
        _('user-jid').value += '/Mozeskine';

    _('chat-input').addEventListener(
        'keypress', function(event) {
            chatInputKeypress(event);
        }, false);

    _('chat-output').contentDocument.addEventListener(
        'click', function(event) {
            saveActionClick(event);
        }, false);

    client = new Client();
    client.on(
        {tag: 'data'}, function(data) {
            jabberDebug(data.direction + '/DATA:\n' + data.content);
        });
    client.on(
        {tag: 'message', direction: 'in', stanza: function(s) {
                return s.body.toString();
            }}, function(message) { receiveMessage(message); });
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

function showChat() {
    _('main-panel').selectedIndex = 1;
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

function saveActionClick(event) {
    if(event.target.className != 'action')
        return;

    var messageItem = event.target.parentNode.parentNode;

    var child = messageItem.firstChild;
    while(child && child.getAttribute && child.getAttribute('class') != 'body') 
        child = child.nextSibling;

    if(child) {
        var packet = <message to={roomJid} type="groupchat"/>;
        packet.moz::x.append = child.textContent;
        client.send(userJid, packet);                                          
    }
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
    userJid = _('user-jid').value;
    roomJid = _('room-jid').value;
    roomNick = _('room-nick').value;
    
    client.signOn(
        userJid, _('user-password').value,
        {continuation: 
            function() {
                client.send(userJid, <presence to={roomJid + '/' + roomNick}/>);
                showChat();
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
        <message to={roomJid} type="groupchat">
        <body>{text}</body>
        </message>);
}


// ----------------------------------------------------------------------
// NETWORK REACTIONS

function receiveMessage(message) {
    var doc = _('chat-output').contentDocument;

    var actions = doc.createElement('div');
    actions.setAttribute('class', 'actions');

    var saveAction = doc.createElement('a');
    saveAction.setAttribute('class', 'action');
    saveAction.textContent = 'Save';
    actions.appendChild(saveAction);

    var sender = doc.createElement('span');
    sender.textContent = message.stanza.@from.toString().match(/\/(.+)$/)[1];
    sender.setAttribute('class', 'sender');
    var body = doc.createElement('span');
    body.setAttribute('class', 'body');
    body.textContent = message.stanza.body;

    var item = doc.createElement('li');
    item.setAttribute('class', 'message')
    item.appendChild(sender);
    item.appendChild(body);
    item.appendChild(actions);

    doc.getElementById('messages').appendChild(item);
    _('chat-output').contentWindow.scrollTo(0, doc.height);
}

function receivePresence(presence) {
    var nick = presence.stanza.@from.toString().match(/\/(.+)$/)[1];
    if(presence.stanza.@type.toString() == 'unavailable') {
        var item = _('participants').getElementsByAttribute('label', nick)[0];
        if(item)
            _('participants').removeChild(item);
    } else
        _('participants').appendItem(nick);
}

function receiveAction(message) {
    for each(var action in message.stanza.moz::x.*) {
        switch(action.name().toString()) {
        case moz + '::append':
            appendNote(action.*[0]);
            break;
        default:
            break;
        }
    }
}

function appendNote(text) {    
    var doc = _('notes').contentDocument;

    var note = doc.createElement('li');
    note.setAttribute('class', 'note');
    note.textContent = text;
    doc.getElementById('notes').appendChild(note);    
}