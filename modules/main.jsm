// DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
    .getService(Ci.mozIJSSubScriptLoader);
var srvIdle = Cc["@mozilla.org/widget/idleservice;1"]
    .getService(Ci.nsIIdleService); // https://developer.mozilla.org/en/nsIIdleService
var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('xmpp.account.');
var ns_x4m = 'http://hyperstruct.net/xmpp4moz/protocol/internal';

if(typeof(JSON) == "undefined") {
    Components.utils.import("resource://gre/modules/JSON.jsm");
    JSON.parse = JSON.fromString;
    JSON.stringify = JSON.toString;
}

// STATE
// ----------------------------------------------------------------------

// A system-wide channel
var channel;
var initialized = false;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    if(initialized)
        return;
    initialized = true;

    loader.loadSubScript('chrome://xmpp4moz/content/xmpp.js');

    channel = XMPP.createChannel();

    channel.on({
        // TODO for some reason, this does not <presence
        // type="unavailable"/> when sythesized, only when sent to the
        // network, which at the moment means "only when user
        // disconnects account explicitly".  This does what we want,
        // but it's not future-proof: if we decide that xmpp4moz will
        // need to behave nicely and send a <presence
        // type="unavailable"/> before closing the stream, we will
        // always record that, thus breaking the restore-presence
        // functionality.

        event     : 'presence',
        direction : 'out',
        stanza    : function(s) {
            return ((s.@type == undefined || s.@type == 'unavailable') &&
                    (s.@to == undefined));
        }
    }, function(presence) {
        changedPresence(presence);
    });

    restoreOnlineState();
}


// REACTIONS
// ----------------------------------------------------------------------

function changedPresence(presence) {
    var account = XMPP.getAccountByJid(presence.account);
    var stanza = presence.stanza.copy();
    delete stanza.@id;
    delete stanza.ns_x4m::meta;

    var history = JSON.parse(account.presenceHistory || '[]');
    if(history.length >= 5)
        history.splice(0, 4);

    history.push(stanza.toXMLString());
    pref.setCharPref(account.key + '.presenceHistory', JSON.stringify(history));
}


// ACTIONS
// ----------------------------------------------------------------------

function restoreOnlineState() {
    function startUserSession(account, initialPresenceStanza) {
        XMPP.send(account,
                  <iq type='get'>
                  <query xmlns='jabber:iq:roster'/>
                  </iq>,
                  function() { XMPP.send(account, initialPresenceStanza); });
    }

    XMPP.accounts
        .filter(function(account) account.presenceHistory)
        .forEach(function(account) {
            var history = JSON.parse(account.presenceHistory);

            var lastPresenceStanza = new XML(history[history.length-1]);
            if(lastPresenceStanza.@type == 'unavailable')
                return;

            XMPP.up(account, function() {
                if(XMPP.connectorTypeFor(account.jid) == 'tcp')
                    startUserSession(account, lastPresenceStanza);
                else
                    // Play it safe, do not restore state in case of
                    // non-XMPP+TCP accounts for now.
                    startUserSession(account, <presence/>);
            });
        });
}


// EXPORTS
// ----------------------------------------------------------------------

var EXPORTED_SYMBOLS = ["sameplaceSrv"];

var sameplaceSrv = {
    init: init
};
