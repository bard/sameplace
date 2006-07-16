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

function xmppSelectedAccount(accountJid) {
    request.account = accountJid;
}