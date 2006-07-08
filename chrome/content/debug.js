var channel;

function init() {
    channel = XMPP.createChannel();

    channel.on(
        {event: 'data'}, function(data) {
            display('\t' + data.session.name + '\n' +
                    data.direction +
                    '/DATA:\n' + data.content);
        });
}

function finish() {
    channel.release();
}

// ----------------------------------------------------------------------
// GUI UTILITIES

function _(id) {
    return document.getElementById(id);
}

function cloneBlueprint(name) {
    return document
        .getElementById('blueprints')
        .getElementsByAttribute('role', name)[0]
        .cloneNode(true);
}

// ----------------------------------------------------------------------
// GUI ACTIONS

function display(message) {
    var debugLine = cloneBlueprint('debug-line');
    debugLine.getElementsByAttribute('role', 'content')[0].textContent = message;
    
    _('jabber-debug').appendChild(debugLine);
    _('jabber-debug').ensureElementIsVisible(debugLine);
}