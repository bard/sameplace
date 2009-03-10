// DEFINITIONS
// ----------------------------------------------------------------------

var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.services.contacts.');


// STATE
// ----------------------------------------------------------------------

var counters;
var channel;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    try {
        counters = JSON.parse(pref.getCharPref('popularity'));
    } catch(e) {
        counters = {};
    }

    channel = XMPP.createChannel();

    channel.on({
        event     : 'message',
        direction : 'out',
        stanza    : function(s) {
            return (s.body != undefined ||
                    s.ns_xhtml_im::html.ns_xhtml::body != undefined);
        }
    }, function(m) { sentChatMessage(m); });
}


// FINALIZATION
// ----------------------------------------------------------------------

function finish() {
    channel.release();

    pref.setCharPref('popularity', JSON.stringify(counters));
}


// REACTIONS
// ----------------------------------------------------------------------

function sentChatMessage(m) {
    var address = XMPP.JID(m.stanza.@to).address;
    if(!(address in counters))
        counters[address] = 0;

    counters[address]++;
}


// API
// ----------------------------------------------------------------------

// TODO these should either work on account+address or name, not just
// address.  it's true that the same address identifies the same
// contact, but using just that would imply that the different
// addresses identify different contacts, and that's not necessarily
// true.  Using name would solve this (we assume that same name
// identifies same contact), however using account+address would allow
// us to track "preferred" concrete contacts for a given metacontact.

// However, what happens when account1+address is in the popular list,
// but other user logs in with just account2+address?  It should
// definitely be in the contact list...

function makeUnpopular(account, address) {
    counters[address] = false;
}

function makePopular(account, address) {
    counters[address] = true;
}

function isPopular(account, address) {
    var popularity = counters[address];
    return (popularity === true ||
            typeof(popularity) == 'number' && popularity > 50);
}