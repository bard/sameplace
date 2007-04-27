// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;


// GLOBAL STATE
// ----------------------------------------------------------------------

var contacts;
var conversations = {};
load('chrome://sameplace/content/conversations.js', conversations);


// SETUP/CLEANUP
// ----------------------------------------------------------------------

window.addEventListener(
    'DOMContentLoaded', function(event) {
        if(event.target == document)
            init();
    }, false);

function init(event) {
    contacts = window.opener;
    
    conversations.init(_('conversations'));

    _('conversations').addEventListener(
        'conversation/open', function(event) {
            var panel = event.originalTarget;
            contacts.startedConversationWith(panel.getAttribute('account'),
                                             panel.getAttribute('address'));
        }, false);

    _('conversations').addEventListener(
        'conversation/focus', function(event) {
            var panel = event.originalTarget;
            contacts.nowTalkingWith(panel.getAttribute('account'),
                                    panel.getAttribute('address'));

            _('contact').value = XMPP.nickFor(panel.getAttribute('account'),
                                              panel.getAttribute('address'));
        }, false);

    _('conversations').addEventListener(
        'conversation/close', function(event) {
            var panel = event.originalTarget;
            contacts.stoppedConversationWith(
                panel.getAttribute('account'),
                panel.getAttribute('address'));

            if(conversations.count == 1)
                window.close();
        }, false);

    behaviour.autoComplete(_('contact'));

    _('contact').addEventListener(
        'complete', function(event) {
            buildContactCompletions(event.target);
        }, false);
}

function interactWith(account, address,
                      where, target, afterLoadAction) {
    if(typeof(where) == 'string') {
        // "where" is a url
        if(target == 'main') {
            if(conversations.isOpen(account, address))
                afterLoadAction(conversations.get(account, address));
            else
                createInteractionPanel(account, address,
                                       where, target, afterLoadAction);
        } else {
            createInteractionPanel(account, address,
                                   where, target, afterLoadAction);
        }
    } else
        // "where" is a content panel
        enableInteraction(account, address, where);
}

function createInteractionPanel(account, address,
                                url, container,
                                afterLoadAction) {
    var panel;
    if(container == 'additional') {
        if(!(url.match(/^javascript:/) ||
             getBrowser().contentDocument.location.href == 'about:blank'))
            getBrowser().selectedTab = getBrowser().addTab();
        
        panel = getBrowser().selectedBrowser;
    } else {
        panel = conversations.create(account, address);        

        panel.addEventListener(
            'click', function(event) {
                clickedElementInConversation(event);
            }, true);

        panel.addEventListener(
            'dragdrop', function(event) {
                nsDragAndDrop.drop(event, chatDropObserver);
                event.stopPropagation();
            }, true);
    }

    // XMPP.enableContentDocument will set account and address as
    // well, but if several messages arrive in a flurry (as when
    // we come online and the server sends in those messages that
    // were addressed to us while we were offline) we will need to
    // identify the newly created panel *before*
    // XMPP.enableContentDocument has a chance to do its work.
    
    panel.setAttribute('account', account);
    panel.setAttribute('address', address);
    
    if(url.match(/^javascript:/)) {
        enableInteraction(account, address, panel, true);
        panel.loadURI(url);
    } else {
        queuePostLoadAction(
            panel, function(p) {
                panel.contentWindow.addEventListener(
                    'beforeunload', function(event) {
                        conversations.closed(account, address);
                    }, true);
                enableInteraction(account, address, panel);
                if(afterLoadAction)
                    afterLoadAction(panel);
            });
        panel.setAttribute('src', url);
    }

    return panel;
}

function enableInteraction(account, address, panel, createSocket) {
    XMPP.enableContentDocument(
        panel, account, address,
        isMUC(account, address) ? 'groupchat' : 'chat', createSocket);

    var url = panel.getAttribute('src');
    if(/^https?:\/\//.test(url))
        XMPP.send(account,
                  <presence to={address}>
                  <interact xmlns="http://dev.hyperstruct.net/xmpp4moz/protocol" url={url}/>
                  </presence>);
}

// GUI ACTIONS
// ----------------------------------------------------------------------

function buildContactCompletions(xulCompletions) {
    contactCompletionsFor(xulCompletions.parentNode.value).forEach(
        function(completion) {
            var address, label;
            if(completion.stanza.ns_muc::x != undefined) {
                address = XMPP.JID(completion.stanza.@to).address;
                label = address;
            } else {
                address = XMPP.JID(completion.stanza.@from).address;
                label = XMPP.nickFor(completion.account, address);
            }

            var xulCompletion = document.createElement('menuitem');
            xulCompletion.setAttribute('class', 'menuitem-iconic');
            xulCompletion.setAttribute('label', label);
            xulCompletion.setAttribute('account', completion.account);
            xulCompletion.setAttribute('address', address);
            xulCompletion.setAttribute('availability', completion.stanza.@type.toString() || 'available');
            xulCompletion.setAttribute('show', completion.stanza.show.toString());
            xulCompletions.appendChild(xulCompletion);
        });
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function pressedKeyInContactField(event) {
    if(event.keyCode == KeyEvent.DOM_VK_RETURN)
        conversations.focusCurrent();
}

function clickedElementInConversation(event) {
    var ancestorAnchor = hasAncestor(event.target, 'a', ns_xhtml);
    if(ancestorAnchor) {
        var newTab;
        
        switch(event.button) {
        case 0: newTab = false; break;
        case 1: newTab = true;  break;
        }

        if(newTab != undefined) {
            openLink(ancestorAnchor.getAttribute('href'), newTab);
            event.preventDefault();
        }
    }
}

// UTILITIES (GENERIC)
// ----------------------------------------------------------------------


// GUI UTILITIES (SPECIFIC)
// ----------------------------------------------------------------------

function getBrowser() {
    return Cc['@mozilla.org/appshell/window-mediator;1']
        .getService(Ci.nsIWindowMediator)
        .getMostRecentWindow('navigator:browser')
        .getBrowser();
}
