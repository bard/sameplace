
Components
.classes['@mozilla.org/moz/jssubscript-loader;1']
.getService(Components.interfaces.mozIJSSubScriptLoader)
.loadSubScript('chrome://mozeskine/content/xmpp4moz/xmpp.js');

var mozeskineChannel = XMPP.createChannel();
mozeskineChannel.on(
    { event: 'message', direction: 'in', stanza: function(s) { return s.body && s.body.toString(); }},
    function(message) {
        document
            .getElementById('mozeskine-last-message')
            .value = message.stanza.@from + ': ' + message.stanza.body;
    });

function mozeskineToggleSidebar() {
    var sidebar = document.getElementById('mozeskine-sidebar');
    var splitter = document.getElementById('mozeskine-splitter');

    if(sidebar.collapsed) {
        sidebar.collapsed = false;
        splitter.hidden = false;
    } else {
        sidebar.collapsed = true;
        splitter.hidden = true;
    }
}

function mozeskineConnect() {
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

    userJid = connectionParams.userAddress + '/Mozeskine';
        
    XMPP.up(
        userJid, { password: connectionParams.userPassword,
                server: connectionParams.userServerHost,
                port: connectionParams.userServerPort });
}

function mozeskineDisconnect() {
    XMPP.down(XMPP.activeSessionNames[0]);
}

function mozeskineDebug() {
    window.open('chrome://mozeskine/content/debug.xul', 'mozeskine-debug', 'chrome,alwaysRaised');
}
