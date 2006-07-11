var params;

function init() {
    params = window.arguments[0];
}

function doOk() {
    params.contactId = _('contact').value;
    params.isRoom = _('room').checked;
    params.roomNick = _('nick').value;
    params.confirm = true;
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