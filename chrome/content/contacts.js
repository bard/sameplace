// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;

var srvPrompt = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);

var ns_roster   = 'jabber:iq:roster';
var ns_muc_user = 'http://jabber.org/protocol/muc#user';


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    _('contacts').selectedIndex = -1;

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
            gotMessageFrom(
                message.session.name, XMPP.JID(message.stanza.@from).address);
        });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.@type == 'subscribe';
            }},
        function(presence) { receivedSubscriptionRequest(presence); });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.@type == 'subscribed';
            }},
        function(presence) { receivedSubscriptionApproval(presence); });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.ns_muc_user::x.length() > 0;
            }}, function(presence) { receivedMUCPresence(presence) });

    XMPP.cache.roster.forEach(receivedRoster);
    XMPP.cache.presenceIn.forEach(receivedPresence);
}


// INTERFACE GLUE
// ----------------------------------------------------------------------

function get(account, address) {
    return x('//*[@id="contacts"]//*[' +
             '@address="' + address + '" and ' +
             '@account="' + account + '"]');
}

function add(account, address) {
    var contact;
    contact = cloneBlueprint('contact');
    contact.setAttribute('address', address);
    contact.setAttribute('account', account);
    contact.setAttribute('type', 'chat');
    contact.setAttribute('availability', 'unavailable');
    contact.getElementsByAttribute('role', 'name')[0].setAttribute('value', address);
    _('contacts').appendChild(contact);
    return contact;
}


// DOMAIN REACTIONS
// ----------------------------------------------------------------------

function gotMessageFrom(account, address) {
    var contact = get(account, address) || add(account, address);

    if(contact.getAttribute('current') != 'true') {
        var pending = parseInt(_(contact, {role: 'pending'}).value);
        _(contact, {role: 'pending'}).value = pending + 1;
    }
}

function messagesSeen(account, address) {
    var contact = get(account, address) || add(account, address);

    _(contact, {role: 'pending'}).value = 0;
}

function nowTalkingWith(account, address) {
    var previouslyTalking = _('contacts', {current: 'true'});
    if(previouslyTalking)
        previouslyTalking.setAttribute('current', 'false');

    var contact = get(account, address) || add(account, address);
    contact.setAttribute('current', 'true');
    _(contact, {role: 'pending'}).value = 0;
}

function contactChangedRelationship(account, address, subscription, name) {
    var contact = get(account, address) || add(account, address);

    if(subscription)
        if(subscription == 'remove') {
            _('contacts').removeChild(contact);
            return;
        }
        else
            contact.setAttribute('subscription', subscription);

    var nameElement = contact.getElementsByAttribute('role', 'name')[0];
    if(name)
        nameElement.setAttribute('value', name);
    else if(name == '' || !nameElement.hasAttribute('value'))
        nameElement.setAttribute('value', address);
}

function resourceChangedPresence(account, address) {
    var contact = get(account, address) || add(account, address);
    var summary = XMPP.presenceSummary(account, address);

    contact.setAttribute('availability', summary.stanza.@type.toString() || 'available');
    contact.setAttribute('show', summary.stanza.show.toString());

    _reposition(contact);

    if(summary.stanza.status == undefined ||
       summary.stanza.status == '')
        _(contact, {role: 'status'}).removeAttribute('value');
    else
        _(contact, {role: 'status'}).value = summary.stanza.status;
}

function _reposition(contact) {
    var availability = contact.getAttribute('availability');
    var show = contact.getAttribute('show');

    contact.style.opacity = 0;
    if(contact.getAttribute('open') == 'true')
        _('contacts').insertBefore(contact, _('contacts', {role: 'open'}).nextSibling);
    else if(availability == 'available' && show == '')
        _('contacts').insertBefore(contact, _('contacts', {role: 'online'}).nextSibling);
    else if(availability == 'available' && show == 'away')
        _('contacts').insertBefore(contact, _('contacts', {role: 'away'}).nextSibling);
    else if(availability == 'available' && show == 'dnd')
        _('contacts').insertBefore(contact, _('contacts', {role: 'dnd'}).nextSibling);
    else
        _('contacts').insertBefore(contact, _('contacts', {role: 'offline'}).nextSibling);
    fadeIn(contact);
}

function startedConversationWith(account, address, type) {
    var contact = get(account, address) || add(account, address);
    contact.setAttribute('open', 'true');
    contact.setAttribute('type', type);
    _reposition(contact);
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
    XMPP.send(
        account,
        <presence to={address} type="subscribed"/>);
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

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

function receivedSubscriptionRequest(presence) {
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
    else {
        accept = srvPrompt.confirm(
            null, 'Contact notification',
            address + ' wants to add ' + presence.stanza.@to + ' you to his/her contact list.\nDo you accept?');

    }
    if(accept) {
        acceptSubscriptionRequest(account, address);
        if(reciprocate)
            addContact(account, address);
    }
}

function receivedSubscriptionApproval(presence) {
    srvPrompt.alert(
        null, 'Contact Notification',
        presence.stanza.@from + ' has accepted to be added to your contact list.');
}

function receivedMUCPresence(presence) {
    var from = XMPP.JID(presence.stanza.@from);

    resourceChangedPresence(
        presence.session.name,
        from.address,
        from.resource,
        presence.stanza.@type);
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function requestedUpdateContactTooltip(element) {
    _('contact-tooltip', {role: 'name'}).value =
        XMPP.nickFor(attr(element, 'account'), attr(element, 'address'));
    _('contact-tooltip', {role: 'address'}).value = attr(element, 'address');
    _('contact-tooltip', {role: 'account'}).value = attr(element, 'account');

    if(attr(element, 'type') == 'groupchat') 
        _('contact-tooltip', {role: 'subscription'}).parentNode.hidden = true;
    else {
        _('contact-tooltip', {role: 'subscription'}).parentNode.hidden = false;
        var subscription = attr(element, 'subscription');
        switch(subscription) {
        case 'both':
            subscription = 'Both see when other is online';
            break;
        case 'from':
            subscription = 'Contact sees when you are online';
            break;
        case 'to':
            subscription = 'You see when contact is online';
            break;
        case 'none':
            subscription = 'Neither sees when other is online';
            break;
        }
    }

    _('contact-tooltip', {role: 'subscription'}).value = subscription;
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

    XMPP.send(account,
              <iq type="set"><query xmlns="jabber:iq:roster">
              <item jid={address} subscription="remove"/>
              </query></iq>);
}

function clickedContact(contact) {
    if(onClickedContact)
        onClickedContact(contact);
}

function requestedCommunicate(contact, url, target) {
    if(onRequestedCommunicate)
        onRequestedCommunicate(
            attr(contact, 'account'),
            attr(contact, 'address'),
            attr(contact, 'type') || 'chat',
            url,
            target);
}