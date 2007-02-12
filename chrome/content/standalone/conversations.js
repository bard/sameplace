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
    new AutoComplete(
        _('contact'), _('contact-completions'),
        function(input, xulCompletions) {
            for each(var iq in XMPP.cache.roster) {
                for each(var item in iq.stanza..ns_roster::item) {
                    var account = iq.session.name;
                    var address = item.@jid;
                    var nick = XMPP.nickFor(account, address);
                    var presence = XMPP.presenceSummary(account, address);
                    if(nick.toLowerCase().indexOf(input.toLowerCase()) == 0) {
                        var xulCompletion = document.createElement('menuitem');
                        xulCompletion.setAttribute('class', 'menuitem-iconic');
                        xulCompletion.setAttribute('label', nick);
                        xulCompletion.setAttribute('value', account + ' ' + address);
                        xulCompletion.setAttribute('availability', presence.stanza.@type.toString() || 'available');
                        xulCompletion.setAttribute('show', presence.stanza.show.toString());
                        xulCompletions.appendChild(xulCompletion);
                    }
                }
            }
        },
        function(choice) {
            var parts = choice.split(' ');
            var account = parts[0];
            var address = parts[1];
            requestedCommunicate(account, address, 'chat', getDefaultAppUrl());
        });
}

function finish(event) {
    for(var i=_('conversations').childNodes.length-1; i>=0; i--) {
        var conversation = _('conversations').childNodes[i].firstChild;
        closeConversation(
            conversation.getAttribute('account'),
            conversation.getAttribute('address'));
    }
}

function interactWith(account, address, resource, type,
                      where, target, afterLoadAction) {
    if(typeof(where) == 'string')
        // "where" is a url
        if(isConversationOpen(account, address)) {
            focusConversation(account, address);
            if(afterLoadAction)
                afterLoadAction(getConversation(account, address));
        } else
            createInteractionPanel(account, address, resource, type,
                                   where, target, afterLoadAction);
    else
        // "where" is a content panel
        XMPP.enableContentDocument(where, account, address, type);
}


// GUI ACTIONS
// ----------------------------------------------------------------------

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

function createInteractionPanel(account, address, resource, type,
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
                XMPP.enableContentDocument(conversation, account, address, type);
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
        conversation.setAttribute('message-type', type);

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

function requestedCommunicate(account, address, type, url) {
    if(url == getDefaultAppUrl()) 
        if(type == 'groupchat' && isConversationOpen(account, adrress)) 
            promptOpenConversation(account, address, type);
        else
            interactWith(
                account, address, null, type,
                url, 'main', function(conversation) {
                    focusConversation(account, address);
                    openedConversation(account, address, type);
                });
    else
        interactWith(
            account, address, null, type,
            url, 'additional');
}

function openedConversation(account, address, type) {
    contacts.startedConversationWith(account, address, type);
    
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

