// EXPORTS
// ----------------------------------------------------------------------

var EXPORTED_SYMBOLS = ['sameplace'];


// DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
    .getService(Ci.mozIJSSubScriptLoader);
var srvObserver = Cc['@mozilla.org/observer-service;1']
    .getService(Ci.nsIObserverService);

var prefServices = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.services.');

Cu.import('resource://xmpp4moz/xmpp.jsm');
Cu.import('resource://xmpp4moz/json.jsm');
Cu.import('resource://xmpp4moz/namespaces.jsm');
Cu.import('resource://xmpp4moz/log.jsm');


// STATE
// ----------------------------------------------------------------------

var channel;
var services = {};


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    channel = XMPP.createChannel();

    loadServices();
    restoreOnlineState();

    srvObserver.addObserver(
        { observe: function(subject, topic, data) { finish(); }},
        'quit-application',
        false);
}

function finish() {
    for(var serviceName in services) {
        if(typeof(services[serviceName].finish) == 'function') {
            try {
                services[serviceName].finish();
            } catch(e) {
                dump('Error while stopping service "' + serviceName + '":\n' +
                     e + '\n' +
                     (e.stack ? e.stack + '\n' : ''));
            }
        }
    }
    channel.release();
}


// ACTIONS
// ----------------------------------------------------------------------

function loadServices() {
    for each(let keyName in prefServices.getChildList('', {})) {
        let [serviceName, subProperty] = keyName.split('.');
        if(subProperty != 'src')
            continue;

        try {
            let service = {};
            loader.loadSubScript(prefServices.getCharPref(keyName), service);
            service.init();
            services[serviceName] = service;
        } catch(e) {
            Cu.reportError(e + ' (' + e.fileName + ', line ' + e.lineNumber + ')');
        }
    }
}


// ACTIONS
// ----------------------------------------------------------------------

// To be called at startup.  Brings up accounts that were online last
// time the application was closed.

function restoreOnlineState() {
    XMPP.accounts
        .forEach(function(account) {
            var history = JSON.parse(account.presenceHistory || '[]');

            var lastPresenceStanza = new XML(history[history.length-1]);
            if(lastPresenceStanza.@type != 'unavailable')
                XMPP.up(account);
        });
}


// KICKSTART
// ----------------------------------------------------------------------

var sameplace = {
    services: services
};

init();
