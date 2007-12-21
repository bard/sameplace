/*
  Copyright (C) 2005-2006 by Massimiliano Mirra

  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 2 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software
  Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301 USA

  Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
*/


// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;
const srvPrompt = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;
var scriptlets;


// GUI INITIALIZATION AND FINALIZATION
// ----------------------------------------------------------------------

function init(event) {
    if(!event.target)
        return;

    channel = XMPP.createChannel();

    channel.on({
        event: 'stream',
        state: 'close'
    }, function() {
        if(XMPP.accounts.every(XMPP.isDown))
            collapse(_('profile'));
    });

    channel.on({
        event     : 'presence',
        direction : 'out',
        stanza    : function(s) {
            return (s.@type == undefined || s.@type == 'unavailable') &&
                s.ns_muc::x == undefined && s.@to == undefined;
        }
    }, function(presence) { sentAvailablePresence(presence) });

    XMPP.cache.fetch({
        event     : 'presence',
        direction : 'out',
    }).forEach(sentAvailablePresence);

    scriptlets = top.sameplace.scriptlets;

    // We're in an <iframe/>, thus interface changes won't
    // automatically be accomodated by the container.  We keep an eye
    // on the main cause of size changes (collapsing elements) and
    // force the container to adapt by calling the custom
    // sizeToContent().

    _('main').addEventListener('collapse', sizeToContent, false);

    if(XMPP.accounts.every(XMPP.isDown)) {
        uncollapse(_('offline'));
        collapse(_('profile'));
    }

    _('button-go-online').label = (XMPP.accounts.length == 0 ?
                                   _('strings').getString('connectConfigureButton') :
                                   _('strings').getString('connectButton'));

    sizeToContent();
}

function finish() {
    scriptlets.stop();

    channel.release();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function toggleOfflineContacts() {
    // Exit point

    top.sameplace.viewFor('contacts').toggleOfflineContacts();
}

function sizeToContent() {
    // Exit point
    
    frameElement.style.height = _('main').boxObject.height + 'px';
}

function hide() {
    // Exit point
    
    top.sameplace.areaFor('contacts').collapsed = true;
}

function refreshAccounts(menuPopup) {
    function refreshAccounts1() {
        while(menuPopup.lastChild &&
              menuPopup.lastChild.nodeName != 'menuseparator')
            menuPopup.removeChild(menuPopup.lastChild);
        
        XMPP.accounts.forEach(function(account) {
            var accountPresence =
                XMPP.cache.fetch({
                    event     : 'presence',
                    direction : 'out',
                    account   : account.jid,
                    stanza    : function(s) { return s.ns_muc::x == undefined; }
                    })[0] ||
                { stanza: <presence type="unavailable"/> };

            var menu = document.createElement('menu');
            menu.setAttribute('class', 'menu-iconic')
            menu.setAttribute('role', 'account');
            menu.setAttribute('label', account.jid);
            menu.setAttribute('value', account.jid);
            menu.setAttribute('availability',
                              accountPresence.stanza.@type == undefined ?
                              'available' : 'unavailable');
            menu.setAttribute('show',
                              accountPresence.stanza.show.toString());
  
            menu.appendChild($('#blueprints  [role="status-popup"]')._.cloneNode(true));
            menuPopup.appendChild(menu);
        });
    }

    // When called from the event listener and adding menus with
    // sub-menus, will crash as soon as mouse hovers a menu (for someh
    // reason).  The following seems to workaround.
    window.setTimeout(refreshAccounts1, 0);
}

function focusStatus() {
    _('status-message').focus();
}

function runWizard() {
    window.openDialog(
        'chrome://sameplace/content/wizard.xul',
        'sameplace-wizard', 'chrome');
}

function runNewWizard() {
    window.openDialog(
        'chrome://sameplace/content/wizard/wizard.xul',
        'sameplace-wizard', 'chrome');
}

function importContacts() {
    var input = { value: 'msn.jabber.sameplace.cc' };
    
    var result = srvPrompt.prompt(
        null,
        _('strings').getString('transportRegistrationTitle'),
        _('strings').getString('transportRegistrationMessage'),
        input, null, {});
    var transportAddress = input.value;
    
    if(!result)
        return;
    
    var onlineAccounts = XMPP.accounts.filter(XMPP.isUp);
    var account = onlineAccounts.length > 1 ? {} : onlineAccounts[0];
    
    registerToTransport(account, transportAddress, {
        onSuccess: function() { alert(_('strings').getString('transportRegistrationSuccess')); },
        onError: function(info) { alert(_('strings').getFormattedString('transportRegistrationError', [info])); },
        onCancel: function() {}
    });
}

function readLatestNews() {
    openLink('http://sameplace.cc/blog', true);
}

function viewHelp() {
    openLink('http://help.sameplace.cc', true);
}

function visitForum() {
    openLink('http://forum.sameplace.cc', true);
}

function reportBug() {
    openLink('http://bugs.sameplace.cc', true);
}

function visitUsersRoom() {
    window.openDialog('chrome://sameplace/content/join_room.xul',
                      'sameplace-open-conversation', 'centerscreen',
                      null, 'users@places.sameplace.cc');
}

function changeStatusMessage(message) {
    XMPP.accounts.filter(XMPP.isUp).forEach(function(account) {
        var stanza = XMPP.cache.find({
            event     : 'presence',
            direction : 'out',
            account   : account.jid,
            stanza    : function(s) { return s.ns_muc::x == undefined; }
        }).stanza.copy();
        
        if(message)
            stanza.status = message;
        else
            delete stanza.status;
        
        XMPP.send(account, stanza);
    });
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function requestedConnection() {
    if(XMPP.accounts.length > 0)
        XMPP.up();
    else
        runWizard();
}

function requestedChangeStatus(xulStatus) {
    function previousPresenceStanza(account) {
        var p = XMPP.cache.fetch({
            event     : 'presence',
            account   : account,
            direction : 'out',
            stanza    : function(s) { return s.ns_muc::x == undefined; }
        })[0];

        return p ? p.stanza : null;
    }

    function updatePresence(stanza, status) {
        var newStanza = stanza.copy();
    
        switch(status) {
        case 'available':
            delete newStanza.show;
            break;
        case 'away':
            newStanza.show = <show>away</show>;
            break;
        case 'dnd':
            newStanza.show = <show>dnd</show>;
            break;
        }
        return newStanza;
    }
    
    var status = xulStatus.value;
    var account = $(xulStatus).$('^ [role="account"]')._.value;

    if(account == 'all') {
        var accountsUp = XMPP.accounts.filter(XMPP.isUp);
        if(status == 'unavailable')
            accountsUp.forEach(XMPP.down);
        else if(status == 'available' && accountsUp.length == 0)
            XMPP.accounts.forEach(XMPP.up);
        else
            accountsUp.forEach(function(account) {
                XMPP.send(account,
                          updatePresence(
                              previousPresenceStanza(account.jid) || <presence/>,
                              status));
            });
    } else {
        if(status == 'available' && XMPP.isDown(account))
            XMPP.up(account);
        else if(status == 'unavailable' && XMPP.isUp(account))
            XMPP.down(account);
        else
            XMPP.send(account,
                      updatePresence(
                          previousPresenceStanza(account) || <presence/>,
                          status));
    } 

}

function requestedChangeStatusMessage(event) {
    if(event.keyCode != KeyEvent.DOM_VK_RETURN)
        return;

    var message = event.target.value;
    if(message != _('strings').getString('statusPlaceholder'))
        changeStatusMessage(event.target.value);
    
    document.commandDispatcher.advanceFocus();

    // Exit point
    
    top.sameplace.viewFor('conversations').conversations.focusCurrent();
}

function requestedAddContact() {
    var request = {
        contactAddress: undefined,
        subscribeToPresence: undefined,
        confirm: false,
        account: undefined
    };

    window.openDialog(
        'chrome://sameplace/content/add_contact.xul',
        'sameplace-add-contact', 'modal,centerscreen',
        request);

    if(request.confirm)
        top.sameplace.viewFor('contacts').addContact(
            request.account, request.contactAddress, request.subscribeToPresence);
}

function requestedOpenConversation(type) {
    switch(type) {
    case 'chat':
        window.openDialog(
            'chrome://sameplace/content/open_conversation.xul',
            'sameplace-open-conversation', 'centerscreen', null, 'contact@server.org');
        break;
    case 'groupchat':
        window.openDialog(
            'chrome://sameplace/content/join_room.xul',
            'sameplace-join-room', 'centerscreen', null, 'users@places.sameplace.cc');
        break;
    default:
        throw new Error('Unexpected. (' + type + ')');
    }
}

function requestedManageScriptlets() {
    window.openDialog('chrome://sameplace/content/scriptlet_manager.xul',
                      'SamePlace:ScriptletManager', 'chrome', scriptlets);
}

function requestedShowScriptletList(xulPopup) {
    var xulSeparator = xulPopup.getElementsByTagName('menuseparator')[0];
    while(xulPopup.firstChild && xulPopup.firstChild != xulSeparator)
        xulPopup.removeChild(xulPopup.firstChild);
    
    var count = 0;
    scriptlets.forEach(function(scriptlet) {
        count++;
        var xulScriptlet = document.createElement('menuitem');
        try {
            xulScriptlet.setAttribute('label', scriptlet.info.name);
            xulScriptlet.addEventListener('command', function(event) {
                if(scriptlet.enabled)
                    scriptlet.disable();
                else
                    scriptlet.enable();
            }, false);
        } catch(e) {
            xulScriptlet.setAttribute(
                'label', _('strings').getFormattedString('scriptletLoadingError', [scriptlet.fileName]));
            xulScriptlet.setAttribute('style', 'color:red;')
            xulScriptlet.addEventListener('command', function(event) {
                window.alert(e.name + '\n' + e.stack);
            }, false);
        }
        xulScriptlet.setAttribute('type', 'checkbox');
        xulScriptlet.setAttribute('checked', scriptlet.enabled ? 'true' : 'false');
        xulPopup.insertBefore(xulScriptlet, xulSeparator);
    });
    
    xulPopup.getElementsByTagName('menuseparator')[0].hidden = (count == 0);
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function sentAvailablePresence(presence) {
    uncollapse(_('profile'));
    collapse(_('offline'));

    var status = presence.stanza.status.toString();
    if(status) {
        _('status-message').value = status;
        _('status-message').setAttribute('draft', 'false');
    } else {
        _('status-message').value = _('strings').getString('statusPlaceholder');
        _('status-message').setAttribute('draft', 'true');
    }
    _('profile-username').value = XMPP.JID(presence.account).username;
}


// NETWORK ACTIONS
// ----------------------------------------------------------------------

function registerToTransport(account, address, callbacks) {
    function start() {
        discoverSupport();
    }
    
    function discoverSupport() {
        XMPP.send(account,
                  <iq type="get" to={address}>
                  <query xmlns="http://jabber.org/protocol/disco#info"/>
                  </iq>,
                  function(reply) {
                      if(reply.stanza.@type == 'result')
                          queryRegistration();
                      else
                          error(reply.stanza.error.@code);
                  });
    }

    function queryRegistration() {
        XMPP.send(account,
                  <iq type="get" to={address}>
                  <query xmlns={ns_register}/>
                  </iq>,
                  function(reply) {
                      if(reply.stanza.@type == 'result')
                          displayForm(reply.stanza.ns_register::query)
                      else
                          error(reply.stanza.error.@code);
                  });
    }

    function displayForm(serverQuery) {
        var request = {
            confirm: false,
            query: serverQuery
        };

        window.openDialog(
            'chrome://xmpp4moz/content/ui/registration.xul',
            'xmpp4moz-registration', 'modal,centerscreen',
            request);

        if(request.confirm)
            acceptForm(request.query)
        else
            cancel();
    }

    function acceptForm(form) {
        XMPP.send(account,
                  <iq to={address} type="set">
                  {form}
                  </iq>,
                  function(reply) {
                      if(reply.stanza.@type == 'result')
                          success();
                      else
                          error(reply.stanza.error.@code);
                  });
    }

    function cancel() {
        if(callbacks.onCancel)
            callbacks.onCancel();
    }
    
    function success() {
        if(callbacks.onSuccess)
            callbacks.onSuccess();
    }

    function error(info) {
        if(callbacks.onError)
            callbacks.onError(info);
    }

    start();
}


// GUI UTILITIES
// ----------------------------------------------------------------------

function collapse(element) {
    if(element.collapsed)
        return;

    element.collapsed = true;
    fireSimpleEvent(element, 'collapse');
}

function uncollapse(element) {
    if(!element.collapsed)
        return;

    element.collapsed = false;
    fireSimpleEvent(element, 'collapse');
}

function fireSimpleEvent(element, eventName) {
    var event = document.createEvent('Event');
    event.initEvent(eventName, true, false);
    element.dispatchEvent(event);
}
