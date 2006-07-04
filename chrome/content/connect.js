function _(id) {
    return document.getElementById(id);
}

function init() {
    var pref = Components
        .classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch);

    _('user-address').value  = pref.getCharPref('extensions.mozeskine.userAddress');
    _('user-password').value = pref.getCharPref('extensions.mozeskine.userPassword');
    _('room-address').value  = pref.getCharPref('extensions.mozeskine.roomAddress');
    _('room-nick').value     = pref.getCharPref('extensions.mozeskine.roomNick');
    _('user-server').value   = pref.getCharPref('extensions.mozeskine.connectionServer');
    if(!_('user-server').value)
        updateUserServer(_('user-address').value);
}

function updateUserServer(userAddress) {
    var m = userAddress.match(/@(.+)$/);
    if(m) 
        _('user-server').value =
            (m[1] == 'gmail.com') ?
            'talk.google.com' :
             m[1];
}

function savePrefs() {
    var pref = Components
        .classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch);

    pref.setCharPref('extensions.mozeskine.userAddress', _('user-address').value);
    pref.setCharPref('extensions.mozeskine.connectionServer', _('user-server').value);
    pref.setCharPref('extensions.mozeskine.roomAddress', _('room-address').value);
    pref.setCharPref('extensions.mozeskine.roomNick', _('room-nick').value);    
}

function doOk() {
    savePrefs();
    window.arguments[0].userAddress = _('user-address').value;
    window.arguments[0].userPassword = _('user-password').value;
    window.arguments[0].userServer = _('user-server').value;
    window.arguments[0].roomAddress = _('room-address').value;
    window.arguments[0].roomNick = _('room-nick').value;
    window.arguments[0].confirm = true;
    return true;
}

function doCancel() {
    return true;
}