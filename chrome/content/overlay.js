
Components
.classes['@mozilla.org/moz/jssubscript-loader;1']
.getService(Components.interfaces.mozIJSSubScriptLoader)
.loadSubScript('chrome://mozeskine/content/xmpp4moz/xmpp.js');

var xmppChannel = XMPP.createChannel();
xmppChannel.on(
    { event: 'message', direction: 'in', stanza: function(s) { return s.body && s.body.toString(); }},
    function(message) {
        document
            .getElementById('xmpp-last-message')
            .value = message.stanza.@from + ': ' + message.stanza.body;
    });

function xmppToggleSidebar() {
    var sidebar = document.getElementById('xmpp-sidebar');
    var splitter = document.getElementById('xmpp-splitter');

    if(sidebar.collapsed) {
        sidebar.collapsed = false;
        splitter.hidden = false;
    } else {
        sidebar.collapsed = true;
        splitter.hidden = true;
    }
}

function xmppConnect() {
    var connectionParams = {
        userAddress: undefined,
        userPassword: undefined,
        userServerHost: undefined,
        userServerPort: undefined,
        confirm: false
    };
    window.openDialog(
        'chrome://mozeskine/content/connect.xul', 'connect',
        'chrome,modal,centerscreen', connectionParams);

    if(!connectionParams.confirm)
        return;

    userJid = connectionParams.userAddress + '/Mozilla';
        
    XMPP.up(
        userJid, { password: connectionParams.userPassword,
                server: connectionParams.userServerHost,
                port: connectionParams.userServerPort });
}

function xmppDisconnect() {
    XMPP.down(XMPP.activeSessionNames[0]);
}

function xmppDebug() {
    window.open('chrome://mozeskine/content/debug.xul', 'xmpp-debug', 'chrome,alwaysRaised');
}
