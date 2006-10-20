// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

var xmpp = xmpp || {};
xmpp.ui = xmpp.ui || {};


// GLOBAL STATE
// ----------------------------------------------------------------------

var request;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    request = window.arguments[0];

    for each(var fieldName in ['account', 'address', 'nick']) 
        _(fieldName).value = request[fieldName] || '';

    if(request.address)
        _('nick').focus();
    else
        _('address').select();

    refresh();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function doOk() {
    request.address = _('address').value;
    request.nick = _('nick').value;
    request.type = _('type').value;
    request.confirm = true;
    request.account = _('account').value;
    return true;
}

function doCancel() {
    return true;
}

function refresh() {
    _('nick').parentNode.hidden = (_('type').value != 'groupchat');

    if(_('account').value && _('address').value)
        if(_('type').value == 'groupchat' && _('nick').value)
            _('main').getButton('accept').disabled = false;
        else if(_('type').value == 'chat')
            _('main').getButton('accept').disabled = false;
        else
            _('main').getButton('accept').disabled = true;
    else
        _('main').getButton('accept').disabled = true;
}


// UTILITIES
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById(id);
}


// HOOKS
// ----------------------------------------------------------------------

xmpp.ui.loadedAccounts = function() {
    for each(var account in XMPP.accounts) {
        if(XMPP.isUp(account.jid)) {
            _('account').value = account.jid;
            break;
        }
    }
}