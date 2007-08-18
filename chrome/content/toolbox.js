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

const prefBranch = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');
const srvPrompt = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;
var scriptlets = {};
load('chrome://sameplace/contact/facades/scriptlets.js', scriptlets);


// GUI INITIALIZATION AND FINALIZATION
// ----------------------------------------------------------------------

function init(event) {
    if(!event.target)
        return;

    channel = XMPP.createChannel(
        <query xmlns="http://jabber.org/protocol/disco#info">
        <feature var="http://jabber.org/protocol/muc"/>
        <feature var="http://jabber.org/protocol/muc#user"/>
        <feature var="http://jabber.org/protocol/xhtml-im"/>
        <feature var="http://jabber.org/protocol/chatstates"/>
        </query>);

    channel.on(
        {event: 'presence', direction: 'out', stanza: function(s) {
                return (s.@type == undefined || s.@type == 'unavailable') &&
                    s.ns_muc::x == undefined && s.@to == undefined;
            }},
        function(presence) { sentAvailablePresence(presence) });

    XMPP.cache.fetch({
        event: 'presence',
        direction: 'out',
        }).forEach(sentAvailablePresence);

    // Loading and starting scriptlets

    scriptlets.init(['sameplace', 'scriptlets'], 'extensions.sameplace.',
                    'chrome://sameplace/content/scriptlet_sample.js');
    scriptlets.start();

    sizeToContent();
}

function finish() {
    scriptlets.stop();

    channel.release();
}


// GUI UTILITIES (SPECIFIC)
// ----------------------------------------------------------------------
// Application-dependent functions dealing with interface.  They do
// not affect the domain directly.

__defineGetter__(
    'conversations', function() {
        return top.sameplace.getView('conversations').conversations;
    });


// GUI ACTIONS
// ----------------------------------------------------------------------
// Application-dependent functions dealing with user interface.  They
// affect the domain.

function sizeToContent() {
    frameElement.style.height = _('notify').boxObject.height + 'px';
}

function hide() {
    top.sameplace.areaFor('contacts').collapsed = true;
}

function focusStatus() {
    _('status-message').focus();
}

function runWizard() {
    window.openDialog(
        'chrome://sameplace/content/wizard.xul',
        'sameplace-wizard', 'chrome');
}

function importContacts() {
    openLink('https://sameplace.cc/transport/registration');
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
    for each(var account in XMPP.accounts)
        if(XMPP.isUp(account)) {
            var stanza = XMPP.cache.find({
                event     : 'presence',
                direction : 'out',
                account   : account.jid,
                stanza    : function(s) {
                        return s.ns_muc::x == undefined;
                    }
                }).stanza.copy();
            
            if(message)
                stanza.status = message;
            else
                delete stanza.status;
            
            XMPP.send(account, stanza);
        }
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function requestedChangeStatusMessage(event) {
    if(event.keyCode != KeyEvent.DOM_VK_RETURN)
        return;

    var message = event.target.value;
    if(message != _('strings').getString('statusPlaceholder'))
        changeStatusMessage(event.target.value);
    
    document.commandDispatcher.advanceFocus();
    conversations.focusCurrent();
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
        contacts.addContact(request.account, request.contactAddress, request.subscribeToPresence);
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
    scriptlets.forEach(
        function(scriptlet) {
            count++;
            var xulScriptlet = document.createElement('menuitem');
            try {
                xulScriptlet.setAttribute('label', scriptlet.info.name);
                xulScriptlet.addEventListener(
                    'command', function(event) {
                        if(scriptlet.enabled)
                            scriptlet.disable();
                        else
                            scriptlet.enable();
                    }, false);
            } catch(e) {
                xulScriptlet.setAttribute(
                    'label', _('strings').getFormattedString('scriptletLoadingError', [scriptlet.fileName]));
                xulScriptlet.setAttribute('style', 'color:red;')
                xulScriptlet.addEventListener(
                    'command', function(event) {
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

