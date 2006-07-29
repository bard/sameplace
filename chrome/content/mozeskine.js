// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;

const pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefBranch);
const mediator = Cc['@mozilla.org/appshell/window-mediator;1']
    .getService(Ci.nsIWindowMediator);
const prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);

const ns_notes = new Namespace('http://hyperstruct.net/mozeskine/protocol/0.1.4#notes');
const ns_agent = new Namespace('http://hyperstruct.net/mozeskine/protocol/0.1.4#agent');
const ns_muc_user = new Namespace('http://jabber.org/protocol/muc#user');
const ns_muc = new Namespace('http://jabber.org/protocol/muc');
const ns_xul = new Namespace('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul');

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


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;


// GUI INITIALIZATION
// ----------------------------------------------------------------------

function init(event) {
    if(!event.target)
        return;

    _('contact-list').selectedIndex = -1;

    channel = XMPP.createChannel();

    channel.on(
        {event: 'presence', direction: 'in' },
        function(presence) { receivedPresence(presence) });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.ns_muc_user::x.toXMLString();
            }}, function(presence) { receivedMUCPresence(presence) });
    channel.on(
        {event: 'presence', direction: 'out', stanza: function(s) {
                return s.ns_muc::x.toXMLString() && s.@type != 'unavailable';
            }}, function(presence) { sentMUCPresence(presence) });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.body.toString();
            }}, function(message) { receivedChatMessage(message); });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return s.@type == 'groupchat' && s.subject.toString();
            }}, function(message) { receivedRoomTopic(message); });
    channel.on(
        {event: 'message', direction: 'in', stanza: function(s) {
                return (s.body.toString() &&
                        s.body.toString().search(urlRegexp) != -1);
            }}, function(message) { receivedMessageWithURL(message); });
}

function finish() {
    var conversations = _('conversations').childNodes;
    for(var i=0, l=conversations.length; i<l; i++) 
        XMPP.send(conversations[i].getAttribute('account'),
                  <presence type="unavailable" to={conversations[i].getAttribute('address')}/>);
            
    channel.release();
}


// UTILITIES (GENERIC)
// ----------------------------------------------------------------------

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


// GUI UTILITIES (GENERIC)
// ----------------------------------------------------------------------

// Note: only place here functions that will work with any GUI.  See
// GUI UTILITIES (SPECIFIC) for functions specific to this GUI.

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
    var shouldScroll = ((window.scrollMaxY - window.pageYOffset) < 24);
    action();
    if(shouldScroll)
        window.scrollTo(0, window.document.height);
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


// GUI UTILITIES (SPECIFIC)
// ----------------------------------------------------------------------

function withContactInfoOf(address, action) {
    action(_('contact-infos', {address: address}));
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function focusContent(account, address, url) {
    top.getBrowser().selectedTab =
        top.getBrowser().tabContainer.childNodes[
            findBrowserIndex(account, address, url)];
}

function switchLayout() {
    // XXX should adjust conversation scroll here or in chat document events
    if(_('box-main').getAttribute('orient') == 'horizontal') {
        _('box-main').setAttribute('orient', 'vertical');
        _('splitter-main').setAttribute('orient', 'vertical');
        _('box-auxiliary').setAttribute('orient', 'horizontal');
        _('splitter-auxiliary').setAttribute('orient', 'horizontal');
    } else {
        _('box-main').setAttribute('orient', 'horizontal');
        _('splitter-main').setAttribute('orient', 'horizontal');
        _('box-auxiliary').setAttribute('orient', 'vertical');
        _('splitter-auxiliary').setAttribute('orient', 'vertical');
    }
}

function showAuxiliary() {
    _('auxiliary-visible').setAttribute('checked', 'true');
    _('box-auxiliary').collapsed = false;
    _('splitter-auxiliary').hidden = false;    
}

function hideAuxiliary() {
    _('auxiliary-visible').setAttribute('checked', 'false');
    _('box-auxiliary').collapsed = true;
    _('splitter-auxiliary').hidden = true;    
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

function openConversation(account, address, resource, type) {
    var conversation =
        x('//*[' +
          '@role="conversation" and ' +
          '@account="' + account + '" and ' +
          '@address="' + address + '"]');
    var contactInfo = 
        x('//*[' +
          '@role="contact-info" and ' +
          '@account="' + account + '" and ' +
          '@address="' + address + '"]');
    
    if(conversation && contactInfo) {
        conversation.setAttribute('resource', resource);
        contactInfo.setAttribute('resource', resource);
    } else {
        conversation = cloneBlueprint('conversation');
        conversation.setAttribute('account', account);
        conversation.setAttribute('address', address);
        conversation.setAttribute('resource', resource);
        conversation.setAttribute('type', type);
        _('conversations').appendChild(conversation);
        _('conversations').selectedPanel = conversation;

        contactInfo = cloneBlueprint('contact-info');
        contactInfo.setAttribute('account', account);
        contactInfo.setAttribute('address', address);
        contactInfo.setAttribute('resource', resource);
        contactInfo.setAttribute('type', type);
        _('contact-infos').appendChild(contactInfo);
        _('contact-infos').selectedPanel = contactInfo;

        _(conversation, {role: 'chat-input'}).focus();        
    } 
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
        x('//*[' +
          '@role="contact-info" and ' +
          '@account="' + account + '" and ' +
          '@address="' + address + '" and ' +
          '@resource="' + resource + '"]');
    if(contactInfo) 
        contactInfo.parentNode.removeChild(contactInfo);
}

function updateContactInfoParticipants(account, address, participantNick, availability) {
    var contactInfo =
        x('//*[@id="contact-infos"]/*[' +
          '@address="' + address + '" and ' +
          '@account="' + account + '"]');
    
    var participants = contactInfo.getElementsByAttribute('role', 'participants')[0];
    var participant = contactInfo.getElementsByAttribute('nick', participantNick)[0];

    if(participant) {
        if(availability == 'unavailable') 
            participants.removeChild(participant);
    } else {
        if(availability != 'unavailable') {
            participant = document.createElement('richlistitem');
            participant.setAttribute('nick', participantNick); 
            participant.setAttribute('orient', 'horizontal');
            participant.setAttribute('align', 'center');
            participant.setAttribute('class', 'participant');
            var image = document.createElement('image');
            var label = document.createElement('label');
            label.setAttribute('value', participantNick);
            participant.appendChild(image);
            participant.appendChild(label);
            participants.appendChild(participant);            
        }
    }
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
            var sender = doc.createElement('span');
            sender.textContent = resource || address;
            sender.setAttribute('class', 'sender');
            var body = textToHTML(doc, content);
            body.setAttribute('class', 'body');

            var message = doc.createElement('li');
            message.setAttribute('class', 'message');
            message.appendChild(sender);
            message.appendChild(body);

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


// GUI REACTIONS
// ----------------------------------------------------------------------

function requestedToggleAuxiliary(command) {
    if(_('splitter-auxiliary').hidden) 
        showAuxiliary();
    else
        hideAuxiliary();
}

function selectedContact(event) {
    var contact = event.target.selectedItem;
    focusConversation(contact.getAttribute('account'), contact.getAttribute('address'));
}

function requestedExitRoom() {
    var conversation = _('conversations').selectedPanel;
    exitRoom(conversation.getAttribute('account'),
             conversation.getAttribute('address'),
             conversation.getAttribute('resource'));
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


// NETWORK ACTIONS
// ----------------------------------------------------------------------

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


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function receivedChatMessage(message) {
    var from = JID(message.stanza.@from);
    displayChatMessage(
        message.session.name,
        from.address, from.resource,
        message.stanza.body);
}

function receivedMessageWithURL(message) {
    if(_('conversations', {address: JID(message.stanza.@from).address, role: 'follow'})
       .getAttribute('checked') == 'true') {
        var url = message.stanza.body.toString().match(urlRegexp)[0];
        window.top.getBrowser().addTab(url);   
    }
}

function receivedRoomTopic(message) {
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

function receivedPresence(presence) {
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

function sentMUCPresence(presence) {
    var room = JID(presence.stanza.@to);
    openConversation(
        presence.session.name, room.address, room.nick, 'groupchat');
}

function receivedMUCPresence(presence) {
    var from = JID(presence.stanza.@from);

    updateContactInfoParticipants(
        presence.session.name, from.address, from.resource,
        presence.stanza.@type.toString());

    var eventMessage, eventClass;
    if(presence.stanza.@type.toString() == 'unavailable') {
        eventMessage = from.nick + ' left the room';
        eventClass = 'leave';
    } else {
        eventMessage = from.nick + ' entered the room';
        eventClass = 'join';
    }
    
    displayEvent(
        presence.session.name, from.address, from.resource,
        eventMessage, eventClass);

    if(presence.stanza.@type.toString() == 'unavailable')
        closeConversation(presence.session.name, from.address, from.resource);

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

// DEVELOPER SHORTCUTS
// ----------------------------------------------------------------------

