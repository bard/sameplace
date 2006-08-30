
var mozeskine_xmppChannel = XMPP.createChannel();

mozeskine_xmppChannel.on(
    {event: 'stream', direction: 'out', state: 'open'},
    function(stream) { mozeskine_loadSidebar(); });

function mozeskine_loadSidebar(force) {
    var sidebar = document.getElementById('mozeskine-sidebar');
    var frame = sidebar.firstChild.contentWindow;

    if(force || frame.location.href != 'chrome://mozeskine/content/mozeskine.xul') 
        frame.location.href = 'chrome://mozeskine/content/mozeskine.xul';

    mozeskine_showSidebar();
}

function mozeskine_toggleSidebar() {
    var sidebar = document.getElementById('mozeskine-sidebar');
    var splitter = document.getElementById('mozeskine-sidebar-splitter');

    if(sidebar.collapsed) {
        sidebar.collapsed = false;
        splitter.hidden = false;
    } else {
        sidebar.collapsed = true;
        splitter.hidden = true;
    }
}

function mozeskine_showSidebar() {
    document.getElementById('mozeskine-sidebar').collapsed = false;
    document.getElementById('mozeskine-sidebar-splitter').hidden = false;
}
