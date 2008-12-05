// DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
    .getService(Ci.mozIJSSubScriptLoader);
var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('xmpp.account.');
var ns_x4m = 'http://hyperstruct.net/xmpp4moz/protocol/internal';


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
    pref.setCharPref(account.key + '.lastPresence', stanza.toXMLString());;
}


// ACTIONS
// ----------------------------------------------------------------------

function restoreOnlineState(presence) {
    XMPP.accounts
        .filter(function(account) account.lastPresence)
        .forEach(function(account) {
            // TODO should ask connector whether to go online and
            // replicate last presence.  Will mess with e.g. twitter

            var stanza = new XML(account.lastPresence);
            if(stanza.@type == 'unavailable')
                return;

            XMPP.up(account, function() {
                XMPP.send(account, stanza);
            });
        });
}


// EXPORTS
// ----------------------------------------------------------------------

var EXPORTED_SYMBOLS = ["sameplaceSrv"];

var sameplaceSrv = {
    init: init
};
