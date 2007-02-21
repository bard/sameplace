// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;

const prefBranch = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');


// GLOBAL STATE
// ----------------------------------------------------------------------

// Initializing here, even the load event might be too late.

var contacts = window.opener;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

window.addEventListener(
    'load', function(event) { init(); }, false);

window.addEventListener(
    'unload', function(event) { finish(); }, false);

function init(event) {
    behaviour.autoComplete(_('contact'));

    _('contact').addEventListener(
        'complete', function(event) {
            buildContactCompletions(event.target);
        }, false);

    _('contact').addEventListener(
        'completed', function(event) {
            requestedCommunicate(
                event.target.getAttribute('account'),
                event.target.getAttribute('address'),
                getDefaultAppUrl());
        }, false);
}

function finish(event) {
    for(var i=_('conversations').childNodes.length-1; i>=0; i--) {
        var conversation = _('conversations').childNodes[i].firstChild;
        closeConversation(
            conversation.getAttribute('account'),
            conversation.getAttribute('address'));
    }
}

function interactWith(account, address, resource, 
                      where, target, afterLoadAction) {
    if(typeof(where) == 'string')
        // "where" is a url
        if(isConversationOpen(account, address)) {
            focusConversation(account, address);
            afterLoadAction(getConversation(account, address));
        } else
            createInteractionPanel(account, address, resource,
                                   where, target, afterLoadAction);
    else
        // "where" is a content panel
        XMPP.enableContentDocument(where, account, address,
                                   isMUC(account, address) ? 'groupchat' : 'chat');
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function buildContactCompletions(xulCompletions) {
    function presenceDegree(stanza) {
        if(stanza.@type == undefined && stanza.show == undefined)
            return 4;
        else if(stanza.@type == 'unavailable')
            return 0;
        else
            switch(stanza.show.toString()) {
            case 'chat': return 5; break;
            case 'dnd':  return 3; break;
            case 'away': return 2; break;
            case 'xa':   return 1; break;
            default:
                throw new Error('Unexpected. (' + stanza.toXMLString() + ')');
            }
    }

    var input = xulCompletions.parentNode.value;
    var completions = [];

    for each(var iq in XMPP.cache.roster) {
        for each(var item in iq.stanza..ns_roster::item) {
            var account = iq.session.name;
            var address = item.@jid;
            var nick = XMPP.nickFor(account, address);
            var presence = XMPP.presenceSummary(account, address);
            if(nick.toLowerCase().indexOf(input.toLowerCase()) == 0)
                completions.push({
                    label: nick,
                    account: account,
                    address: address,
                    show: presence.stanza.show.toString(),
                    presence: presence,
                    availability: presence.stanza.@type.toString() || 'available' });
        }
    }

    for each(var presence in XMPP.cache.presenceOut)
        if(presence.stanza && presence.stanza.ns_muc::x.length() > 0) {
            var account = presence.session.name;
            var address = XMPP.JID(presence.stanza.@to).address;
            if(address.toLowerCase().indexOf(input.toLowerCase()) == 0)
                completions.push({
                    label: address,
                    account: account,
                    address: address,
                    show: presence.stanza.show.toString(),
                    presence: presence,
                    availability: 'available' });
        }

    completions
        .sort(
            function(a, b) {
                var diff = presenceDegree(b.presence.stanza) - presenceDegree(a.presence.stanza);
                if(diff == 0)
                    diff = (a.label.toLowerCase() < b.label.toLowerCase()) ? -1 : 1;
                return diff;
            })
        .forEach(
            function(completion) {
                var xulCompletion = document.createElement('menuitem');
                xulCompletion.setAttribute('class', 'menuitem-iconic');
                xulCompletion.setAttribute('label', completion.label);
                xulCompletion.setAttribute('account', completion.account);
                xulCompletion.setAttribute('address', completion.address);
                xulCompletion.setAttribute('availability', completion.availability);
                xulCompletion.setAttribute('show', completion.show);
                xulCompletions.appendChild(xulCompletion);
            });
}

function toggleAttachContacts() {
    if(tracker.onMove) 
        tracker.onMove = null;
    else {
        tracker.onMove = contacts.movedConversations;
        contacts.moveToSideOf(window);
    }
}

function close() {

}

function refreshViewMenu() {
    _('command-toggle-attach-contacts').setAttribute(
        'checked', tracker.onMove != null);
}

// FROM SAMEPLACE...

function isConversationOpen(account, address) {
    return getConversation(account, address) != undefined;
}

function getCurrentConversation() {
    return _('conversations').selectedPanel.firstChild;
}

function focusCurrentConversation() {
    var conversation = getCurrentConversation();

    if(conversation) {
        conversation.contentWindow.focus();
        document.commandDispatcher.advanceFocus();
    }
}

function focusConversation(account, address) {
    var conversation = getConversation(account, address);
    if(conversation) {
        var conversationContainer = conversation.parentNode;
        var conversationHeader = x('//*[@id="conversation-tabs"]' +
                                   '//xul:tab[@account="' + account + '" and ' +
                                   '          @address="' + address + '"]');

        _('conversation-tabs').selectedItem = conversationHeader;
        _('conversations').selectedPanel = conversationContainer;
        conversation.contentWindow.focus();
        document.commandDispatcher.advanceFocus();
    }
}

function closeConversation(account, address) {
    var conversation = getConversation(account, address);

    if(conversation) {
        var conversationContainer = conversation.parentNode;
        var conversationHeader = x('//*[@id="conversation-tabs"]' +
                                   '//xul:tab[@account="' + account + '" and ' +
                                   '          @address="' + address + '"]');

       if(_('conversations').parentNode.selectedIndex > 0)
           _('conversations').parentNode.selectedIndex -= 1;
        
        _('conversations').removeChild(conversationContainer);
        _('conversation-tabs').removeChild(conversationHeader);
        closedConversation(account, address);
    } 
}

if(typeof(x) == 'function') {
    function getConversation(account, address) {    
        return x('//*[@id="conversations"]' +
                 '//xul:*[@account="' + account + '" and ' +
                 '        @address="' + address + '"]');
    }
} else {
    function getConversation(account, address){
        var conversationsForAccount =
            _('conversations').getElementsByAttribute('account', account);
        for(var i=0; i<conversationsForAccount.length; i++){
            if(conversationsForAccount[i].getAttribute('address') == address)
                return conversationsForAccount[i];
        }
    }
}

// FROM SAMEPLACE...

function createInteractionPanel(account, address, resource, 
                                url, target,
                                afterLoadAction) {
//     switch(target) {
//     case 'additional':
//         if(!(url.match(/^javascript:/) ||
//              getBrowser().contentDocument.location.href == 'about:blank')) {
//             getBrowser().selectedTab = getBrowser().addTab();

//             var contentPanel = getBrowser().selectedBrowser;

//             queuePostLoadAction(
//                 contentPanel, function(document) {
//                     XMPP.enableContentDocument(contentPanel, account, address, type);
//                     if(afterLoadAction)
//                         afterLoadAction(contentPanel);
//                 });

//             contentPanel.contentDocument.location.href = url;
//         }
            
//         return contentPanel;
//         break;

//     case 'main':
        function containerForInteractionsWith(account, address) {
            var header = document.createElement('tab');
            var container = document.createElement('tabpanel');
            header.setAttribute('label', XMPP.nickFor(account, address));
            header.setAttribute('account', account);
            header.setAttribute('address', address);
            container.setAttribute('flex', '1');
    
            _('conversation-tabs').appendChild(header);
            _('conversations').appendChild(container);

            return container;
        }
        
        var conversation = cloneBlueprint('conversation');
        containerForInteractionsWith(account, address).appendChild(conversation);

        conversation.addEventListener(
            'focus', function(event) {
                focusedConversation(account, address);
            }, true);
        
        conversation.addEventListener(
            'click', function(event) {
                clickedElementInConversation(event);
            }, true);

        queuePostLoadAction(
            conversation, function(document) {
                XMPP.enableContentDocument(conversation, account, address, 
                                           isMUC(account, address) ? 'groupchat' : 'chat');

                if(afterLoadAction)
                    afterLoadAction(conversation);
            });

        // XMPP.enableContentDocument will set account and address as
        // well, but if several messages arrive in a flurry (as when
        // we come online and the server sends in those messages that
        // were addressed to us while we were offline) we will need to
        // identify the newly created panel *before*
        // XMPP.enableContentDocument has a chance to do its work.

        conversation.setAttribute('account', account);
        conversation.setAttribute('address', address);
        conversation.setAttribute('src', url);

        // No real use for this now.

        conversation.setAttribute('resource', resource);

        if(_('conversations').childNodes.length == 1) {
            _('conversations').selectedIndex = 0;
            _('conversation-tabs').selectedIndex = 0;
        }

        return conversation;
//         break;

//     default:
//         throw new Error('Unexpected. (' + target + ')');
//         break;
//     }
}


// GUI UTILITIES
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById(id);
}

function attachTo(srcWindow, dstWindow) {
    var width = srcWindow.outerWidth == 1 ?
        srcWindow.document.documentElement.getAttribute('width') :
        srcWindow.outerWidth;
    var dstX = dstWindow.screenX > width ?
        dstWindow.screenX - width                + 10 :
        dstWindow.screenX + dstWindow.outerWidth - 10;
    var dstY = dstWindow.screenY + 20;

    prevX = dstWindow.screenX;
    prevY = dstWindow.screenY;
    srcWindow.moveTo(dstX, dstY);
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function requestedCloseCurrentConversation() {
    var conversation = getCurrentConversation();
    if(conversation)
        closeConversation(conversation.getAttribute('account'),
                          conversation.getAttribute('address'));
}

// FROM SAMEPLACE

function pressedKeyInContactField(event) {
    if(event.keyCode == KeyEvent.DOM_VK_RETURN)
        focusCurrentConversation();
}

function requestedCommunicate(account, address, url) {
    if(url == getDefaultAppUrl()) 
        if(isMUC(account, address) && !isConversationOpen(account, address))
            promptOpenConversation(account, address, isMUC(account, address) ? 'groupchat' : 'chat');
        else
            interactWith(
                account, address, null,
                url, 'main', function(conversation) {
                    focusConversation(account, address);
                    openedConversation(account, address);
                });
    else
        interactWith(
            account, address, null, url, 'additional');
}

function openedConversation(account, address) {
    contacts.startedConversationWith(account, address);
    
    if(_('conversations').childNodes.length == 1)
        contacts.nowTalkingWith(account, address);
}

function closedConversation(account, address) {
    contacts.stoppedConversationWith(account, address);
    if(_('conversations').childNodes.length > 0)
        focusCurrentConversation();
}

function focusedConversation(account, address) {
    contacts.nowTalkingWith(account, address);
    _('contact').value = XMPP.nickFor(account, address);
}

function clickedElementInConversation() {

}

function requestedClose() {

}

function requestedMinimize() {
    window.minimize();
    contacts.minimize();
}

function requestedToggleMaximize() {
    if(window.windowState == Ci.nsIDOMChromeWindow.STATE_MAXIMIZED) {
        window.restore();
        contacts.restore();
    } else {
        window.maximize();
        contacts.minimize();
    }
}


function getDefaultAppUrl() {
    var url = prefBranch.getCharPref('defaultAppUrl');
    return isChromeUrl(url) ? chromeToFileUrl(url) : url;
}

function isMUC(account, address) {
    for each(var presence in XMPP.cache.presenceOut)
        if(presence.stanza.@to != undefined &&
           XMPP.JID(presence.stanza.@to).address == address &&
           presence.stanza.ns_muc::x.length() > 0)
            return true;

    return false;
}


// DEVELOPER UTILITIES
// ----------------------------------------------------------------------

function getStackTrace() {
    var frame = Components.stack.caller;
    var str = "<top>";

    while (frame) {
        str += '\n' + frame;
        frame = frame.caller;
    }

    return str;
}
