/*
 * Copyright 2006-2007 by Massimiliano Mirra
 * 
 * This file is part of SamePlace.
 * 
 * SamePlace is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 3 of the License, or (at your
 * option) any later version.
 * 
 * SamePlace is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * The interactive user interfaces in modified source and object code
 * versions of this program must display Appropriate Legal Notices, as
 * required under Section 5 of the GNU General Public License version 3.
 *
 * In accordance with Section 7(b) of the GNU General Public License
 * version 3, modified versions must display the "Powered by SamePlace"
 * logo to users in a legible manner and the GPLv3 text must be made
 * available to them.
 * 
 * Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
 *  
 */


// DEFINITIONS
// ----------------------------------------------------------------------

var Ci = Components.interfaces;
var Cc = Components.classes;

var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('xmpp.account.');


// STATE
// ----------------------------------------------------------------------

var channel;
var account;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init() {
    channel = XMPP.createChannel();
    if(!Cc['@hyperstruct.net/xmpp4moz/connector;1?type=twitter'])
        $('#services .service.twitter').style.display = 'none';
}

function finish() {
    channel.release();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

// JABBER PAGE

function updateJabberConfig(event) {
    if(event &&
       event.target.getAttribute('class') == 'connection-server' ||
       event.target.getAttribute('class') == 'connection-port')
        return;

    var page            = $('[pageid="jabber"]');
    var service         = page.getAttribute('service');
    var username        = $(page, '.username').value;
    var domain          = $(page, '.domain-' + service).value;
    var password        = $(page, '.password').value;
    var passwordConfirm = $(page, '.password-confirm').value;

    $(page, '.address').value =
        (username || '[username]') + // XXX localize
        '@' +
        (domain || '[domain]'); // XXX localize

    switch(service) {
    case 'gtalk':
        $(page, '.connection-port').value = 443;
        $(page, '.connection-server').value = 'talk.google.com';
        break;
    default:
        $(page, '.connection-server').value = domain;
        break;
    }

    $(page, '.password-confirm-label').setAttribute(
        'signal-error',
        (passwordConfirm.length == password.length &&
         passwordConfirm != password));

    $('#wizard').canAdvance = (domain &&
                               username &&
                               password &&
                               password == passwordConfirm);
}

// TRANSPORT PAGE

function updateTransportConfig() {
    var page            = $('[pageid="transport"]');
    var username        = $(page, '.username').value;
    var password        = $(page, '.password').value;
    var passwordConfirm = $(page, '.password-confirm').value;
    
    $(page, '.password-confirm-label').setAttribute(
        'signal-error',
        (passwordConfirm.length == password.length &&
         passwordConfirm != password));

    $('#wizard').canAdvance = (username &&
                               password &&
                               password == passwordConfirm);
}

// TURTLE PAGE

function updateTurtleConfig() {
    var page            = $('[pageid="turtle"]');
    var username        = $(page, '.username').value;
    var password        = $(page, '.password').value;
    var passwordConfirm = $(page, '.password-confirm').value;
    
    $(page, '.password-confirm-label').setAttribute(
        'signal-error',
        (passwordConfirm.length == password.length &&
         passwordConfirm != password));

    $('#wizard').canAdvance = (username &&
                               password &&
                               password == passwordConfirm);
}


// GUI REACTIONS
// ----------------------------------------------------------------------

// SELECTION PAGE

function shownPageSelection() {
    $('#wizard').canAdvance = false;
}

function hoveredService(xulService) {
    var classes = xulService.getAttribute('class').split(' ');
    var service = classes[classes.length - 1];
    $('#service-infos').selectedPanel = $('#service-info-' + service);
}

function selectedService(xulService) {
    var classes = xulService.getAttribute('class').split(' ');
    var requestedService = classes[classes.length - 1];

    var hasSameplaceAccount = true;
    switch(requestedService) {
    case 'gtalk':
    case 'jabber':
    case 'sameplace':
    case 'twitter':
        $('[pageid="selection"]').next = 'jabber';
        $('[pageid="jabber"]').setAttribute('service', requestedService);
        $('[pageid="jabber"]').next = 'finish';
        break;
    case 'msn':
    case 'aim':
        if(getSamePlaceAccount()) {
            $('[pageid="selection"]').next = 'transport';
            $('[pageid="transport"]').setAttribute('service', requestedService);
            $('[pageid="transport"]').next = 'finish';
        } else if(window.confirm(requestedService.toUpperCase() +
                                 ' connectivity is provided by SamePlace.cc.\n\n'+
                                 'Configure a @sameplace.cc account now?')) {
            $('[pageid="selection"]').next = 'jabber';
            $('[pageid="jabber"]').setAttribute('service', 'sameplace');
            $('[pageid="jabber"]').next = 'transport';
            $('[pageid="jabber"]').setAttribute('next-service', requestedService);
            $('[pageid="transport"]').setAttribute('prev-service', 'sameplace');
            $('[pageid="transport"]').setAttribute('service', requestedService);
            $('[pageid="transport"]').next = 'finish';
        } else
            return;
        break;
    }
    $('#wizard').canAdvance = true;
    $('#wizard').advance();
}

// JABBER PAGE

function shownPageJabber() {
    $('[pageid="jabber"]').setAttribute('state', 'configuring');
    updateJabberConfig();
}

function advancedPageJabber(page) {
    if(page.getAttribute('state') == 'verified')
        return true;

    account = {
        address            : ($(page, '.username').value +
                              '@' +
                              $(page, '.domain-' + page.getAttribute('service')).value),

        resource           : $(page, '.resource').value,

        password           : $(page, '.password').value,

        connectionHost     : $(page, '.connection-server').value,

        connectionPort     : $(page, '.connection-port').value,

        connectionSecurity : $(page, '.connection-security').value,
        
        autoLogin          : $(page, '.auto-login').checked,

        get jid() {
            return this.address + '/' + this.resource;
        }
    };

    page.setAttribute('state', 'verifying');
    $('#wizard').canAdvance = false;

    verifyAccount(account, {
        onSuccess: function() {
            page.setAttribute('state', 'verified');

            saveAccount(account);

            window.setTimeout(function() {
                $('#wizard').canAdvance = true;
                $('#wizard').advance(page.getAttribute('next'));
            }, 2000);
        },

        onFailure: function() {
            registerAccount(account, {
                onSuccess: function() {
                    page.setAttribute('state', 'verified');

                    saveAccount(account);

                    window.setTimeout(function() {
                        $('#wizard').canAdvance = true;
                        $('#wizard').advance(page.getAttribute('next'));
                    }, 2000);
                },

                onFailure: function(condition) {
                    // condition will most likely be
                    // 'feature-not-implemented' or 'conflict'
                    page.setAttribute('state', 'failure');
                }
            });
        }
    });

    return false;
}

// TRANSPORT PAGE

function shownPageTransport() {
    $('[pageid="transport"]').setAttribute('state', 'configuring');
    updateTransportConfig();
}

function advancedPageTransport(page) {
    if(page.getAttribute('state') == 'verified')
        return true;

    var legacyUsername = $(page, '.username').value;
    var legacyPassword = $(page, '.password').value;
    var transportAddress = page.getAttribute('service') + '.sameplace.cc';
    var sameplaceAccount = getSamePlaceAccount();

    if(!sameplaceAccount)
        // This is an exception rather than a message to the user
        // because earlier steps should have prevented us from getting
        // to this point without a SamePlace account.
        throw new Error('Cannot find a SamePlace account');

    page.setAttribute('state', 'verifying');
    $('#wizard').canAdvance = false;

    XMPP.up(sameplaceAccount, function() {
        registerToTransport(
            sameplaceAccount,
            transportAddress,
            legacyUsername,
            legacyPassword, {
                onSuccess: function() {
                    page.setAttribute('state', 'verified');
                    waitForSubscription(transportAddress, function() {
                        $('#wizard').canAdvance = true;
                        $('#wizard').advance(page.getAttribute('next'));
                    });
                },
                
                onError: function(condition) {
                    page.setAttribute('state', 'failure');
                }
            });
    });

    return false;
}


// FINAL PAGE
// ----------------------------------------------------------------------

function shownPageFinish() {
    if(account) {
        $('#connect-account').hidden = false;
        $('#connect-account').label = 'Connect ' + account.address;
    }
}

function advancedPageFinish() {
    if(account && $('#connect-account').checked)
        XMPP.up(account);
}


// NETWORK ACTIONS
// ----------------------------------------------------------------------

function verifyAccount(account, callbacks) {
    if(XMPP.isUp(account))
        return;

    var connector =
        Cc['@hyperstruct.net/xmpp4moz/connector;1?type=' +
           XMPP.connectorTypeFor(account.address + '/' + account.resource)]
        .createInstance(Ci.nsIXMPPConnector);

    connector.init(account.address + '/' + account.resource,
                   account.password,
                   account.connectionHost,
                   account.connectionPort,
                   (account.connectionSecurity == 1 ||
                    account.connectionSecurity == undefined));

    connector.addObserver({
        observe: function(subject, topic, data) {
            switch(asString(subject)) {
            case 'active':
                connector.disconnect();
                callbacks.onSuccess();
                break;
            case 'error':
                connector.disconnect();
                callbacks.onFailure();
                break;
            default:
                break;
            }
       }
    }, null, false);

    connector.connect();
}

function registerAccount(account, callbacks) {
    var service  = XMPP.JID(account.address).hostname;
    var username = XMPP.JID(account.address).username;
    var resource = account.resource;
    var password = account.password;

    var regChannel = XMPP.createChannel();
    channel.on({
        event: 'http://etherx.jabber.org/streams::error'
    }, function(event) {
        registrationFailed();
    });
    
    function start() {
        XMPP.open(service, {
            connectionHost: account.connectionHost,
            connectionPort: account.connectionPort,
            connectionSecurity: account.connectionSecurity
        }, tryRegistering);
    }

    function tryRegistering() {
        XMPP.send(service,
                  <iq type='set'>
                  <query xmlns='jabber:iq:register'>
                  <username>{username}</username>
                  <password>{password}</password>
                  </query>
                  </iq>,
                  function(reply) {
                      if(reply.stanza.@type == 'result')
                          registrationSucceeded();
                      else
                          registrationFailed(reply);
                  });

    }

    function registrationSucceeded() {
        stop();
        callbacks.onSuccess();
    }

    function registrationFailed(reply) {
        stop();
        var condition, type;
        if(reply)
            [condition, type] = XMPP.getError(reply.stanza);
        callbacks.onFailure(condition);
    }

    function stop() {
        regChannel.release();
        XMPP.close(service);
    }

    start();
}

function registerToTransport(account, transportAddress,
                             legacyUsername, legacyPassword, callbacks) {
    function start() {
        discoverSupport();
    }
    
    function discoverSupport() {
        XMPP.send(account,
                  <iq type='get' to={transportAddress}>
                  <query xmlns='http://jabber.org/protocol/disco#info'/>
                  </iq>,
                  function(reply) {
                      if(reply.stanza.@type == 'result')
                          queryRegistration();
                      else
                          error(reply.stanza);
                  });
    }

    function queryRegistration() {
        XMPP.send(account,
                  <iq type='get' to={transportAddress}>
                  <query xmlns='jabber:iq:register'/>
                  </iq>,
                  function(reply) {
                      if(reply.stanza.@type == 'result')
                          sendCredentials();
                          //displayForm(reply.stanza.ns_register::query)
                      else
                          error(reply.stanza);
                  });
    }

    function sendCredentials() {
        XMPP.send(account,
                  <iq to={transportAddress} type='set'>
                  <query xmlns='jabber:iq:register'>
                  <username>{legacyUsername}</username>
                  <password>{legacyPassword}</password>
                  </query>
                  </iq>,
                  function(reply) {
                      if(reply.stanza.@type == 'result')
                          success();
                      else
                          error(reply.stanza);
                  });
    }    

    function success() {
        if(callbacks.onSuccess)
            callbacks.onSuccess();
    }

    function error(stanza) {
        if(callbacks.onError)
            callbacks.onError(XMPP.getError(stanza));
    }

    start();
}


// OTHER ACTIONS
// ----------------------------------------------------------------------

function getSamePlaceAccount() {
    return XMPP.accounts.filter(function(account) {
        return XMPP.JID(account.jid).hostname == 'sameplace.cc';
    })[0];
}

function saveAccount(account) {
    var key = (new Date()).getTime();

    try {
        pref.setCharPref(key + '.address', account.address);
        pref.setCharPref(key + '.resource', account.resource);
        if(account.password)
            XMPP.setPassword(account.address, account.password);
        pref.setBoolPref(key + '.autoLogin', account.autoLogin);
        pref.setCharPref(key + '.connectionHost', account.connectionHost);
        pref.setIntPref(key + '.connectionPort', account.connectionPort);
        pref.setIntPref(key + '.connectionSecurity', account.connectionSecurity);
    } catch(e) {
        // Transaction-like: either account is saved completely, or
        // it's not saved at all.

        for each(var prefName in
                 ['address', 'resource', 
                  'autoLogin', 'connectionHost',
                  'connectionPort', 'connectionSecurity']) {
            if(pref.prefHasUserValue(key + '.' + prefName))
                pref.clearUserPref(key + '.' + prefName);
        }
        XMPP.delPassword(account.address);

        throw e;
    }
}


// UTILITIES
// ----------------------------------------------------------------------

function asString(xpcomString) {
   return xpcomString.QueryInterface(Ci.nsISupportsString).toString();
}

function hasClass(xulElement, aClass) {
    return xulElement.getAttribute('class').split(/\s+/).indexOf(aClass) != -1;
}

function addClass(xulElement, newClass) {
    var classes = xulElement.getAttribute('class').split(/\s+/);
    if(classes.indexOf(newClass) == -1)
        xulElement.setAttribute('class', classes.concat(newClass).join(' '));
}

function smoothScrollTo(scrollbox) {
    var xulScrollbox = document.getElementsByTagName('scrollbox')[0];
    xulScrollbox.boxObject.QueryInterface(Ci.nsIScrollBoxObject);
    var xPos = {};
    var yPos = {};
    xulScrollbox.boxObject.getPosition(xPos, yPos);

    var xTargetElement = xulScrollbox.firstChild.nextSibling;
    var xTarget = xTargetElement.boxObject.x - xTargetElement.boxObject.parentBox.boxObject.x;

    var delta = xTarget - xPos.value;
    var steps = 20;
    var increment = delta/steps;

    var step = 0;
    var intervalID = window.setInterval(function() {
        xulScrollbox.boxObject.scrollBy(increment, 0);
        step++;
        if(step >= steps)
            window.clearInterval(intervalID);
    }, 40);
}

function waitForSubscription(transportAddress, continuation) {
    // If within 5 seconds we're not done, go ahead anyway.
    var done = false;
    window.setTimeout(function() {
        if(!done) {
            done = true;
            continuation();
        }
    }, 7500);

    var reaction = channel.on({
        event     : 'presence',
        direction : 'in',
        stanza    : function(s) {
            return (s.@type == 'subscribe' &&
                    s.@from == transportAddress);
        }
    }, function(presence) {
        channel.forget(reaction);
        XMPP.send(presence.account,
                  <presence to={presence.stanza.@from} type='subscribed'/>);
        if(!done) {
            done = true;
            continuation();
        }
    });
}
