// DEFINITIONS
// ----------------------------------------------------------------------

var srvIdle = Cc['@mozilla.org/widget/idleservice;1']
    .getService(Ci.nsIIdleService);
var srvPref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.services.idle.')
    .QueryInterface(Ci.nsIPrefBranch2);

Cu.import('resource://xmpp4moz/namespaces.jsm');
Cu.import('resource://xmpp4moz/log.jsm');

// STATE
// ----------------------------------------------------------------------

var idleTimeout;
var log = Log.getSource('sameplace-services-idle');


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    var self = this;

    srvPref.addObserver('timeout', {
        observe: function(subject, topic, data) {
            srvIdle.removeIdleObserver(self, idleTimeout);
            idleTimeout = srvPref.getIntPref('timeout');
            srvIdle.addIdleObserver(self, idleTimeout);
        }
    }, false);

    idleTimeout = srvPref.getIntPref('timeout')
    srvIdle.addIdleObserver(this, idleTimeout);
}


// FINALIZATION
// ----------------------------------------------------------------------

function finish() {
    srvIdle.removeIdleObserver(this, idleTimeout);
}


// CALLBACKS
// ----------------------------------------------------------------------

function observe(subject, topic, data) {
    XMPP.accounts
        .filter(function(account) XMPP.isUp(account))
        .forEach(function(account) {
            // Bail out early if this is a non-XMPP/non-TCP account,
            // we don't want to set status automatically on things like Twitter.
            if(XMPP.connectorTypeFor(account.jid) != 'tcp')
                return;

            var currentPresence = XMPP.cache.first(
                XMPP.q()
                    .event('presence')
                    .account(account.jid)
                    .direction('out')
                    .xpath('[not(@to)]'));

            if(!currentPresence)
                // We probably haven't "announced" ourselves to our
                // contacts in the first place, so no point in
                // announcing that we are now away.
                return;

            var newPresenceStanza;
            switch(topic) {
            case 'idle':
                if(currentPresence.stanza.show == 'away' ||
                   currentPresence.stanza.show == 'xa') {
                    log.send({debug: 'idle timeout fired but presence already on away, not touching'});
                } else {
                    newPresenceStanza = currentPresence.stanza.copy();
                    newPresenceStanza.show = 'away';
                    newPresenceStanza.status = 'Auto status (idle)'; // XXX make configurable
                    newPresenceStanza.idleset = <idleset xmlns={ns_x4m_in}/>;

                    log.send({debug: 'autosetting away state based on previous presence', data: newPresenceStanza});
                }
                break;
            case 'back':
                var history = JSON.parse(account.presenceHistory);
                var previousPresenceStanza =  new XML(history[history.length-1]);
                if(previousPresenceStanza.ns_x4m_in::idleset == undefined) {
                    log.send({debug: 'user is back but previous presence stanza was not set by us, so we do not touch it'});
                } else {
                    newPresenceStanza = new XML(history[history.length-2]);
                    log.send({debug: 'user is back, restoring previous presence', data: newPresenceStanza});
                }

                break;
            }

            if(newPresenceStanza)
                XMPP.send(account, newPresenceStanza);
        });
}

