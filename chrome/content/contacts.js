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

var subscriptionDesc = {
    'both': 'Both see when other is online',
    'from': 'Contact sees when you are online',
    'to': 'You see when contact is online',
    'none': 'Neither sees when other is online'
}


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    $('#contacts')._.selectedIndex = -1;

    channel = XMPP.createChannel();

    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.@type == undefined || s.@type == 'unavailable';
            }},
        function(presence) { receivedPresence(presence) });
    channel.on(
        {event: 'iq', direction: 'in', stanza: function(s) {
                return s.ns_roster::query.length() > 0;
            }},
        function(iq) { receivedRoster(iq); });
    channel.on(
        {event: 'message', direction: 'in'},
        function(message) {
            receivedMessage(message);
        });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.@type == 'subscribe';
            }},
        function(presence) { receivedSubscriptionRequest(presence); });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.ns_muc_user::x.length() > 0;
            }}, function(presence) { receivedMUCPresence(presence) });
    channel.on(
        {event: 'iq', direction: 'out', stanza: function(s) {
                return s.@type == 'set' &&
                    s.ns_private::query.ns_bookmarks::storage != undefined;
            }}, function(iq) { requestBookmarks(iq.account); });
    channel.on(
        {event: 'iq', direction: 'in', stanza: function(s) {
                return s.@type == 'result' &&
                    s.ns_private::query.ns_bookmarks::storage != undefined;
            }}, function(iq) { receivedMUCBookmarks(iq); });


    XMPP.cache.fetch({
        event: 'iq',
        direction: 'in',
        stanza: function(s) {
                return s.ns_roster::query.length() > 0;
            }})
        .forEach(receivedRoster);

    XMPP.cache.fetch({
        event: 'presence',
        direction: 'in',
        })
        .forEach(receivedPresence);

    XMPP.accounts.filter(XMPP.isUp).forEach(requestBookmarks);
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
       message.stanza.body.length() > 0) {
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

    var contact = get(account, address) || add(account, address);
    contact.setAttribute('current', 'true');
    $(contact).$('[role="pending"]')._.value = 0;
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
        sibling = $('#contacts [role="offline"]').nextSibling;

    while(sibling &&
          sibling.getAttribute('role') == 'contact' &&
          $(sibling).$('[role="name"]')._.getAttribute('value').toLowerCase() <
          $(contact).$('[role="name"]')._.getAttribute('value').toLowerCase())
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

function removeContact(account, address) {
    XMPP.send(account,
              <iq type="set"><query xmlns={ns_roster}>
              <item jid={address} subscription="remove"/>
              </query></iq>);
}

function removeMUCBookmark(account, address) {
    var query = getMUCBookmarks(account, address);
    var bookmark = query.ns_bookmarks::storage.ns_bookmarks::conference.(@jid == address);
    if(bookmark == undefined)
        return;

    delete query
        .ns_bookmarks::storage
        .ns_bookmarks::conference[bookmark.childIndex()];
        
    XMPP.send(account,
              <iq type="set">{query}</iq>,
              function(reply) {
                  if(reply.stanza.@type == 'result')
                      requestBookmarks(account);
              });
}

function requestBookmarks(account, action) {
    XMPP.send(account.jid || account,
              <iq type="get">
              <query xmlns={ns_private}>
              <storage xmlns={ns_bookmarks}/>
              </query>
              </iq>,
              function(reply) { if(action) action(reply); });
}

function addContact(account, address, subscribe) {
    XMPP.send(
        account,
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
    function watchForSubscriptionApproval(item) {
        var listener = channel.on({
            event     : 'presence',
            direction : 'in',
            stanza    : function(s) {
                    return (s.@type == 'subscribed' &&
                            s.@from == item.@jid);
                }},
            function(presence) {
                channel.forget(listener);
                receivedSubscriptionApproval(presence);
            });
    }

    for each(var item in iq.stanza..ns_roster::item) {
        if(item.@ask == 'subscribe')
            watchForSubscriptionApproval(item);

        contactChangedRelationship(
            iq.session.name,
            item.@jid,
            item.@subscription,
            item.@name.toString());
    }
}

function receivedSubscriptionRequest(presence) {
    // Skip notification if appendNotification() not available (as in Firefox 1.5)
    if(typeof(notify) == 'function')
        notify('Request from ' + presence.stanza.@from,
               'sameplace-presence-subscription',
               null, notify.PRIORITY_INFO_HIGH,
               [{label: 'View', accessKey: 'V', callback: viewRequest}]);
    else
        viewRequest();

    function viewRequest() {
        var account = presence.session.name;
        var address = presence.stanza.@from.toString();
        var accept, reciprocate;

        if(get(account, address) == undefined ||
           get(account, address).getAttribute('subscription') == 'none') {
            var check = {value: true};
            accept = srvPrompt.confirmCheck(
                null, 'Contact notification',
                address + ' wants to add ' + presence.stanza.@to + ' to his/her contact list.\nDo you accept?',
                'Also add ' + address + ' to my contact list', check);
            reciprocate = check.value;
        }
        else
            accept = srvPrompt.confirm(
                null, 'Contact notification',
                address + ' wants to add ' + presence.stanza.@to + ' to his/her contact list.\nDo you accept?');

        if(accept) {
            acceptSubscriptionRequest(account, address);
            if(reciprocate)
                addContact(account, address);
        } else
            denySubscriptionRequest(account, address);
    }
}

function receivedSubscriptionApproval(presence) {
    // Skip notification if appendNotification() not available (as in Firefox 1.5)
    if(typeof(notify) == 'function')
        notify(presence.stanza.@from + ' has accepted to be in your contact list.',
               'sameplace-presence-subscription',
               null, notify.PRIORITY_INFO_HIGH, []);
}

function receivedMUCPresence(presence) {
    resourceChangedPresence(presence.account,
                            XMPP.JID(presence.stanza.@from).address);
}


// GUI ACTIONS
// ----------------------------------------------------------------------

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

    var enableRemove;
    if(isMUC(account, address))
        if(isMUCJoined(account, address))
            enableRemove = false;
        else if(isMUCBookmarked(account, address))
            enableRemove = true;
        else
            enableRemove = false;
    else
        enableRemove = true;
    
    $(xulPopup).$('[role="remove"]')._.setAttribute('disabled', !enableRemove);
}

function requestedUpdateContactTooltip(element) {
    $('#contact-tooltip [role="name"]')._.value =
        XMPP.nickFor(attr(element, 'account'), attr(element, 'address'));
    $('#contact-tooltip [role="address"]')._.value = attr(element, 'address');
    $('#contact-tooltip [role="account"]')._.value = attr(element, 'account');

    var subscriptionState = attr(element, 'subscription');
    if(subscriptionState) {
        $('#contact-tooltip [role="subscription"]')._.value = subscriptionDesc[subscriptionState];
        $('#contact-tooltip [role="subscription"]')._.parentNode.hidden = false;
    } else
        $('#contact-tooltip [role="subscription"]')._.parentNode.hidden = true;

    var image = userImages[attr(element, 'address')];
    if(image && image.binval)
        $('#contact-tooltip [role="userimage"]').src = 'data:'+image.type+';base64,'+image.binval;
    else
        $('#contact-tooltip [role="userimage"]').src = '';
}

function requestedSetContactAlias(element) {
    var account = attr(element, 'account');
    var address = attr(element, 'address');
    var alias = { value: XMPP.nickFor(account, address) };

    var confirm = srvPrompt.prompt(
        null, 'Alias Change', 'Choose an alias for ' + address, alias, null, {});

    if(confirm)
        XMPP.send(account,
                  <iq type="set"><query xmlns="jabber:iq:roster">
                  <item jid={address} name={alias.value}/>
                  </query></iq>);
}

function requestedRemoveContact(element) {
    var account = attr(element, 'account');
    var address = attr(element, 'address');
    
    if(isMUC(account, address))
        removeMUCBookmark(account, address);
    else
        removeContact(account, address);
}

function clickedContact(contact) {
    requestedCommunicate(contact, getDefaultAppUrl())
}

function requestedCommunicate(contact, url) {
    if(onRequestedCommunicate)
        onRequestedCommunicate(
            attr(contact, 'account'),
            attr(contact, 'address'),
            url);
}


// GUI UTILITIES (SPECIFIC)
// ----------------------------------------------------------------------

function getDefaultAppUrl() {
    var url = prefBranch.getCharPref('defaultAppUrl');
    return isChromeUrl(url) ? chromeToFileUrl(url) : url;
}

var notify;
window.addEventListener(
    'load', function(event) {
        if(typeof($('#notify')._.appendNotification) == 'function') {
            notify = function() {
                return $('#notify')._.appendNotification.apply($('#notify')._, arguments);
            }
            for(var name in $('#notify')._)
                if(name.match(/^PRIORITY_/))
                    notify[name] = $('#notify')._[name];
        }
    }, false);

