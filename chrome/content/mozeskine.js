// ----------------------------------------------------------------------
// GLOBAL DEFINITIONS

var module = new ModuleManager();
var Client = module.require('class', 'xmpp4moz/client');
var moz = new Namespace('http://hyperstruct.net/mozeskine');
var muc = new Namespace('http://jabber.org/protocol/muc#user');

// ----------------------------------------------------------------------
// GLOBAL STATE

var client, userJid, roomAddress, roomNick;


// ----------------------------------------------------------------------
// GUI INITIALIZATION

function init(event) {
    if(!event.target)
        return;
                  
    var pref = Components
        .classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch);

    _('user-address').value  = pref.getCharPref('extensions.mozeskine.userAddress');
    _('user-password').value = pref.getCharPref('extensions.mozeskine.userPassword');
    _('room-address').value  = pref.getCharPref('extensions.mozeskine.roomAddress');
    _('room-nick').value     = pref.getCharPref('extensions.mozeskine.roomNick');
    _('user-server').value   = pref.getCharPref('extensions.mozeskine.connectionServer');
    if(!_('user-server').value)
        updateUserServer(_('user-address').value);

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
        var packet = <message to={roomAddress} type="groupchat"/>;
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

function updateUserServer(userAddress) {
    var m = userAddress.match(/@(.+)$/);
    if(m) 
        _('user-server').value =
            (m[1] == 'gmail.com') ?
            'talk.google.com' :
             m[1];
}

function savePrefs() {
    var pref = Components
        .classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch);

    pref.setCharPref('extensions.mozeskine.userAddress', _('user-address').value);
    pref.setCharPref('extensions.mozeskine.connectionServer', _('user-server').value);
    pref.setCharPref('extensions.mozeskine.roomAddress', _('room-address').value);
    pref.setCharPref('extensions.mozeskine.roomNick', _('room-nick').value);    
}


// ----------------------------------------------------------------------
// XMPP SESSION START/STOP

function connect() {
    userJid = _('user-address').value + '/Mozeskine';
    roomAddress = _('room-address').value;
    roomNick = _('room-nick').value;

    client.signOn(
        userJid, _('user-password').value,
        {server: _('user-server').value, continuation: 
            function() {
                client.send(userJid, <presence to={roomAddress + '/' + roomNick}/>);
                showChat();
                savePrefs();
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