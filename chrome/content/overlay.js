window.addEventListener(
    'load', function(event) {
        var button = document.getElementById('xmpp-button');

        button.addEventListener(
            'command', function(event) {
                if(event.target == button)
                    sameplace_toggleSidebar();
                }, false);
    }, false);

var sameplace_xmppChannel = XMPP.createChannel();

sameplace_xmppChannel.on(
    {event: 'stream', direction: 'out', state: 'open'},
    function(stream) {
        if(window == Components.classes["@mozilla.org/appshell/window-mediator;1"]
           .getService(Components.interfaces.nsIWindowMediator)
           .getMostRecentWindow('navigator:browser'))
            sameplace_loadSidebar();
    });

function sameplace_loadSidebar(force) {
    var sidebar = document.getElementById('sameplace-sidebar');
    var frame = sidebar.firstChild.contentWindow;

    if(force || frame.location.href != 'chrome://sameplace/content/sameplace.xul') 
        frame.location.href = 'chrome://sameplace/content/sameplace.xul';

    sameplace_showSidebar();
}

function sameplace_toggleSidebar() {
    var sidebar = document.getElementById('sameplace-sidebar');
    var splitter = document.getElementById('sameplace-sidebar-splitter');

    if(sidebar.collapsed) {
        sidebar.collapsed = false;
        splitter.hidden = false;
    } else {
        sidebar.collapsed = true;
        splitter.hidden = true;
    }
}

function sameplace_showSidebar() {
    document.getElementById('sameplace-sidebar').collapsed = false;
    document.getElementById('sameplace-sidebar-splitter').hidden = false;
}

function sameplace_log(msg) {
    Components
        .classes[ "@mozilla.org/consoleservice;1" ]
        .getService(Components.interfaces.nsIConsoleService)
        .logStringMessage(msg);
}

