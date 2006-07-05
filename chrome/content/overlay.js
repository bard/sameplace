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