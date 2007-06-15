// This is a sample scriptlet that you can use as starting point for
// your own. 

// To test it as-is, customize the "myContact" variable, save, and
// reload.  When the contact changes status, an alert will pop up.


// Scriptlet metadata.  Only name, description and version are
// strictly necessary.

var info = {
    name        : 'Sample scriptlet',
    description : 'Insert description here.',
    version     : '1.0.0',
    author      : 'John Doe <john [at] doe [dot] com>',
    license     : 'GPL2',
    home        : 'http://my.site.com/my_scriptlet.js',
};


// You can keep state or configuration data in "global" variables,
// since they are actually local to the scriptlet.

var myContact = 'contact@server.org'; 


// If you are going to listen to XMPP events, you'll need a channel.
// (But it will be initialized later, not here.)

var channel;


// This is called every time the scriptlet is started.  It should most
// likely create a channel to listen for events and wire it to event
// handlers.

function init() {
    channel = XMPP.createChannel();

    channel.on({
        event     : 'presence',
        direction : 'in',
        stanza    : function(s) {
                return XMPP.JID(s.@from).address == myContact;
            }},
        function(presence) { detectedContact(presence); });
}


// This is called when the scriptlet is stopped.  It should release
// any resource that was created in init() or during the lifecycle of
// the scriptlet.

function finish() {
    channel.release();
}


// Below, add whatever the scriptlet needs to perform its task.

function detectedContact(presence) {
    if(presence.stanza.@type == 'unavailable')
        alert(myContact + ' has gone offline!');
    else
        alert(myContact + ' changed status');
}