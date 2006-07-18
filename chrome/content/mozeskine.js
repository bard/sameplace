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

var ns_notes = new Namespace('http://hyperstruct.net/mozeskine/protocol/0.1.4#notes');
var ns_agent = new Namespace('http://hyperstruct.net/mozeskine/protocol/0.1.4#agent');
var ns_muc = new Namespace('http://jabber.org/protocol/muc#user');
var ns_xul = new Namespace('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul');

var urlRegexp = new RegExp('(http:\/\/|www.)[^ \\t\\n\\f\\r"<>|()]*[^ \\t\\n\\f\\r"<>|,.!?(){}]');
var smileyMap = {
    '0:-)':  'angel',
    ':\'(':  'crying',
    '>:-)':  'devil-grin',
    '>:-(':  'devil-sad',
    'B-)':   'glasses',
    ':-*':   'kiss',
    ':-(|)': 'monkey',
    ':-|':   'plain',
    ':-(':   'sad',
    ':-)':   'smile',
    ':-D':   'smile-big',
    ':-!':   'smirk',
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


// ----------------------------------------------------------------------
// GLOBAL STATE

var channel, hooks = {};


// ----------------------------------------------------------------------
// GUI INITIALIZATION

function init(event) {
    if(!event.target)
        return;

    _('contact-list').selectedIndex = -1;

    channel = XMPP.createChannel();

    channel.on(
        {event: 'presence', direction: 'in' },
        function(presence) { receivePresence(presence) });
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

function addHook(hookName, handler) {
    if(!hooks[hookName])
        hooks[hookName] = [];

    hooks[hookName].push(handler);
}

function callHook(hookName, param) {
    if(hooks[hookName])
        for each(hookHandler in hooks[hookName])
            hookHandler(param);
}


// ----------------------------------------------------------------------
// GUI UTILITIES (GENERIC)

// Note: only place here functions that will work with any GUI.  See
// GUI UTILITIES (SPECIFIC) for functions specific to this GUI.
         
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
                             'chrome://mozeskine/skin/emoticons/' +
                             smileyMap[match[0]] +
                             '.png');
        } else {
            //translatedElement = doc.createElement('a');
            //translatedElement.textContent = match[0];
            translatedElement = doc.createTextNode(match[0]);
        }
        container.appendChild(translatedElement);

        match = rx.exec(text);
    }
    container.appendChild(
        doc.createTextNode(
            text.substring(start, text.length)));
/*
  var links = container.getElementsByTagName('a');
  var link;
  for(var i=0; link = links[i]; i++)
  link.addEventListener(
  'click', function(event) {
  var url = event.target.textContent;
  if(url.match(/^www\./))
  url = 'http://' + url;
  window.top.content.location = url;
  }, false);
*/

    return container;
}

function getAncestorAttribute(element, attributeName) {
    while(element.parentNode) {
        if(element.parentNode.hasAttribute(attributeName))
            return element.parentNode.getAttribute(attributeName);
        element = element.parentNode;
    }
    return null;
}

function withDocumentOf(window, action) {
    if(!window.document.getElementById('loaded'))
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
    var shouldScroll = ((window.scrollMaxY - window.pageYOffset) < 10);
    action();
    if(shouldScroll)
        window.scrollTo(0, window.document.height);
}

function findBrowser(account, address, url) {
    var tabBrowser = window.top.getBrowser();
    var browser;
    var numTabs = tabBrowser.mPanelContainer.childNodes.length;
    var index = 0;
    while (index < numTabs) {
        browser = tabBrowser.getBrowserAtIndex(index);
        if(browser.currentURI.spec == url &&
           browser.getAttribute('account') == account &&
           browser.getAttribute('address') == address)
            return browser;
        index++;
    }
    return null;
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


// ----------------------------------------------------------------------
// GUI UTILITIES (SPECIFIC)

function withContactInfoOf(address, action) {
    action(_('contact-infos', {address: address}));
}


// ----------------------------------------------------------------------
// GUI ACTIONS

function showSideBar() {
    _('sidebar-visible').setAttribute('checked', 'true');
    _('sidebar').collapsed = false;
    _('splitter-sidebar').hidden = false;    
}

function hideSideBar() {
    _('sidebar-visible').setAttribute('checked', 'false');
    _('sidebar').collapsed = true;
    _('splitter-sidebar').hidden = true;    
}

function focusConversation(account, address) {
    _('conversations').selectedPanel =
        x('//*[@id="conversations"]/*[' +
          '@address="' + address + '" and ' +
          '@account="' + account + '"]');
    _('contact-infos').selectedPanel =
        x('//*[@id="contact-infos"]/*[' +
          '@address="' + address + '" and ' +
          '@account="' + account + '"]');
}

function closeConversation(account, address, resource) {
    var conversation =
        x('//*[' +
          '@role="conversation" and ' +
          '@account="' + account + '" and ' +
          '@address="' + address + '" and ' +
          '@resource="' + resource + '"]');
    if(conversation)
        conversation.parentNode.removeChild(conversation);
    var contactInfo = 
        x('//*[@id="contact-infos"]/*[' +
          '@account="' + account + '" and ' +
          '@address="' + address + '"]');
}

function ensureConversationIsOpen(account, address, resource, type) {
    var conversation = 
        x('//*[@id="conversations"]/*[' +
          '@address="' + address + '" and ' +
          '@account="' + account + '"]');
        
    if(!conversation) { 
        conversation = cloneBlueprint('conversation');
        conversation.setAttribute('address', address);
        conversation.setAttribute('resource', resource);
        conversation.setAttribute('type', type);
        conversation.setAttribute('account', account);
        _('conversations').appendChild(conversation);
        _('conversations').selectedPanel = conversation;

        _(conversation, {role: 'chat-input'}).addEventListener(
            'keypress', function(event) { pressedKeyInChatInput(event); }, false);
        _(conversation, {role: 'chat-input'}).focus();
        callHook('open conversation', conversation);
    }
    return conversation;
}

function ensureContactInfoIsOpen(account, address, resource, type) {
    var contactInfo = _('contact-infos', {address: address});
    if(!contactInfo) {
        contactInfo = cloneBlueprint('contact-info');
        contactInfo.setAttribute('account', account);
        contactInfo.setAttribute('address', address);
        contactInfo.setAttribute('resource', resource);
        contactInfo.setAttribute('type', type);
        _('contact-infos').appendChild(contactInfo);
        _('contact-infos').selectedPanel = contactInfo;
    }
    return contactInfo;
}

function displayChatMessage(account, address, resource, content) {
    var chatOutputWindow = x(
        '//*[' +
        '@role="conversation" and ' +
        '@account="' + account + '" and ' +
        '@address="' + address + '"]' +
        '//*[@role="chat-output"]')
        .contentWindow;

    withDocumentOf(
        chatOutputWindow, function(doc) {
            var actions = doc.createElement('div');
            actions.setAttribute('class', 'actions');

            var saveAction = doc.createElement('a');
            saveAction.setAttribute('class', 'action');
            saveAction.textContent = 'Save';
            actions.appendChild(saveAction);

            var sender = doc.createElement('span');
            sender.textContent = resource || address;
            sender.setAttribute('class', 'sender');
            var body = textToHTML(doc, content);
            body.setAttribute('class', 'body');

            var message = doc.createElement('li');
            message.setAttribute('class', 'message');
            message.appendChild(sender);
            message.appendChild(body);
            message.appendChild(actions);

            scrollingOnlyIfAtBottom(
                chatOutputWindow, function() {
                    doc.getElementById('messages').appendChild(message);
                });            
        });
}

function displayEvent(account, address, resource, content, additionalClass) {
    var chatOutputWindow = x(
        '//*[' +
        '@role="conversation" and ' +
        '@account="' + account + '" and ' +
        '@address="' + address + '"]' +
        '//*[@role="chat-output"]')
        .contentWindow;
    
    withDocumentOf(
        chatOutputWindow, function(doc) {
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


// ----------------------------------------------------------------------
// GUI REACTIONS

function requestedToggleSidebar(command) {
    if(_('splitter-sidebar').hidden) 
        showSideBar();
    else
        hideSideBar();
}

function selectedContact(event) {
    var contact = event.target.selectedItem;
    focusConversation(contact.getAttribute('account'), contact.getAttribute('address'));
}

function requestedExitRoom() {
    var conversation = _('conversations').selectedPanel;
    var address = conversation.getAttribute('address');
    var account = conversation.getAttribute('account');
    exitRoom(account, address);
}

function requestedJoinRoom() {
    var request = {
        roomAddress: undefined,
        roomNick: undefined,
        confirm: false,
        account: undefined
    };

    window.openDialog(
        'chrome://mozeskine/content/join.xul',
        'mozeskine-join-room', 'modal,centerscreen',
        request);

    if(request.confirm)
        joinRoom(request.account, request.roomAddress, request.roomNick);
}

function clickedTopic(event) {
    var input = { value: '' };
    var check = { value: false };

    if(prompts.prompt(null, 'Mozeskine', 'Set topic for this room:', input, null, check))
        setRoomTopic(getAncestorAttribute(event.target, 'account'),
                     getAncestorAttribute(event.target, 'address'),
                     input.value);
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

            sendChatMessage(
                getAncestorAttribute(textBox, 'account'),
                getAncestorAttribute(textBox, 'address'),
                textBox.value);
            textBox.value = '';
        }
    }
}


// ----------------------------------------------------------------------
// NETWORK ACTIONS

// Note: these should *not* contain code to fetch information from the
// GUI, a separate function should do that instead and pass
// information here via function parameters.

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

function sendChatMessage(account, roomAddress, text) {
    XMPP.send(account,
              <message to={roomAddress} type="groupchat">
              <body>{text}</body>
              </message>);
}


// ----------------------------------------------------------------------
// NETWORK REACTIONS

function receiveChatMessage(message) {
    var from = JID(message.stanza.@from);
    displayChatMessage(
        message.session.name,
        from.address, from.resource,
        message.stanza.body);
}

function receiveMessageWithURL(message) {
    if(_('conversations', {address: JID(message.stanza.@from).address, role: 'follow'})
       .getAttribute('checked') == 'true') {
        var url = message.stanza.body.toString().match(urlRegexp)[0];
        window.top.getBrowser().addTab(url);   
    }
}

function receiveRoomTopic(message) {
    var from = JID(message.stanza.@from);
    displayEvent(
        message.session.name,
        from.address, from.resource,
        from.nick + ' set the topic to "' +
        message.stanza.subject + '"', 'topic');
    
    withContactInfoOf(
        from.address, function(info) {
            info.getElementsByAttribute('role', 'topic')[0].textContent =
                message.stanza.subject.toString();
        });
}

function receivePresence(presence) {
    var from = JID(presence.stanza.@from);
    var contact = x('//*[@id="contact-list"]//*[' +
                    '@address="' + from.address + '" and ' +
                    '@account="' + presence.session.name + '"]');

    if(presence.stanza.@type == 'unavailable' && contact) 
        _('contact-list').removeChild(contact);
    else if(!contact) {
        contact = document.createElement('richlistitem');
        contact.setAttribute('address', from.address);
        contact.setAttribute('account', presence.session.name);
        var contactLabel = document.createElement('label');
        contactLabel.setAttribute('value', from.address);
        contact.appendChild(contactLabel);
        _('contact-list').appendChild(contact);
    }            
}

function receiveMUCPresence(presence) {
    var from = JID(presence.stanza.@from);

    var conversation = ensureConversationIsOpen(presence.session.name, from.address, from.resource);
    var contactInfo = ensureContactInfoIsOpen(presence.session.name, from.address);
    var participants = contactInfo.getElementsByAttribute('role', 'participants')[0];
    var participant = participants.getElementsByAttribute('nick', from.nick)[0];

    if(participant) {
        switch(presence.stanza.@type.toString()) {
        case 'unavailable':
            participants.removeChild(participant);
            displayEvent(presence.session.name,
                         from.address, from.resource,
                         from.nick + ' left the room', 'leave');

            closeConversation(presence.session.name, from.address, from.resource);

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
            
            displayEvent(presence.session.name,
                         from.address, from.resource,
                         from.nick + ' entered the room', 'join');
        }
    }
}
