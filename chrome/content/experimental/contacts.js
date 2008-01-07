/*
 * Copyright 2006-2007 by Massimiliano Mirra
 * 
 * This file is part of SamePlace.
 * 
 * SamePlace is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 3 of the License, or (at your
 * option) any later version.
 * 
 * SamePlace is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * The interactive user interfaces in modified source and object code
 * versions of this program must display Appropriate Legal Notices, as
 * required under Section 5 of the GNU General Public License version 3.
 *
 * In accordance with Section 7(b) of the GNU General Public License
 * version 3, modified versions must display the "Powered by SamePlace"
 * logo to users in a legible manner and the GPLv3 text must be made
 * available to them.
 * 
 * Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
 *  
 */

// DOCUMENTATION
// ----------------------------------------------------------------------

// Individual DOM elements are retrieved with the $() function.  It
// accepts a CSS or XPath query.  It returns the DOM element.
// 
// Collections of DOM elements are retrieved with the $$() function.  It
// accepts a CSS or XPath query.  It returns an object with only a
// forEach() method.
// 
// Code is arranged in actions, reactions, and utilities.  Actions and
// reactions are allowed to access the environment (DOM and global
// variables).  Actions are allowed to cause side effects.  Utilities
// should neither rely on data other than what is provided via arguments,
// nor produce side effects.  This is a relaxed restriction, though.


// TODO
// ----------------------------------------------------------------------

// Replace "contact name" with "contact handle"
//
// Only blink message indicator if status is "available"
//
// On certain events, change contact background to get attention
//
// On upper right of contact, display capabilities and info like web
// page, mail, etc
//
// Per-contact menu to access shared apps


// DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var srvPrompt = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);
var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');

var COMPACT_WIDTH = 65;

var dndObserver = {};


// STATE
// ----------------------------------------------------------------------

var channel;
var simulation = false;
var insertionStrategy;
var subscriptionAccumulator;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init(event) {
    initGUIReactions();
    initNetworkReactions();
    initState();
}

function initGUIReactions() {
    // Cannot be assigned via onscroll="..." because scroll event in
    // Firefox2 is not reflected onto attribute.
    $('#contacts').addEventListener('scroll', scrolledContacts, false);

    window.addEventListener('resize', resizedView, false);
}

function initNetworkReactions() {
    subscriptionAccumulator = new TimedAccumulator(
        receivedSubscriptionRequestSequence, 1500);
    
    channel = XMPP.createChannel(
            <query xmlns="http://jabber.org/protocol/disco#info">
            <feature var="http://jabber.org/protocol/muc"/>
            <feature var="http://jabber.org/protocol/muc#user"/>
            <feature var="http://jabber.org/protocol/xhtml-im"/>
            <feature var="http://jabber.org/protocol/chatstates"/>
            </query>);

    channel.on({
        event     : 'iq',
        direction : 'in',
        stanza    : function(s) {
            return s.ns_roster::query != undefined;
        }
    }, receivedRoster);

    channel.on({
        event     : 'presence',
        direction : 'in',
        stanza    : function(s) {
            return (s.@type == undefined || s.@type == 'unavailable') &&
                s.ns_muc_user::x == undefined;
        }
    }, receivedContactPresence);

    channel.on({
        event     : 'presence',
        direction : 'in',
        stanza    : function(s) {
            return (s.@type == undefined || s.@type == 'unavailable') &&
                s.ns_muc_user::x != undefined;
        }
    }, receivedRoomPresence);

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
        event     : 'message',
        direction : 'in',
        stanza    : function(s) {
            return s.@type == 'groupchat' &&
                s.subject != undefined;
        }
    }, receivedRoomSubject);

    channel.on({
        event     : 'presence',
        direction : 'out',
        stanza    : function(s) {
            return (s.@type == undefined || s.@type == 'unavailable') &&
                s.ns_muc::x == undefined && s.@to == undefined;
        }
    }, sentPresence);
}

function initState() {
    resizedView()
    regenerateGroups();

    insertionStrategy = insertionStrategies[
        $('#contacts').getAttribute('sort')];
    
    if(simulation) {
        populateListFake();
    } else {
        XMPP.accounts
            .filter(XMPP.isUp)
            .forEach(requestRoster);
        
        XMPP.cache
            .all(XMPP.q()
                 .event('presence')
                 .direction('in'))
            .forEach(receivedContactPresence);
    }
}

function finish() {
    channel.release();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function detachSidebar() {
    var wndContacts = window.open(
        'chrome://sameplace/content/experimental/contacts.xul',
        'SamePlace:Contacts', 'chrome');
    document.location.href = 'about:blank';
}

function openAboutDialog() {
    window.openDialog('chrome://sameplace/content/experimental/about.xul',
                      'About', 'centerscreen,chrome,resizable=no');
}

function openPreferences(paneID) {
    var instantApply;
    try {
        instantApply = Cc['@mozilla.org/preferences-service;1']
            .getService(Ci.nsIPrefBranch)
            .getBoolPref('browser.preferences.instantApply', false);
    } catch(e) {
        instantApply = false;
        Cu.reportError(e);
    }
        
    var features = 'chrome,titlebar,toolbar,centerscreen' +
        (instantApply ? ',dialog=no' : '');
    
    var prefWindow = Cc['@mozilla.org/appshell/window-mediator;1']
        .getService(Ci.nsIWindowMediator)
        .getMostRecentWindow('SamePlace:Preferences');
    
    if(prefWindow) {
        prefWindow.focus();
        if(paneID) {
            var pane = prefWindow.document.getElementById(paneID);
            prefWindow.document.documentElement.showPane(pane);
        }
    } else {
        window.openDialog('chrome://sameplace/content/preferences.xul',
                          'SamePlace:Preferences', features, paneID);
    }
}

function getBrowser() {
    return top.getBrowser();
}

function setInsertionStrategy(strategyName) {
    var xulContacts = $('#contacts');
    var currentStrategyName = xulContacts.getAttribute('sort');
    if(strategyName != currentStrategyName) {
        xulContacts.setAttribute('sort', strategyName);
        insertionStrategy = insertionStrategies[strategyName];
        for each(var xulContact in Array.slice(xulContacts.childNodes)) {
            placeContact(xulContact);
        }
    }
}

function openURL(url) {
    if(!url.match(/^((https?|ftp|file):\/\/|(xmpp|mailto):)/))
        return;
    
    function canLoadPages(w) {
        return (w && 
                typeof(w.getBrowser) == 'function' &&
                'addTab' in w.getBrowser());
    }

    var candidates = [
        top, 
        Cc['@mozilla.org/appshell/window-mediator;1']
            .getService(Ci.nsIWindowMediator)
            .getMostRecentWindow('navigator:browser')]
        .filter(canLoadPages);

    if(candidates.length > 0)
        candidates[0].getBrowser().selectedTab =
        candidates[0].getBrowser().addTab(url);
    else
        Cc['@mozilla.org/uriloader/external-protocol-service;1']
        .getService(Ci.nsIExternalProtocolService)
        .loadUrl(Cc['@mozilla.org/network/io-service;1']
                 .getService(Ci.nsIIOService)
                 .newURI(url, null, null));
}

function toggleOfflineContacts() {
    toggleClass($('#contacts'), 'hide-unavailable');
    contactsUpdated();
}

function updateContactPhoto(account, address, xmlPhoto) {
    var xulContact = getContact(account, address);
    
    if(xmlPhoto.ns_vcard::BINVAL != undefined)
        $(xulContact, '.avatar').setAttribute(
            'src', 'data:' + xmlPhoto.ns_vcard::TYPE + ';base64,' +
                xmlPhoto.ns_vcard::BINVAL);
    else if(xmlPhoto.ns_vcard::EXTVAL != undefined)
        $(xulContact, '.avatar').setAttribute(
            'src', xmlPhoto.ns_vcard::EXTVAL);
}

function placeContact(xulContact) {
    var xulContacts = $('#contacts');
    var insertionPoint = findInsertionPoint(
        xulContacts.childNodes,
        insertionStrategy(
            xulContact.getAttribute(xulContacts.getAttribute('sort'))));

    if(insertionPoint)
        xulContacts.insertBefore(xulContact, insertionPoint);
    else
        xulContacts.appendChild(xulContact);

    contactsUpdated();
}

function regenerateGroups() { // these won't take into account non-ascii characters
    var ASCIICODE_A = 65, ASCIICODE_Z = 91;

    var xulContacts = $('#contacts');
    $$(xulContacts, '.header').forEach(function(xulHeader) {
        xulContacts.removeChild(xulHeader);
    });

    var xulBlueprint = $('#blueprints > .header');
    var xulHeader, letter;

    for(var i=ASCIICODE_A; i<ASCIICODE_Z; i++) {
        letter = String.fromCharCode(i);
        xulHeader = xulBlueprint.cloneNode(true);
        xulHeader.setAttribute('display-name', letter.toLowerCase());
        $(xulHeader, '> .title').setAttribute('value', letter);
        xulContacts.appendChild(xulHeader);
    }
}

function incPending(address) {
    var xulContact = $('#contacts > .contact[address="' + address + '"]');
    var pending = parseInt(xulContact.getAttribute('pending'));
    xulContact.setAttribute('pending', pending+1);
}

function toggleConversations() {
    $('#conversations-box').collapsed = !$('#conversations-box').collapsed;
}

function createContact(account, address) {
    var xulContact = xulContact = $('#blueprints > .contact').cloneNode(true);
    xulContact.setAttribute('account', account);
    xulContact.setAttribute('address', address);
    return xulContact;
}

function getContact(account, address) {
    return $('.contact[account="' + account + '"][address="' + address + '"]');
}

function updateHeaders() {
    var xulContacts = $('#contacts');

    var xulAllHeaders = $$(xulContacts, '.header');

    // XXX following CSS query doesn't work yet as css->xpath
    // translator doesn't generate [1] at the end:
    // $$('#contacts .contact - .header')

    // for every contact, take the first preceding sibling of class
    // "header". this excludes headers with no contact followers
    // before the next header.

    var xulHeadersWithContacts =
        $$('//*[@id = "contacts"]' +
           '//*[contains(@class, "contact") ' +
           (hasClass(xulContacts, 'hide-unavailable') ?
            'and @availability = "available"]' : ']') +
           '/preceding-sibling::*[contains(@class, "header")][1]')
        .toArray();

    // Sort-of parallel iteration on all headers and active headers.
    // Iteration on active headers is done destructively by shift()ing
    // one element every time one is found in the list of all headers.
    // (This only works because we can count on the lists being
    // ordered the same way.)

    xulAllHeaders.forEach(function(xulHeader) {
        if(xulHeader == xulHeadersWithContacts[0]) {
            addClass(xulHeader, 'active');
            xulHeadersWithContacts.shift();
        } else {
            removeClass(xulHeader, 'active');
        }
    });
}

function requestedFilter(namePart) {
    filterContacts(namePart);
    
    if(!namePart.match(/^\s*$/))
        $('#contacts').selectedItem =
        $('#contacts .contact[candidate="true"][availability="available"]');
}

function filterContacts(prefix) {
    $('#contacts').scrollBoxObject.scrollTo(0,0);

    const EMPTY = /^\s*$/

    // XXX this can be optimized by keeping every result set
    // around...
    
    var oldCandidates =
        '//*[@id = "contacts"]/*[contains(@class, "contact")' +
        ' and @candidate = "true"]';

    $$(oldCandidates).forEach(function(xulContact) {
        xulContact.removeAttribute('candidate');
    });
    
    if(prefix.match(EMPTY)) {
        removeClass($('#contacts-stack'), 'filtering');
    } else {
        addClass($('#contacts-stack'), 'filtering');

        var newCandidates =
            '//*[@id = "contacts"]/*[contains(@class, "contact")' +
            ' and contains(@display-name, "' + prefix.toLowerCase() + '")]';

        $$(newCandidates).forEach(function(xulContact) {
            xulContact.setAttribute('candidate', 'true');
        });
    }
}


// GUI REACTIONS
// ----------------------------------------------------------------------

dndObserver.getSupportedFlavours = function() {
    var flavours = new FlavourSet();
    flavours.appendFlavour('text/html');
    flavours.appendFlavour('text/unicode');
    return flavours;
};

dndObserver.onDragOver = function(event, flavour, session) {
    addClass(event.currentTarget, 'dragover');
};

dndObserver.onDragExit = function(event, session) {
    removeClass(event.currentTarget, 'dragover');    
};

dndObserver.onDrop = function(event, dropdata, session) {
    if(dropdata.data != '') {
        var xulContact = event.currentTarget;
        var account = xulContact.getAttribute('account');
        var address = xulContact.getAttribute('address');
        var message = dataToMessage(dropdata.data, dropdata.flavour.contentType);
        message.@to = address;
        XMPP.send(account, message);
    }
};

function requestedImportContacts() {
    var request = {title: 'Enter transport address'};
    window.openDialog('chrome://sameplace/content/prompt_address.xul',
                      'register',
                      'modal,centerscreen',
                      request);
    
    if(!request.confirm)
        return;
    
    registerToService(request.account, request.address, {
        onSuccess: function() { window.alert($('#strings-toolbox').getString('transportRegistrationSuccess')); },
        onError: function(info) { window.alert($('#strings-toolbox').getFormattedString('transportRegistrationError', [info])); },
        onCancel: function() {}
    });
}

function requestedChangeStatusMessage(event) {
    var xulTextbox = event.target;
    if(xulTextbox.value != xulTextbox.getAttribute('placeholder'))
        changeStatusMessage(xulTextbox.value);
    
    $('#contacts').focus();
}

function requestedManageScriptlets() {
    window.openDialog('chrome://sameplace/content/scriptlet_manager.xul',
                      'SamePlace:ScriptletManager', 'chrome', getScriptlets());
}

function showingScriptletList(xulPopup) {
    var xulSeparator = xulPopup.getElementsByTagName('menuseparator')[0];
    while(xulPopup.firstChild && xulPopup.firstChild != xulSeparator)
        xulPopup.removeChild(xulPopup.firstChild);

    var scriptlets = getScriptlets();
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
                'label', $('#strings-toolbox').getFormattedString('scriptletLoadingError',
                                                          [scriptlet.fileName]));
            xulScriptlet.setAttribute('style', 'color:red;')
            xulScriptlet.addEventListener('command', function(event) {
                window.alert(e.name + '\n' + e.stack);
            }, false);
        }
        xulScriptlet.setAttribute('type', 'checkbox');
        xulScriptlet.setAttribute('checked', scriptlet.enabled ? 'true' : 'false');
        xulPopup.insertBefore(xulScriptlet, xulSeparator);
    });
    
    xulSeparator.hidden = (count == 0);
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

function requestedRemoveRoom(xulPopupNode) {
    var xulContact = $(xulPopupNode, '^ .contact');

    /* XXX
    var nick = XMPP.JID(getJoinPresence(account, address).stanza.@to).resource;

    if(isMUCJoined(account, address))
        XMPP.send(account,
                  <presence to={address + '/' + nick} type="unavailable">
                  <x xmlns={ns_muc}/>
                  </presence>,
                  function() { removeMUCBookmark(account, address); });
    else
        removeMUCBookmark(account, address);
*/
}

function requestedRemoveContact(xulPopupNode) {
    var xulContact = $(xulPopupNode, '^ .contact');
    var account = xulContact.getAttribute('account');
    var address = xulContact.getAttribute('address');

/* XXX
    if(getMUCBookmark(account, address) != undefined)
        removeMUCBookmark(account, address);
    else
*/
    removeContact(account, address);
}

function showingContactContextMenu(xulPopup, xulPopupNode) {
    var xulContact = $(xulPopupNode, '^ .contact');
    setClass(xulPopup, 'groupchat',
             XMPP.isMUC(
                 xulContact.getAttribute('account'),
                 xulContact.getAttribute('address')));
}

function requestedChangeSort(xulPopup) {
    setInsertionStrategy($(xulPopup, '[checked="true"]').value);
}

function showingContactTooltip(xulPopupNode) {
    var xulContact = $(xulPopupNode, '^ .contact');
    var account = xulContact.getAttribute('account');
    var address = xulContact.getAttribute('address');
    var subscriptionState = xulContact.getAttribute('subscription');

    $('#contact-tooltip .name').value = XMPP.nickFor(account, address);
    $('#contact-tooltip .address').value = address;
    $('#contact-tooltip .account').value = account;

    if(subscriptionState) {
        $('#contact-tooltip .subscription').value = $('#strings')
            .getString('subscription.' + subscriptionState);
        $('#contact-tooltip .subscription').parentNode.hidden = false;
    } else
        $('#contact-tooltip .subscription').parentNode.hidden = true;
}

function clickedContact(xulContact) {
    var selectEvent = document.createEvent('Event');
    selectEvent.initEvent('contact/select', true, false);
    xulContact.dispatchEvent(selectEvent);
}

function showingSortMenu(event) {
    var xulPopup = event.target;
    var insertionStrategyName = $('#contacts').getAttribute('sort');
    $(xulPopup, '[value="' + insertionStrategyName + '"]')
        .setAttribute('checked', 'true');
}

function clickedStatus(event) {
    var url = event.target.getAttribute('link');
    if(url) {
        event.stopPropagation();
        openURL(url);
    }
}

function contactsUpdated() {
    singleExec(updateHeaders);
}

function resizedView(event) {
    setClass($('#view'), 'compact',
             document.width <= COMPACT_WIDTH);
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
        addContact(request.account,
                   request.contactAddress,
                   request.subscribeToPresence);
}

function requestedConnection() {
    if(XMPP.accounts.length > 0)
        XMPP.up();
    else
        runWizard(); // XXX not ported
}

function requestedSetContactAlias(xulPopupNode) {
    var xulContact = $(xulPopupNode, '^ .contact');

    var account = xulContact.getAttribute('account');
    var address = xulContact.getAttribute('address');
    var alias = { value: XMPP.nickFor(account, address) };

    var confirm = srvPrompt.prompt(
        null,
        $('#strings').getString('aliasChangeTitle'),
        $('#strings').getFormattedString('aliasChangeMessage', [address]),
        alias, null, {});

    if(confirm)
        XMPP.send(account,
                  <iq type="set"><query xmlns="jabber:iq:roster">
                  <item jid={address} name={alias.value}/>
                  </query></iq>);
}

function clickedContactName(event) {
/*
    if(event.button == 0) {
        event.stopPropagation();
        toggle($(event.target, '^ .contact .extra'), 'height', 100);
    }
*/
}

function scrolledContacts(event) {
    scroller.update();
}

function changedContactsOverflow(event) {
    scroller.update();
}


// UTILITIES
// ----------------------------------------------------------------------

function html2xhtml(htmlString) {
    // XXX safe, because content written with innerHTML won't interpret
    // <script> elements
    $('#html-conversion-area').contentDocument.body.innerHTML = htmlString;
    return conv.htmlDOMToXHTML($('#html-conversion-area').contentDocument.body);
}

function dataToMessage(data, contentType) {
    // Should not be needed, but apparently is.
    XML.prettyPrinting = false;
    XML.ignoreWhitespace = false;

    var message =
        <message><x xmlns={ns_event}><composing/></x><active xmlns={ns_chatstates}/></message>;

    switch(contentType) {
    case 'text/unicode':
        message.body = <body>{data}</body>;
        message.ns_xhtml_im::html.body = <body xmlns={ns_xhtml}>{data}</body>
        break;
    case 'application/xhtml+xml':
        message.body = <body>{filter.htmlEntitiesToCodes(
            conv.xhtmlToText(data))}</body>;
        
        message.ns_xhtml_im::html.body = filter.xhtmlIM.keepRecommended(data);
        break;
    case 'text/html':
        message = dataToMessage(html2xhtml(data), 'application/xhtml+xml');
        break;
    default:
        throw new Error('Unknown content type. (' + contentType + ')');
    }

    return message;
}

function textToXULDesc(text) {
    var ns_xul = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
    return document.importNode(
        asDOM(filter.applyTextProcessors(
                <description flex="1" xmlns={ns_xul}>{text}</description>,
            [processURLs])),
        true);
}

function afterLoad(xulPanel, action) {
    xulPanel.addEventListener(
        'load', function(event) {
            if(event.target != xulPanel.contentDocument)
                return;

            // The following appears not to work if reference to
            // xulPanel is not the one carried by event object.
            xulPanel = event.currentTarget;
            xulPanel.contentWindow.addEventListener(
                'load', function(event) {
                    action(xulPanel);
                }, false);

            xulPanel.removeEventListener('load', arguments.callee, true);
        }, true);
}

function TimedAccumulator(onReceive, waitPeriod) {
    this._queue = [];
    this._checkInterval = 500;
    this._waitPeriod = waitPeriod || 1500;
    this._onReceive = onReceive;
}

TimedAccumulator.prototype = {
    deleteIf: function(conditionFn) {
        this._queue = this._queue.filter(function(item) { return !conditionFn(item); });
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

function timedExec(actionGenerator, interval) {
    var interval = window.setInterval(function(){
        try {
            actionGenerator.next().call();
        } catch(e if e == StopIteration) {
            window.clearInterval(interval);
        } catch(e) {
            window.clearInterval(interval);
            throw e;
        }
    }, interval);
}

function asDOM(object) {
    var parser = Cc['@mozilla.org/xmlextras/domparser;1']
        .getService(Ci.nsIDOMParser);

    asDOM = function(object) {
        if(object instanceof Ci.nsIDOMElement)
            return object;

        var element;
        switch(typeof(object)) {
        case 'xml':
            element = parser
                .parseFromString(object.toXMLString(), 'text/xml')
                .documentElement;
            break;
        case 'string':
            element = parser
                .parseFromString(object, 'text/xml')
                .documentElement;
            break;
        default:
            throw new Error('Argument error. (' + typeof(object) + ')');
        }
        
        return element;
    };

    return asDOM(object);
}

function findInsertionPoint(xulNodeList, criteriaFunc) {
    if(xulNodeList.length == 0)
        return null;

    for(var i=0, l=xulNodeList.length-1; i<l; i++) {
        var left = xulNodeList[i], right = xulNodeList[i+1];
        switch(criteriaFunc(left, right)) {
        case 0:
            return right;
            break;
        case 1:
            if(i == l-2)
                return null;
            break;
        case -1:
            if(i == 0)
                return left;
            break;
        default:
            throw new Error('Unhandled result. (' +
                            criteriaFunc(left, right) +
                            ')');
        }
    }
}

var insertionStrategies = {};

insertionStrategies['activity'] = function(activity) {
    return function(xulContact1, xulContact2) {
        if(activity > xulContact1.getAttribute('activity'))
            return -1;
        else if(activity < xulContact2.getAttribute('activity'))
            return 1;
        else
            return 0;
    }
}

insertionStrategies['display-name'] = function(name) {
    return function(xulContact1, xulContact2) {
        if(name < xulContact1.getAttribute('display-name'))
            return -1;
        else if(name > xulContact2.getAttribute('display-name'))
            return 1;
        else
            return 0;
    }
}

function setClass(xulElement, aClass, state) {
    if(state)
        addClass(xulElement, aClass);
    else
        removeClass(xulElement, aClass);
}

function toggleClass(xulElement, aClass) {
    if(hasClass(xulElement, aClass))
        removeClass(xulElement, aClass);
    else
        addClass(xulElement, aClass);
}

function hasClass(xulElement, aClass) {
    return xulElement.getAttribute('class').split(/\s+/).indexOf(aClass) != -1;
}

function addClass(xulElement, newClass) {
    var classes = xulElement.getAttribute('class').split(/\s+/);
    if(classes.indexOf(newClass) == -1)
        xulElement.setAttribute('class', classes.concat(newClass).join(' '));
}

function removeClass(xulElement, oldClass) {
    var classes = xulElement.getAttribute('class').split(/\s+/);
    var oldClassIndex = classes.indexOf(oldClass);
    if(oldClassIndex != -1) {
        classes.splice(oldClassIndex, 1);
        xulElement.setAttribute('class', classes.join(' '));
    }
}

function toggle(object, property, limit, afterAction) {
    if(object[property] == 0)
        animate(object, property, 6, limit, afterAction);
    else
        animate(object, property, 6, 0, afterAction);
}

function animate(object, property, steps, target, action) {
    if(object.__animating)
        return;
    object.__animating = true;

    var increment = (target - object[property])/steps;

    function step() {
        var currentValue = parseInt(object[property]);
        if(Math.abs(increment) >= Math.abs(currentValue - target)) {
            object[property] = target;
            if(typeof(action) == 'function')
                action();
            delete object.__animating;
        } else {
            object[property] = currentValue + increment;
            window.setTimeout(function() { step(); }, 30);
        }
    }

    step();
}

// got (and slightly simplified) from rubyonrails

function timeDistanceInWords(from, to) {
    function within(value, start, end) {
        return value >= start && value <= end;
    }
    
    minutes = Math.round(Math.abs(to/1000 - from/1000)/60);

    if(minutes <= 1)
        return 'less than a minute';
    else if(within(minutes, 2, 44))
        return minutes + ' minutes';
    else if(within(minutes, 45, 89))
        return 'about 1 hour';
    else if(within(minutes, 90, 1439))
        return 'about ' + Math.round(minutes / 60) + ' hours';
    else if(within(minutes, 1440, 2879))
        return '1 day';
    else if(within(minutes, 2880, 42199))
        return Math.round(minutes / 1440) + ' days';
    else if(within(minutes, 43200, 86399))
        return 'about 1 month';
    else if(within(minutes, 86400, 525599))
        return Math.round(minutes / 43200) + ' months';
    else if(within(minutes, 525600, 1051199))
        return 'about 1 year';
    else
        return 'over ' + Math.round(minutes / 525600) + ' years';
}

function stampToDate(stamp) {
    // XXX not compliant with XEP-0082 datetime profile, will assume UTC

    var [_, year, month, day, hours, minutes, seconds, milliseconds, zone] = 
        stamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.?\d{3})?(Z)?$/);

    return Date.UTC(year, month-1, day, hours, minutes, seconds, milliseconds || 0);
}

function timeAgoInWords(date) {
    return timeDistanceInWords(date, new Date());
}

function processURLs(xmlMessageBody) {
    var regexp = /(https?:\/\/|xmpp:|www\.)[^ \t\n\f\r"<>|()]*[^ \t\n\f\r"<>|,.!?(){}]/g;

    return xml.mapTextNodes(xmlMessageBody, function(textNode) {
        return text.mapMatch(
            textNode.toString(), regexp, function(url, protocol) {
                switch(protocol) {
                case 'http://':
                case 'https://':
                case 'xmpp:':
                    return <label crop="end" class="text-link" link={url} value={url}/>
                    break;
                default:
                    return <label crop="end" class="text-link" link={'http://' + url} value={url}/>
                }
            });
    });
}


// NETWORK ACTIONS
// ----------------------------------------------------------------------

function registerToService(account, address, callbacks) {
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

function changeStatusMessage(message) {
    XMPP.accounts.filter(XMPP.isUp).forEach(function(account) {
        var stanza = XMPP.cache
            .all(XMPP.q().event('presence')
                 .account(account.jid)
                 .direction('out'))
            .filter(function(presence) {
                return presence.stanza.ns_muc::x == undefined;
            })[0].stanza.copy();
        
        if(message)
            stanza.status = message;
        else
            delete stanza.status;
        
        XMPP.send(account, stanza);
    });
}

function removeContact(account, address) {
    XMPP.send(account,
              <iq type="set"><query xmlns={ns_roster}>
              <item jid={address} subscription="remove"/>
              </query></iq>);
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

function joinSupportRoom() {
    window.openDialog('chrome://sameplace/content/join_room.xul',
                      'sameplace-open-conversation', 'centerscreen',
                      null, 'users@places.sameplace.cc');
}

function viewHelp() {
    openURL('http://help.sameplace.cc', true);    
}

function requestRoster(account) {
    XMPP.send(account,
              <iq type='get'>
              <query xmlns={ns_roster}/>
              <cache-control xmlns={ns_x4m_in}/>
              </iq>);
}

function requestVCard(account, address, action) {
    XMPP.send(account, 
              <iq to={address} type='get'>
              <vCard xmlns='vcard-temp'/>
              <cache-control xmlns={ns_x4m_in}/>
              </iq>,
              action);
}

function addContact(account, address, subscribe) {
    XMPP.send(account,
              <iq type='set'>
              <query xmlns='jabber:iq:roster'>
              <item jid={address}/>
              </query></iq>);

    if(subscribe)
        XMPP.send(account, <presence to={address} type="subscribe"/>);
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function sentPresence(presence) {
    var status = presence.stanza.status.toString();
    if(status) {
        $('#status-message').value = status;
        removeClass($('#status-message'), 'draft');
    } else {
        $('#status-message').value = $('#status-message').getAttribute('placeholder');
        addClass($('#status-message'), 'draft');
    }
}

function receivedRoomSubject(message) {
    var xulContact = getContact(message.account, message.stanza.@from);
    if(!xulContact) // XXX issue warning here
        return;

    $(xulContact, '.status').replaceChild(
        textToXULDesc(message.stanza.subject.text()),
        $(xulContact, '.status').firstChild);
}

function receivedSubscriptionRequest(presence) {
    subscriptionAccumulator.receive(presence);
}

function sentSubscriptionConfirmation(presence) {
    subscriptionAccumulator.deleteIf(function(p) {
        return (p.account == presence.account &&
                p.stanza.@from == presence.stanza.@to);
    });
}

function receivedSubscriptionRequestSequence(sequence) {
    var xulNotify = $('#notify');
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
                    if(getContact(account, address) == undefined ||
                       getContact(account, address).getAttribute('subscription') == 'none' ||
                       getContact(account, address).getAttribute('subscription') == 'from') {
                        // contact not yet in our contact list, request
                        // auth to make things even ;-)
                        XMPP.send(account, <presence to={address} type="subscribe"/>);
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

function receivedRoster(iq) {
    for each(var item in iq.stanza..ns_roster::item) {
        contactChangedRelationship(
            iq.account,
            item.@jid,
            item.@subscription,
                item.@name);
    }
    contactsUpdated();

/*
    var makeUpdateActions = function() {
        for each(var item in iq.stanza..ns_roster::item) {
            yield function() { updateContact(iq.account, item.@jid); }
        }
    }

    if(!simulation)
        timedExec(makeUpdateActions(), 500);
*/
}

function receivedRoomPresence(presence) {
    var account = presence.account;
    var address = XMPP.JID(presence.stanza.@from).address;
    var xulContact = getContact(account, address);
    if(!xulContact) {
        xulContact = createContact(account, address);
        var displayName = address;
        $(xulContact, '.name').setAttribute('value', displayName);
        $(xulContact, '.small-name').setAttribute('value', displayName);
        xulContact.setAttribute('display-name', displayName.toLowerCase());
        addClass(xulContact, 'groupchat');
    } 

    xulContact.setAttribute('availability',
                            (XMPP.presencesOf(account, address).length > 0) ?
                            'available' : 'unavailable');
    placeContact(xulContact);
}

function receivedContactPresence(presence) {
    var account = presence.account;
    var address = XMPP.JID(presence.stanza.@from).address;
    var xulContact = getContact(account, address);

    if(!xulContact) // contact not in roster
        return;

    // XXX grab most relevant presence. '|| presence' needed because
    // presences form transport seem to not get cached. investigate!
    presence = XMPP.presencesOf(account, address)[0] || presence;

    var availability = presence.stanza.@type.toString() || 'available';
    var show         = presence.stanza.show.toString();
    var status       = presence.stanza.status.text();
    var nickname     = undefined;
    // XXX don't support MSN nicks until special formatting is supported
    // nickname = presence.stanza..ns_vcard_update::nickname.toString();

    if(xulContact.getAttribute('status')       == status &&
       xulContact.getAttribute('show')         == show &&
       xulContact.getAttribute('availability') == availability &&
       $(xulContact, '.name').value            == nickname)
        // Guard against mere re-assertions of status.  Google sends
        // these out a lot...
        return;

    xulContact.setAttribute('availability', availability);
    xulContact.setAttribute('show', show);
    xulContact.setAttribute('status', status);

    if(nickname) {
        $(xulContact, '.name').value = nickname;
        xulContact.setAttribute('display-name', nickname.toLowerCase());
    }

    $(xulContact, '.status').replaceChild(
        textToXULDesc(presence.stanza.status.text()),
        $(xulContact, '.status').firstChild);
    
    var ns_delay = 'urn:xmpp:delay'; // XXX overrides ns_delay from namespaces.sj
    if(presence.stanza.ns_delay::delay != undefined) {
        var date = stampToDate(presence.stanza.ns_delay::delay.@stamp);
        $(xulContact, '.delay').textContent = timeAgoInWords(date) + ' ago';
        xulContact.setAttribute('activity', date);
    } else {
        xulContact.setAttribute('activity', (new Date()).getTime());
    }

    if(presence.stanza.@type == 'unavailable')
        xulContact.setAttribute('chatstate', '');

    placeContact(xulContact);

    var photoHash = presence.stanza
        .ns_vcard_update::x
        .ns_vcard_update::photo
        .text();

    if(photoHash != undefined &&
       photoHash != $(xulContact, '.avatar').getAttribute('photo-hash')) {
        // XXX presently will always fetch from cache
        $(xulContact, '.avatar').setAttribute('photo-hash', photoHash);
        requestVCard(account, address, function(iq) {
            updateContactPhoto(account, address, iq.stanza..ns_vcard::PHOTO);
        });
    }
}

function receivedVCard(iq) {
    var photo = iq.stanza..ns_vcard::PHOTO;
    if(photo == undefined)
        return;

    var xulContact = getContact(iq.account, XMPP.JID(iq.stanza.@from).address);
    var data = 'data:' + photo.ns_vcard::TYPE + ';base64,' +
        photo.ns_vcard::BINVAL; //XXX support extval
    $(xulContact, '.avatar').setAttribute('src', data);

}

function contactChangedRelationship(account, address, subscription, name) {
    var xulContact = getContact(account, address) || createContact(account, address);

    if(subscription == 'remove') {
        $('#contacts').removeChild(xulContact);
        return;
    } else {
        xulContact.setAttribute('subscription', subscription);
    }

    var displayName = (name != undefined && name != '') ?
        name : (XMPP.JID(address).username || address);

    $(xulContact, '.name').setAttribute('value', displayName);
    $(xulContact, '.small-name').setAttribute('value', displayName);
    xulContact.setAttribute('display-name', displayName.toLowerCase());

    placeContact(xulContact);
}


// OTHER ACTIONS
// ----------------------------------------------------------------------

function getScriptlets() {
    return top.sameplace.scriptlets;
}


// DEVELOPER UTILITIES
// ----------------------------------------------------------------------

function populateListFake() {
    contactChangedRelationship(
        'bard@sameplace.cc/SamePlace', 'mary@gmail.com', 'both', 'Mary');
    contactChangedRelationship(
        'bard@sameplace.cc/SamePlace', 'patrick@sameplace.cc', 'both', 'Patrick');
    contactChangedRelationship(
        'bard@sameplace.cc/SamePlace', 'dana@sameplace.cc', 'both', '');
    contactChangedRelationship(
        'bard@sameplace.cc/SamePlace', 'sam@sameplace.cc', 'both', 'Sam');
    contactChangedRelationship(
        'bard@sameplace.cc/SamePlace', 'james@sameplace.cc', 'both', 'James');
    contactChangedRelationship(
        'bard@sameplace.cc/SamePlace', 'wally@gmail.com', 'both', 'Wally');
    contactChangedRelationship(
        'bard@sameplace.cc/SamePlace', 'benjamin@jabber.org', 'both', 'Benjaminus');
    contactChangedRelationship(
        'bard@sameplace.cc/SamePlace', 'jenny@sameplace.cc', 'both', 'Jenny');
    contactChangedRelationship(
        'bard@sameplace.cc/SamePlace', 'daniel@gmail.com', 'both', 'Daniel');
    contactChangedRelationship(
        'bard@sameplace.cc/SamePlace', 'sara@sameplace.cc', 'both', 'Sara');
    contactChangedRelationship(
        'bard@sameplace.cc/SamePlace', 'betty@sameplace.cc', 'both', 'Betty');

    setTimeout(function(){
    receivedContactPresence({
        event: 'presence',
        account: 'bard@sameplace.cc/SamePlace',
        direction: 'in',
        stanza: <presence from='betty@sameplace.cc/SamePlace'>
            <show>away</show>
            <status>yawn</status>
            </presence>
    });
    },3000)

    setTimeout(function(){
    receivedContactPresence({
        event: 'presence',
        account: 'bard@sameplace.cc/SamePlace',
        direction: 'in',
        stanza: <presence from='mary@gmail.com/SamePlace'>
            <status>teaching my cat to program in javascript and xul.  this is taking way less than it took to teach my boyfriend!</status>
            </presence>
    });
    },5000)

    receivedContactPresence({
        event: 'presence',
        account: 'bard@sameplace.cc/SamePlace',
        direction: 'in',
        stanza: <presence from='mary@gmail.com/SamePlace'>
            <status>teaching my cat to program in javascript and xul.  this is taking way less than it took to teach my boyfriend!</status>
            </presence>
    });

    receivedContactPresence({
        event: 'presence',
        account: 'bard@sameplace.cc/SamePlace',
        direction: 'in',
        stanza: <presence from='patrick@sameplace.cc/SamePlace'>
            <show>dnd</show>
            <status>Available</status>
            </presence>
    });

    receivedContactPresence({
        event: 'presence',
        account: 'bard@sameplace.cc/SamePlace',
        direction: 'in',
        stanza: <presence from='dana@sameplace.cc/SamePlace'>
            <status>in a meeting</status>
            </presence>
    });

    receivedContactPresence({
        event: 'presence',
        account: 'bard@sameplace.cc/SamePlace',
        direction: 'in',
        stanza: <presence from="james@sameplace.cc/SamePlace">
            <status>taking photos</status>
            <show>away</show>
            </presence>
    });

    receivedContactPresence({
        event: 'presence',
        account: 'bard@sameplace.cc/SamePlace',
        direction: 'in',
        stanza: <presence from="wally@gmail.com/SamePlace">
            <status>Zzzzz...</status>
            </presence>
    });

    receivedContactPresence({
        event: 'presence',
        account: 'bard@sameplace.cc/SamePlace',
        direction: 'in',
        stanza: <presence from="benjamin@jabber.org/SamePlace">
            <status>Uhm...</status>
            </presence>
    });

    receivedContactPresence({
        event: 'presence',
        account: 'bard@sameplace.cc/SamePlace',
        direction: 'in',
        stanza: <presence from='jenny@sameplace.cc/SamePlace'>
            <status>listening to ella fitzgerald</status>
            </presence>
    });

    receivedContactPresence({
        event: 'presence',
        account: 'bard@sameplace.cc/SamePlace',
        direction: 'in',
        stanza: <presence from='daniel@gmail.com./SamePlace'>
            <status>coding, coding, coding...</status>
            </presence>
    });

    receivedContactPresence({
        event: 'presence',
        account: 'bard@sameplace.cc/SamePlace',
        direction: 'in',
        stanza: <presence from='sara@sameplace.cc/SamePlace'>
            <status>chilling</status>
            </presence>
    });

    receivedContactPresence({
        event: 'presence',
        account: 'bard@sameplace.cc/SamePlace',
        direction: 'in',
        stanza: <presence from='sam@sameplace.cc/SamePlace'>
            <status>omg! is this real? http://youtube.com/watch?v=4CpmCbBquUI</status>
            </presence>
    });

    receivedContactPresence({
        event: 'presence',
        account: 'bard@sameplace.cc/SamePlace',
        direction: 'in',
        stanza: <presence from='room@places.sameplace.cc/Bob'>
            <x xmlns={ns_muc_user}/>
            <show>away</show>
            </presence>
    });

    window.setTimeout(function() {
        $('.control.offline-notice').hidden = true;
    }, 1000);
}





// Ensures that "action" is executed just once within a certain "wait"
// period (0.5s if not given), even if more calls to the same action
// are done in rapid succession.  Actions are compared by reference,
// so ideally they should be named functions in the top level.  (Two
// anonymous functions will be different objects even if they contain
// the same code.)

function singleExec(action, wait) {

    // Checker wakes up every tenth of a second and sees if any
    // action's waiting period has expired.  (This means that real
    // wait period for an action ranges between wait and wait+0.1s).
    //
    // Checker will happily keep track of multiple actions, but if
    // many actions are going to be executed in the same go, and first
    // one throws an error, subsequent ones won't be executed.
    //
    // XXX A periodic interval timer isn't probably the best way to do
    // this.  Try instead a simple timeout that clears itself upon
    // incoming actions.

    function startChecker() {
        var interval = window.setInterval(function() {
            try {
                var now = new Date();
                pending = pending.filter(function(action) {
                    if(now - action.__last_invocation < action.__expire)
                        return true;
                    else {
                        action.call();
                        return false;
                    }
                });

                if(pending.length == 0)
                    window.clearInterval(interval);
            } catch(e) {
                window.clearInterval(interval);
                throw e;
            }
        }, 250);
    }

    // Redefine function on the fly, to carry some state but keep it
    // hidden from external context.

    var pending = [];
    singleExec = function(action, wait) {
        wait = wait || 200;
        action.__last_invocation = new Date();
        action.__expire = wait;

        if(pending.length == 0)
            startChecker();
            
        var pos = pending.indexOf(action);
        if(pos == -1)
            pending.push(action)
        else
            pending[pos] = action;
    };

    singleExec(action, wait);
}
