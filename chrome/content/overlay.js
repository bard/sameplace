
var mozeskine_xmppChannel = XMPP.createChannel();

mozeskine_xmppChannel.on(
    {event: 'stream', direction: 'out'},
    function(stream) { mozeskine_loadLivebar(); });

function mozeskine_loadLivebar(force) {
    var livebar = document.getElementById('livebar');
    var frame = livebar.firstChild.contentWindow;

    if(force || frame.location.href != 'chrome://mozeskine/content/mozeskine.xul') 
        frame.location.href = 'chrome://mozeskine/content/mozeskine.xul';

    xmppShowLivebar();
}