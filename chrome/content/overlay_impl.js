// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;


// GUI UTILITIES (SPECIFIC)
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById('sameplace-' + id);
}


// INITIALIZATION
// ----------------------------------------------------------------------

function initOverlay(event) {
    channel = XMPP.createChannel();

    channel.on(
        {event: 'stream', direction: 'out', state: 'open'},
        function(stream) {
            if(window == Cc["@mozilla.org/appshell/window-mediator;1"]
               .getService(Ci.nsIWindowMediator)
               .getMostRecentWindow('navigator:browser'))
                loadSidebar();
        });

    var button = document.getElementById('xmpp-button');
    button.addEventListener(
        'command', function(event) {
            if(event.target == button)
                toggleSidebar();
        }, false);
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function loadSidebar(force) {
    var frame = _('sidebar').firstChild.contentWindow;

    if(force || frame.location.href != 'chrome://sameplace/content/sameplace.xul') 
        frame.location.href = 'chrome://sameplace/content/sameplace.xul';

    showSidebar();
}

function toggleSidebar() {
    if(_('sidebar').collapsed) {
        _('sidebar').collapsed = false;
        _('sidebar-splitter').hidden = false;
    } else {
        _('sidebar').collapsed = true;
        _('sidebar-splitter').hidden = true;
    }
}

function showSidebar() {
    _('sidebar').collapsed = false;
    _('sidebar-splitter').hidden = false;
}

function log(msg) {
    Cc[ "@mozilla.org/consoleservice;1" ]
        .getService(Ci.nsIConsoleService)
        .logStringMessage(msg);
}


