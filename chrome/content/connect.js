function _(id) {
    return document.getElementById(id);
}

function init() {
    var pref = Components
        .classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch);

    _('user-address').value     = pref.getCharPref('extensions.xmpp.userAddress');
    _('user-password').value    = pref.getCharPref('extensions.xmpp.userPassword');
    _('user-server-host').value = pref.getCharPref('extensions.xmpp.connectionServer');
    _('user-server-port').value = pref.getIntPref('extensions.xmpp.connectionPort');
    if(!_('user-server-host').value)
        updateUserServer(_('user-address-host').value);
}

function updateUserServer(userAddress) {
    var m = userAddress.match(/@(.+)$/);
    if(m) 
        _('user-server-host').value =
            (m[1] == 'gmail.com') ?
            'talk.google.com' :
             m[1];
}

function savePrefs() {
    var pref = Components
        .classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch);

    pref.setCharPref('extensions.xmpp.userAddress', _('user-address').value);
    pref.setCharPref('extensions.xmpp.connectionServer', _('user-server-host').value);
    pref.setIntPref('extensions.xmpp.connectionPort', _('user-server-port').value);
}

function doOk() {
    savePrefs();
    window.arguments[0].userAddress = _('user-address').value;
    window.arguments[0].userPassword = _('user-password').value;
    window.arguments[0].userServerHost = _('user-server-host').value;
    window.arguments[0].userServerPort = _('user-server-port').value;
    window.arguments[0].confirm = true;
    return true;
}

function doCancel() {
    return true;
}