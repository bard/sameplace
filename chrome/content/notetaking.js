// ----------------------------------------------------------------------
// GLOBAL DEFINITIONS

var ns_notes = new Namespace('http://hyperstruct.net/mozeskine/protocol/0.1.4#notes');


// ----------------------------------------------------------------------
// GUI INITIALIZATION

window.addEventListener(
    'load', function(event) {
        channel.on(
            {event: 'message', direction: 'in', stanza: function(s) {
                    return s.ns_notes::x.toXMLString();
                }}, function(message) { receiveNoteAction(message); });

        addHook('open conversation', function(conversation) {
                    _(conversation, {role: 'chat-output'}).addEventListener(
                        'click', function(event) { clickedSaveButton(event); }, true);                    
                });
    }, false);


// ----------------------------------------------------------------------
// GUI UTILITIES (SPECIFIC)

function withNotesWindow(account, address, code) {
    var browser = findBrowser(account, address, 'chrome://mozeskine/content/notes.html');
    
    if(browser)
        code(browser.contentWindow);
    else {
        var tabBrowser = window.top.getBrowser();

        if(tabBrowser.currentURI.spec != 'about:blank') 
            tabBrowser.selectedTab = tabBrowser.addTab();
        
        browser = tabBrowser.selectedBrowser;

        browser.addEventListener(
            'click', function(event) { clickedRemoveButton(event); }, false);

        browser.addEventListener(
            'load', function(event) {
                code(browser.contentWindow);
            }, true);
        
        browser.loadURI('chrome://mozeskine/content/notes.html');
        browser.setAttribute('account', account);
        browser.setAttribute('address', address);
    } 
}


// ----------------------------------------------------------------------
// GUI ACTIONS

function displayNewNote(account, address, id, content) {
    withNotesWindow(
        account, address,
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

function eraseExistingNote(account, address, id) {
    withNotesWindow(
        account, address,
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
        sendNoteAddition(getAncestorAttribute(event.currentTarget, 'account'),
                         getAncestorAttribute(event.currentTarget, 'address'),
                         getAncestorAttribute(event.currentTarget, 'resource'),
                         child.textContent);
}

function clickedRemoveButton(event) {
    if(event.target.className != 'action')
        return;

    var note = event.target.parentNode.parentNode;

    sendNoteRemoval(
        event.currentTarget.getAttribute('account'),
        event.currentTarget.getAttribute('address'),
        note.id);
}


// ----------------------------------------------------------------------
// NETWORK ACTIONS

function sendNoteAddition(account, roomAddress, roomNick, text) {
    var packet = <message to={roomAddress} type="groupchat"/>;
    packet.ns_notes::x.append = text;
    packet.ns_notes::x.append.@id = roomAddress + '/' + roomNick +
        '/' + (new Date()).getTime();
    lastId = packet.ns_notes::x.append.@id;
    XMPP.send(account, packet);
}

function sendNoteRemoval(account, roomAddress, id) {
    var packet = <message to={roomAddress} type="groupchat"/>;
    packet.ns_notes::x.remove.@id = id;
    XMPP.send(account, packet);
}


// ----------------------------------------------------------------------
// NETWORK REACTIONS

function receiveNoteAction(message) {
    var account = message.session.name;
    var address = JID(message.stanza.@from).address;

    for each(var action in message.stanza.ns_notes::x.*) {
        switch(action.name().toString()) {
        case ns_notes + '::append':
            displayNewNote(
                account, address,
                action.@id, action.*[0]);
            break;
        case ns_notes + '::remove':
            eraseExistingNote(
                account, address,
                action.@id);
            break;
        default:
            break;
        }
    }
}
