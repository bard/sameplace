// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;

const prefBranch = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');


// GLOBAL STATE
// ----------------------------------------------------------------------

var conversations;
var contacts;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

window.addEventListener(
    'load', function(event) { init(); }, false);

window.addEventListener(
    'unload', function(event) { finish(); }, false);

function init(event) {
    contacts = _('contacts').contentWindow;
    contacts.onRequestedCommunicate = requestedCommunicate;
}

function finish(event) {
    if(conversations)
        conversations.close();    
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function selectedAccount(event) {
    var accountJid = event.target.value;
    if(XMPP.isUp(accountJid))
        XMPP.down(accountJid);
    else
        XMPP.up(accountJid);
}

function withConversations(action) {
    if(conversations && !conversations.closed) 
        action(conversations);
    else {
        conversations = window.openDialog(
            'chrome://sameplace/content/standalone/conversations.xul',
            'SamePlace:Interactions', 'chrome,toolbar=no,centerscreen=yes');
        conversations.addEventListener(
            'load', function(event) {
                action(conversations);
            }, false);        
    }
}

function startedConversationWith() {
    contacts.startedConversationWith.apply(contacts, arguments);
}

function stoppedConversationWith() {
    contacts.stoppedConversationWith.apply(contacts, arguments);
}

function nowTalkingWith() {
    contacts.nowTalkingWith.apply(contacts, arguments);
}

function requestedCommunicate(account, address, url) {
    withConversations(
        function(conversations) {
            conversations.interactWith(
                account, address, url, 'main',
                function() {
                    conversations.conversations.focus(account, address);
                });
        });
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

function requestedClose() {
//    window.minimize();
//    return false;
    window.close();
}

function movedWndConversations() {
    attachTo(window, conversations);
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function quit() {
    window.close();
}

function moveToSideOf(otherWindow) {
    attachTo(window, otherWindow);
}


// GUI UTILITIES
// ----------------------------------------------------------------------

// rename to sth like putSideBySide
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

function _(id) {
    return document.getElementById(id);
}

function getDefaultAppUrl() {
    var url = prefBranch.getCharPref('defaultAppUrl');
    return isChromeUrl(url) ? chromeToFileUrl(url) : url;
}

/* Disable under Linux/GTK2 */

function hide() {
    window.moveTo(
        conversations.screenX + conversations.outerWidth -
        window.outerWidth,
        window.screenY);
}

