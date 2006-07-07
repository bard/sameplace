
Components
.classes['@mozilla.org/moz/jssubscript-loader;1']
.getService(Components.interfaces.mozIJSSubScriptLoader)
.loadSubScript('chrome://mozeskine/content/xmpp4moz/xmpp.js');

var mozeskineObserver = {
    observe: function(subject, topic, data) {
        var message = new XML(data);
        document
        .getElementById('mozeskine-last-message')
        .value = message.@from + ': ' + message.body;
    }
};

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
    XMPP.down(XMPP.accounts[0]);
}

function mozeskineDebug() {
    window.open('chrome://mozeskine/content/debug.xul', 'mozeskine-debug', 'chrome,alwaysRaised');
}

window.addEventListener(
    'load', function() {
        Components
            .classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .addObserver(mozeskineObserver, 'im-incoming', false);
    }, false);

window.addEventListener(
    'unload', function() {
        Components
            .classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .removeObserver(mozeskineObserver, 'im-incoming');            
    }, false);