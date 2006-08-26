// GLOBAL STATE
// ----------------------------------------------------------------------

var request;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    request = window.arguments[0];
    refresh();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function doOk() {
    request.contactAddress = _('address').value;
    request.subscribeToPresence = _('subscribe').checked;
    request.account = _('accounts').value;
    request.confirm = true;
    return true;
}

function doCancel() {
    return true;
}


// GUI UTILITIES (GENERIC)
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById(id);
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function refresh() {
    if(_('accounts').value && _('address').value)
        _('main').getButton('accept').disabled = false;
    else
        _('main').getButton('accept').disabled = true;
}


// HOOKS
// ----------------------------------------------------------------------

function xmppLoadedAccounts() {
    for each(var account in XMPP.accounts) {
        if(XMPP.isUp(account.jid)) {
            selectedAccount();
            _('accounts').value = account.jid;
            break;
        }
    }
}