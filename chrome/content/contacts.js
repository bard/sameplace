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

var Cc = Components.classes;
var Ci = Components.interfaces;

var srvPrompt = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);
var prefBranch = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;
var subscriptionAccumulator;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    $('#contacts')._.selectedIndex = -1;

    subscriptionAccumulator = new TimedAccumulator(
        receivedSubscriptionRequestSequence, 1500);

    channel = XMPP.createChannel();

    channel.on({
        event     : 'presence',
        direction : 'in',
        stanza    : function(s) {
            return s.@type == undefined || s.@type == 'unavailable';
        }
    }, receivedPresence);
    channel.on({
        event     : 'iq',
        direction : 'in',
        stanza    : function(s) {
            return s.ns_roster::query.length() > 0;
        }
    }, receivedRoster);
    channel.on({
        event     : 'message',
        direction : 'in'
    }, receivedMessage);
    channel.on({
        event     : 'presence',
        direction : 'in',
        stanza    : function(s) {
            return s.@type == 'subscribe';
        }
    }, receivedSubscriptionRequest);
    channel.on({
        event     : 'presence',
        direction : 'out',
        stanza    : function(s) {
            return s.@type == 'subscribed';
        }
    }, sentSubscriptionConfirmation);
    channel.on({
        event     : 'presence',
        direction : 'in',
        stanza    : function(s) {
            return s.ns_muc_user::x.length() > 0;
        }
    }, receivedMUCPresence);
    channel.on({
        event     : 'presence',
        direction : 'out',
        stanza    : function(s) {
            return (s.@type == undefined || s.@type == 'unavailable') &&
                s.ns_muc::x == undefined && s.@to == undefined;
        }
    }, function(presence) { requestMUCBookmarks(presence.account) });
    channel.on({
        event     : 'iq',
        direction : 'in',
        stanza    : function(s) {
            return s.@type == 'result' &&
                s.ns_private::query.ns_bookmarks::storage != undefined;
        }
    }, receivedMUCBookmarks);

    // XXX Ultimately triggers a "foobar has accepted you".  But
    // seeing foobar in the contact list is probably a sufficient
    // notification.
    //     channel.on({
    //         event     : 'presence',
    //         direction : 'in',
    //         stanza    : function(s) {
    //             return s.@type == 'subscribe';
    //         },
    //     }, receivedSubscriptionPacket);

    var accountsUp = XMPP.accounts.filter(XMPP.isUp);
    accountsUp.forEach(requestRoster);
    accountsUp.forEach(requestMUCBookmarks);

    XMPP.cache.fetch({
        event     : 'presence',
        direction : 'in',
    }).forEach(receivedPresence);
}

function finish() {
    channel.release();
}


// INTERFACE GLUE
// ----------------------------------------------------------------------

function get(account, address) {
    return $('#contacts [account="' + account + '"][address="' + address + '"]')._;
}

function add(account, address) {
    var contact;
    contact = cloneBlueprint('contact');
    contact.setAttribute('address', address);
    contact.setAttribute('account', account);
    contact.setAttribute('availability', 'unavailable');
    $(contact).$('[role="name"]')._.setAttribute('value', address);
    $('#contacts')._.appendChild(contact);
    return contact;
}


// DOMAIN REACTIONS
// ----------------------------------------------------------------------

function receivedMessage(message) {
    var account = message.session.name;
    var address = XMPP.JID(message.stanza.@from).address;

    var contact = get(account, address) || add(account, address);

    if(contact.getAttribute('current') != 'true' &&
       message.stanza.body != undefined &&
       message.stanza.ns_http_auth::confirm == undefined) {
        var pending = $(contact).$('[role="pending"]')._;
        pending.value = parseInt(pending.value) + 1;
    }

    if(message.stanza.ns_event::x.length() > 0)
        if(message.stanza.ns_event::x.composing.length() > 0)
            contact.setAttribute('chatstate', 'composing');
        else
            contact.setAttribute('chatstate', 'active');
    
    if(message.stanza.ns_chatstates::*.length() > 0)
        contact.setAttribute(
            'chatstate', message.stanza.ns_chatstates::*[0].localName());
}

function messagesSeen(account, address) {
    var contact = get(account, address) || add(account, address);
    $(contact).$('[role="pending"]')._.value = 0;
}

function nowTalkingWith(account, address) {
    var previouslyTalking = $('#contacts [current="true"]')._;
    if(previouslyTalking)
        previouslyTalking.setAttribute('current', 'false');

    if(account && address) {
        var contact = get(account, address) || add(account, address);
        contact.setAttribute('current', 'true');
        $(contact).$('[role="pending"]')._.value = 0;        
    }
}

function contactChangedRelationship(account, address, subscription, name) {
    var contact = get(account, address) || add(account, address);

    if(subscription)
        if(subscription == 'remove') {
            $('#contacts')._.removeChild(contact);
            return;
        }
        else
            contact.setAttribute('subscription', subscription);

    var nameElement = $(contact).$('[role="name"]')._;
    if(name)
        nameElement.setAttribute('value', name);
    else if(name == '' || !nameElement.hasAttribute('value'))
        nameElement.setAttribute('value', address);

    _reposition(contact);
}

function resourceChangedPresence(account, address) {
    var contact = get(account, address) || add(account, address);
    var summary = XMPP.presenceSummary(account, address);

    contact.setAttribute('availability', summary.stanza.@type.toString() || 'available');
    contact.setAttribute('show', summary.stanza.show.toString());

    _reposition(contact);

    if(summary.stanza.status.toString() == '')
        $(contact).$('[role="status"]')._.removeAttribute('value');
    else
        $(contact).$('[role="status"]')._.value = summary.stanza.status;

    if(summary.stanza.@type == 'unavailable')
        contact.setAttribute('chatstate', '');
}

function _reposition(contact) {
    var availability = contact.getAttribute('availability');
    var show = contact.getAttribute('show');

    $('#contacts')._.removeChild(contact);
    contact.style.opacity = 0;

    var sibling;
    if(contact.getAttribute('open') == 'true')
        sibling = $('#contacts [role="open"]')._.nextSibling;
    else if(availability == 'available' && show == '')
        sibling = $('#contacts [role="online"]')._.nextSibling;
    else if(availability == 'available' && show == 'chat')
        sibling = $('#contacts [role="online"]')._.nextSibling;
    else if(availability == 'available' && show == 'away')
        sibling = $('#contacts [role="away"]')._.nextSibling;
    else if(availability == 'available' && show == 'xa')
        sibling = $('#contacts [role="away"]')._.nextSibling;
    else if(availability == 'available' && show == 'dnd')
        sibling = $('#contacts [role="dnd"]')._.nextSibling;
    else
        sibling = $('#contacts [role="offline"]')._.nextSibling;

    var contactName = $(contact).$('[role="name"]')._.getAttribute('value').toLowerCase();
    while(sibling &&
          sibling.getAttribute('role') == 'contact' &&
          $(sibling).$('[role="name"]')._.getAttribute('value').toLowerCase() < contactName)
        sibling = sibling.nextSibling;
    
    if(!sibling)
        $('#contacts')._.appendChild(contact);
    else
        $('#contacts')._.insertBefore(contact, sibling);
    
    fadeIn(contact);
}

// XXX now actually asserting an interaction that might be already
// happening.  interactingWith() might be a better name.  Also
// there might be some overlap with nowTalkingWith().

function startedConversationWith(account, address) {
    var contact = get(account, address) || add(account, address);

    if(getContactPosition(contact) != 'open') {
        contact.setAttribute('open', 'true');
        _reposition(contact);
    }
}

function stoppedConversationWith(account, address) {
    var contact = get(account, address);
    if(contact) {
        contact.setAttribute('open', 'false');
        _reposition(contact);
    }
}


// NETWORK ACTIONS
// ----------------------------------------------------------------------

function requestMUCBookmarks(account) {
    XMPP.send(account,
              <iq type='get'>
              <query xmlns={ns_private}>
              <storage xmlns={ns_bookmarks}/>
              </query>
              <cache-control xmlns={ns_x4m_in}/>
              </iq>,
              receivedMUCBookmarks);
}

function requestRoster(account) {
    XMPP.send(account,
              <iq type='get'>
              <query xmlns={ns_roster}/>
              <cache-control xmlns={ns_x4m_in}/>
              </iq>,
              receivedRoster);
}

function removeContact(account, address) {
    XMPP.send(account,
              <iq type="set"><query xmlns={ns_roster}>
              <item jid={address} subscription="remove"/>
              </query></iq>);
}

function removeMUCBookmark(account, address) {
    XMPP.send(account,
              <iq type="set">
              {delMUCBookmark(address, getMUCBookmarks(account))}
              </iq>);
}

function addContact(account, address, subscribe) {
    XMPP.send(account,
              <iq type='set' id='set1'>
              <query xmlns='jabber:iq:roster'>
              <item jid={address}/>
              </query></iq>);

    XMPP.send(account, <presence to={address} type="subscribe"/>);
}

function acceptSubscriptionRequest(account, address) {
    XMPP.send(account, <presence to={address} type="subscribed"/>);
}

function denySubscriptionRequest(account, address) {
    XMPP.send(account, <presence to={address} type="unsubscribed"/>);
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

// function receivedSubscriptionPacket(presence) {
//     var roster = XMPP.cache.find({
//         event     : 'iq',
//         direction : 'in',
//         account   : presence.account,
//         stanza    : function(s) {
//             return s.ns_roster::query != undefined
//         }
//     });
//     if(roster.stanza..ns_roster::item.(@jid == presence.stanza.@from))
//         receivedSubscriptionApproval(presence);
// }

function receivedMUCBookmarks(iq) {
    $('#contacts [role="contact"][bookmark="true"]')._all.forEach(
        function(xulMUCContact) {
            if(xulMUCContact.getAttribute('availability') != 'available')
                xulMUCContact.parentNode.removeChild(xulMUCContact);
        });

    for each(var room in iq
             .stanza.ns_private::query
             .ns_bookmarks::storage
             .ns_bookmarks::conference) {
        var account = iq.account;
        var address = XMPP.JID(room.@jid).address;
        if(!get(account, address)) {
            xulMUC = add(account, address);
            xulMUC.setAttribute('bookmark', 'true');
        }
    }
}

function receivedPresence(presence) {
    var from = XMPP.JID(presence.stanza.@from);

    resourceChangedPresence(presence.session.name, from.address);
}

function receivedRoster(iq) {
    for each(var item in iq.stanza..ns_roster::item) {
        contactChangedRelationship(
            iq.session.name,
            item.@jid,
            item.@subscription,
            item.@name.toString());
    }
}

function sentSubscriptionConfirmation(presence) {
    subscriptionAccumulator.deleteIf(function(p) {
        return (p.account = presence.account &&
                p.stanza.@from == presence.stanza.@from);
    });
}

function receivedSubscriptionRequest(presence) {
    subscriptionAccumulator.receive(presence);
}

function receivedSubscriptionRequestSequence(sequence) {
    var xulNotify = $('#notify')._;
    xulNotify.appendNotification(
        sequence.length + ' request(s) pending',
        'subscription-request', null, xulNotify.PRIORITY_INFO_HIGH,
        [{label: 'View', accessKey: 'V', callback: viewRequest}]);

    function viewRequest() {
        var request = { };
        request.choice = false;
        request.contacts = sequence.map(function(presence) {
            return [presence.account,
                    XMPP.JID(presence.stanza.@from).address,
                    true];
        });
        request.description =
            'These contacts want to add you to their contact list. ' +
            'Do you accept?';

        window.openDialog(
            'chrome://sameplace/content/contact_selection.xul',
            'contact-selection',
            'modal,centerscreen', request);

        if(request.choice == true) {
            for each(var [account, address, authorize] in request.contacts) {
                if(authorize) {
                    acceptSubscriptionRequest(account, address);
                    if(get(account, address) == undefined ||
                       get(account, address).getAttribute('subscription') == 'none') {
                        // contact not yet in our contact list, request
                        // auth to make things even ;-)
                        addContact(account, address);
                    }
                } else {
                    denySubscriptionRequest(account, address);
                }
            }
        } else {
            for each(var [account, address, authorize] in request.contacts) {
                denySubscriptionRequest(account, address);
            }
        }
    }
}

// function receivedSubscriptionApproval(presence) {
//     var xulNotify = $('#notify')._;
//     xulNotify.appendNotification(
//         _('strings').getFormattedString('contactAccepted', [presence.stanza.@from]),
//         'sameplace-presence-subscription',
//         null, xulNotify.PRIORITY_INFO_HIGH, []);
// }

function receivedMUCPresence(presence) {
    resourceChangedPresence(presence.account,
                            XMPP.JID(presence.stanza.@from).address);
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function toggleOfflineContacts() {
    if(_('contacts').getAttribute('class') == 'show-offline')
        _('contacts').removeAttribute('class')
    else
        _('contacts').setAttribute('class', 'show-offline');
}

function getContactPosition(contact) {
    var previousElement = contact.previousSibling;
    while(previousElement) {
        // XXX Hackish.  These are not "roles"... "status" would be
        // more appropriate.
        
        if(previousElement.nodeName == 'label' ||
           previousElement.nodeName == 'spacer') {
            var role = previousElement.getAttribute('role');
            if(['open', 'online', 'away', 'dnd', 'offline'].indexOf(role) != -1)
                return role;
        }
        
        previousElement = previousElement.previousSibling;
    }
    return undefined;        
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function showingContactContextMenu(xulPopup) {
    var account = attr(document.popupNode, 'account');
    var address = attr(document.popupNode, 'address');

    xulPopup.setAttribute('class',
                          XMPP.isMUC(account, address) ? 'groupchat' : 'chat');
}

function requestedUpdateContactTooltip(element) {
    $('#contact-tooltip [role="name"]')._.value =
        XMPP.nickFor(attr(element, 'account'), attr(element, 'address'));
    $('#contact-tooltip [role="address"]')._.value = attr(element, 'address');
    $('#contact-tooltip [role="account"]')._.value = attr(element, 'account');

    var state = attr(element, 'subscription');
    if(state) {
        $('#contact-tooltip [role="subscription"]')._.value = _('strings').getString('subscription.' + state);
        $('#contact-tooltip [role="subscription"]')._.parentNode.hidden = false;
    } else
        $('#contact-tooltip [role="subscription"]')._.parentNode.hidden = true;
}

function requestedSetContactAlias(element) {
    var account = attr(element, 'account');
    var address = attr(element, 'address');
    var alias = { value: XMPP.nickFor(account, address) };

    var confirm = srvPrompt.prompt(
        null,
        _('strings').getString('aliasChangeTitle'),
        _('strings').getFormattedString('aliasChangeMessage', [address]),
        alias, null, {});

    if(confirm)
        XMPP.send(account,
                  <iq type="set"><query xmlns="jabber:iq:roster">
                  <item jid={address} name={alias.value}/>
                  </query></iq>);
}

function requestedRemoveRoom(element) {
    var account = attr(element, 'account');
    var address = attr(element, 'address');
    var nick = XMPP.JID(getJoinPresence(account, address).stanza.@to).resource;

    if(isMUCJoined(account, address))
        XMPP.send(account,
                  <presence to={address + '/' + nick} type="unavailable">
                  <x xmlns={ns_muc}/>
                  </presence>,
                  function() { removeMUCBookmark(account, address); });
    else
        removeMUCBookmark(account, address);
}

function requestedRemoveContact(element) {
    var account = attr(element, 'account');
    var address = attr(element, 'address');

    if(getMUCBookmark(account, address) != undefined)
        removeMUCBookmark(account, address);
    else
        removeContact(account, address);
}

function clickedContact(contact) {
    var selectEvent = document.createEvent('Event');
    selectEvent.initEvent('contact/select', true, false);
    contact.dispatchEvent(selectEvent);
}


// UTILITIES
// ----------------------------------------------------------------------


function TimedAccumulator(onReceive, waitPeriod) {
    this._queue = [];
    this._checkInterval = 500;
    this._waitPeriod = waitPeriod || 1500;
    this._onReceive = onReceive;
}

TimedAccumulator.prototype = {
    deleteIf: function(conditionFn) {
        this._queue = this._queue.every(function(item) { return !conditionFn(item); });
    },

    receive: function(stanza) {
        if(!this._checker)
            this._startChecker();

        this._queue.push(stanza);
        this._lastReceived = new Date();
    },

    _startChecker: function() {
        var self = this;
        this._checker = window.setInterval(function() {
            if((new Date()) - self._lastReceived > self._waitPeriod) {
                window.clearInterval(self._checker);
                self._checker = null;
                var queue = self._queue.splice(0);
                if(queue.length != 0)
                    self._onReceive(queue);
            }
        }, this._checkInterval);
    },
};
