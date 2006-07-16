// ----------------------------------------------------------------------
// GLOBAL STATE

var request;

// ----------------------------------------------------------------------
// INITIALIZATION

function init() {
    request = window.arguments[0];
}

// ----------------------------------------------------------------------
// GUI ACTIONS

function doOk() {
    request.roomAddress = _('address').value;
    request.roomNick = _('nick').value;
    request.confirm = true;
    request.account = _('accounts').value;
    return true;
}

function doCancel() {
    return true;
}

// ----------------------------------------------------------------------
// UTILITIES

function _(id) {
    return document.getElementById(id);
}

// ----------------------------------------------------------------------
// HOOKS

function xmppLoadedAccounts() {
    for each(var account in XMPP.accounts) {
        if(XMPP.isUp(account.jid)) {
            _('accounts').value = account.jid;
            break;
        }
    }
}