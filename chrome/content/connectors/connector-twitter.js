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
 * Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
 *  
 */


// DEFINITIONS
// ----------------------------------------------------------------------

var URL_XSL              = 'chrome://sameplace/content/connectors/connector-twitter.xsl';
var URL_FRIENDS          = 'http://twitter.com/statuses/friends.xml';
var URL_PUBLIC_TIMELINE  = 'http://twitter.com/statuses/public_timeline.rss';
var URL_FRIENDS_TIMELINE = 'http://twitter.com/statuses/friends_timeline.xml';
var URL_STATUS           = 'http://twitter.com/statuses/update.xml';
var URL_DIRECT_MESSAGE_NEW = 'http://twitter.com/direct_messages/new.xml';
var UPDATE_INTERVAL      = 60000;

var ns_twitter = 'http://hyperstruct.net/xmpp4moz/connectors#twitter';


// INITIALIZATION
// ----------------------------------------------------------------------

function init(userJid, password) {
    d('initializing');
    this._timer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
    this._username = userJid.split('@')[0];
    this._password = password;
    this._session = null;
    this._user_jid = userJid;
    this._cache = Cc['@mozilla.org/xml/xml-document;1']
        .createInstance(Ci.nsIDOMXMLDocument);
    this._cache.QueryInterface(Ci.nsIDOMXPathEvaluator);
    var connectorsBase = 'x4m.localhost'; // should be retrieved from prefs
    this._jid = 'twitter' + '.' + connectorsBase;
    this._url_retrieval_times = {};
}


// PUBLIC INTERFACE
// ----------------------------------------------------------------------

function setSession(session) {
    this._session = session;
}

function connect() {
    if(this.isConnected())
        return;

    var connector = this;
    this.setState('connecting');
    this.httpRequest(URL_PUBLIC_TIMELINE, {
        onLoad: function(req) {
            d('got public timeline - good, connection is up');
            if(connector._password)
                connector.authenticate();
            else
                connector.setState('active');
        },
        onError: function(req) {
            d(req.responseText);
            connector.setState('error');
            connector.setState('disconnected');
        }
    });
}

function disconnect() {
    if(!this.isConnected())
        return;

    this._timer.cancel();
    this.setState('disconnected');
}

function isConnected() {
    return this._state == 'authenticating' || this._state == 'active';
}

function send(packet) {
    var name  = packet.nodeName;
    var type  = packet.getAttribute('type');
    var id    = packet.getAttribute('id');
    var query = (packet.getElementsByTagName('query')[0] ||
                 packet.getElementsByTagName('vCard')[0]);

    switch(name) {
    case 'iq':
        if(!query) return;
        if(type == 'error') return;
            
        var handler = handlers.iq[type][query.namespaceURI];
        if(handler)
            handler.call(this, packet);
        else
            this.toSession(<iq from={this._jid} to={this._user_jid}
                           id={packet.getAttribute('id')} type='error'>
                           <error code='501' type='cancel'>
                           <feature-not-implemented
                           xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                           </error>
                           </iq>);
        break;
    case 'presence':
        var handler = handlers.presence[type || 'available'];
        if(handler)
            handler.call(this, packet);
        
        break;
    case 'message':
        var handler = handlers.message[type || 'normal'];
        if(handler)
            handler.call(this, packet);

        break;
    default:
        throw new Error('Invalid packet. (' + name + ')');
    }
}

// COMMON TO CONNECTORS - FACTOR AWAY
// ----------------------------------------------------------------------

function addObserver(observer) {
    if(!this._observers)
        this._observers = [];
    this._observers.push(observer);    
}

function notifyObservers(subject, topic, data) {
    function xpWrapped(string) {
        if(string instanceof Ci.nsISupportsString)
            return string;
        else if(typeof(string) == 'string') {
            var xpcomized = Cc['@mozilla.org/supports-string;1']
                .createInstance(Ci.nsISupportsString);
            xpcomized.data = string;
            return xpcomized;
        } else
            throw new Error('Not an XPCOM nor a Javascript string. (' + string + ')');
    }
    
    subject = xpWrapped(subject);

    for each(var observer in this._observers) 
        try {
            d('notifying observer about ' + topic)
            observer.observe(subject, topic, data);
        } catch(e) {
            Cu.reportError(e);
        }
}

function removeObserver(observer) {
    var index = this._observers.indexOf(observer);
    if(index != -1) 
        this._observers.splice(index, 1);    
}


// PROTOCOL BRIDGE
// ----------------------------------------------------------------------

var handlers = {
    iq: { get: {}, set: {}, result: {} } ,
    presence: {},
    message: {}
}

handlers.iq.get['jabber:iq:roster'] = function(packet) {
    var query =
        '//*[local-name() = "query" ' +
        '    and namespace-uri() = "jabber:iq:roster"]' +
        '/ancestor::iq';
        
    var rosterIq = this._cache.evaluate(
        query,
        this._cache,
        null,
        Ci.nsIDOMXPathResult.ANY_UNORDERED_NODE_TYPE,
        null).singleNodeValue.cloneNode(true);

    rosterIq.setAttribute('from', this._jid);
    rosterIq.setAttribute('to', this._user_jid);
    rosterIq.setAttribute('id', packet.getAttribute('id'));
    this.toSession(rosterIq);
};

handlers.iq.set['jabber:iq:roster'] = function(packet) {
    var contact = packet
        .getElementsByTagNameNS('jabber:iq:roster', 'item')[0]
        .getAttribute('jid');
    d('stub: adding ' + contact + ' to contact list');
};

handlers.iq.get['vcard-temp'] = function(packet) {
    var query =
        '//*[local-name() = "vCard" ' +
        '    and namespace-uri() = "vcard-temp"]' +
        '/ancestor::iq[@from="' + packet.getAttribute('to') + '"]';

    var vcardIq = this._cache.evaluate(
        query,
        this._cache,
        null,
        Ci.nsIDOMXPathResult.ANY_UNORDERED_NODE_TYPE,
        null).singleNodeValue.cloneNode(true);

    vcardIq.setAttribute('from', packet.getAttribute('to'));
    vcardIq.setAttribute('to', this._user_jid);
    vcardIq.setAttribute('id', packet.getAttribute('id'));
    this.toSession(vcardIq);
};

handlers.presence.available = function(packet) {
    if(!this._polling) {
        this._polling = true;
        var connector = this;
        this._timer.initWithCallback({ notify: function(timer) { connector.retrieveStatuses(); } },
                                     60000,
                                     Ci.nsITimer.TYPE_REPEATING_SLACK);
        this.retrieveStatuses(true);
    }

    var connector = this;
    var status = packet.getElementsByTagName('status')[0];
    if(status)
        httpPost(URL_STATUS, serialize(status), {
            onLoad: function(req) {
                var stream = foreignToXMPP(req.responseXML, {service_jid: connector._jid}).firstChild;
                var presence = stream.firstChild;
                fixTwitterEscapes(stream.firstChild);
                presence.setAttribute('to', connector._user_jid);
                connector.toSession(presence);
            },
            onError: function(req) {
                d('error while setting status: code ' + req.status);
            }
        });
};

handlers.presence.unavailable = function(packet) {
    if(this._polling) {
        this._polling = false;
        this._timer.cancel();
    }
};

handlers.presence.subscribe = function(packet) {
    d('stub: user requested presence notification from ' + packet.getAttribute('to'));
};

handlers.message.chat = function(packet) {
    var errorMessage = packet.cloneNode(true);
    errorMessage.setAttribute('to', this._user_jid);
    errorMessage.setAttribute('from', packet.getAttribute('to'));
    errorMessage.setAttribute('type', 'error');

    var ns_stanzas = 'urn:ietf:params:xml:ns:xmpp-stanzas';

    var error = asDOM(
            <error code='501' type='cancel'>
            <text xmlns={ns_stanzas}>Messages currently not supported by Twitter connector</text>
            <feature-not-implemented xmlns={ns_stanzas}/>
            </error>);
        
    errorMessage.appendChild(errorMessage.ownerDocument.importNode(error, true));

    this.toSession(errorMessage);
    
    /*
    if(packet.getElementsByTagNameNS('http://jabber.org/protocol/chatstates',
                                     'composing')[0])
        d('stub: sending typing notification to ' + packet.getAttribute('to'));

    var domBody = packet.getElementsByTagNameNS(null, 'body')[0];
    if(domBody) {
        var recipient = JID(packet.getAttribute('to')).username;

        httpPost(URL_DIRECT_MESSAGE_NEW,
                 'user=' + recipient + '&text=hello', { //stub
                     onLoad: function(req) {
                         d('onload:'+req.responseText);
                     },
                     onError: function(req) {
                         d('onerror:'+req.responseText);
                     }
                 });
    }*/
};

handlers.message.headline = handlers.message.chat;
handlers.message.groupchat = handlers.message.chat;
handlers.message.normal = handlers.message.chat;


// EXTERNAL PROTOCOL ACTIONS
// ----------------------------------------------------------------------

function authenticate() {
    this.setState('authenticating');

    // Differently than XMPP, with XMLHttpRequest authentication is
    // done with each request, not just at the beginning.  Still, we
    // perform an "authenticate" step, fetching a password-protected
    // URL, as an early check that we have proper credentials, so that
    // it won't bite us later.

    var connector = this;
    this.httpRequest(URL_FRIENDS_TIMELINE, {
        onLoad: function(req) {
            switch(req.status) {
            case 200:
                d('authenticated, retrieving friends...');
                connector.retrieveFriends(function(stream) {
                    connector._cache.appendChild(
                        connector._cache.importNode(stream, true));
                    connector.setState('active');
                });
                break;
            case 401:
                // 401 Not Authorized: either you need to provide authentication credentials, or the credentials provided aren't valid.
            case 502:
                // 502 Bad Gateway: returned if Twitter is down or being upgraded.
            default:
                d('error auth: ' + req.status + '\n');
                d('response: ' + req.responseText + '\n');
                connector.setState('error');
                connector.setState('disconnected');
                break;
            }
        },
        onError: function(req) {
            connector.setState('error');
            connector.setState('disconnected');            
        }
    });
}

function retrieveFriends(action) {
    this.retrieveAsXMPP(URL_FRIENDS, function(stream) {
        action(stream);
    }, true);
}

function retrieveStatuses(force) {
    var connector = this;
    this.retrieveAsXMPP(URL_FRIENDS_TIMELINE, function(stream) {
        for(var i=0,l=stream.childNodes.length; i<l; i++) {
            var presence = stream.childNodes[i];
            fixTwitterEscapes(presence);// XXX this should probably be done *before* converting to xmpp!
            fixTimestampFormat(presence); // XXX idem
            presence.setAttribute('to', connector._user_jid);
            connector.toSession(presence);
        }
    }, force);
}


// INTERNALS
// ----------------------------------------------------------------------

function setState(name) {
    this._state = name;
    d('set state to ' + name + '\n');
    this.notifyObservers(name, 'connector', null);
}

function toSession(data) {
    if(data instanceof Ci.nsIDOMNodeList) {
        var element = data.firstChild;
        while(element) {
            this.session.receive(child);
            element = element.nextSibling;
        }
    } else if(data instanceof Ci.nsIDOMElement) {
        this._session.receive(data);
    } else if(typeof(data) == 'xml') {
        this._session.receive(asDOM(data));
    } else {
        throw new Error('Unexpected data type. (' + data + ')');
    }
}

function retrieveAsXMPP(url, action, force) {
    var connector = this;
    this.httpRequest(url, { onLoad: function(req) {
        if(req.status != 200)
            return;
        d('retrieved: ' + req.responseText)

        var stream = foreignToXMPP(req.responseXML, { service_jid: connector._jid }).firstChild;
        action(stream);
    }}, force);
};

function httpPost(url, data, callbacks) {
    var request = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
        .createInstance(Ci.nsIXMLHttpRequest);

    var connector = this;
    if(callbacks.onLoad)
        request.addEventListener('load', function(event) {
            callbacks.onLoad(request);
        }, false);

    if(callbacks.onError)
        request.addEventListener('error', function(event) {
            callbacks.onError(request);
        }, false);
    
    request.open('POST', url, true, this._username, this._password);
    request.send(data);
}

function httpRequest(url, callbacks, forceRetrieval) {
    var request = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
        .createInstance(Ci.nsIXMLHttpRequest);

    var connector = this;
    if(callbacks.onLoad)
        request.addEventListener('load', function(event) {
            if(request.status == 304)
                return;
            if(request.status == 200)
                connector._url_retrieval_times[url] = (new Date()).toUTCString();
                
            callbacks.onLoad(request);
        }, false);
    if(callbacks.onError)
        request.addEventListener('error', function(event) {
            callbacks.onError(request);
        }, false);

    request.open('GET', url, true, this._username, this._password);
    if(this._url_retrieval_times[url] && !forceRetrieval)
        request.setRequestHeader('If-Modified-Since', this._url_retrieval_times[url]);

    request.send(null);
};


// UTILITIES
// ----------------------------------------------------------------------

function JID(string) {
    var memo = arguments.callee.memo || (arguments.callee.memo = {});
    if(string in memo)
        return memo[string];
    var m = string.match(/^(.+?@)?(.+?)(?:\/|$)(.*$)/);

    var jid = {};

    if(m[1])
        jid.username = m[1].slice(0, -1);

    jid.hostname = m[2];
    jid.resource = m[3];
    jid.nick     = m[3];
    jid.full     = m[3] ? string : null;
    jid.address  = jid.username ?
        jid.username + '@' + jid.hostname :
        jid.hostname;

    memo[string] = jid;
    return jid;
}

function foreignToXMPP(foreignXML, params) {
    var doc = Cc['@mozilla.org/xml/xml-document;1']
        .createInstance(Ci.nsIDOMXMLDocument);
    var xsltproc = Cc['@mozilla.org/document-transformer;1?type=xslt']
        .createInstance(Ci.nsIXSLTProcessor);
    var request = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
        .createInstance(Ci.nsIXMLHttpRequest);
    request.open('GET', URL_XSL, false);
    request.send(null);
    var stylesheet = request.responseXML;
    
    xsltproc.importStylesheet(stylesheet);

    foreignToXMPP = function(foreignXML, params) {
        for(var name in params) {
            xsltproc.setParameter(null, name, params[name]);
        }
        return xsltproc.transformToFragment(foreignXML, doc);
    };
    
    return foreignToXMPP(foreignXML, params);
}

function asDOM(object) {
    var parser = Cc['@mozilla.org/xmlextras/domparser;1'].getService(Ci.nsIDOMParser);

    asDOM = function(object) {
        var element;    
        switch(typeof(object)) {
        case 'xml':
            element = parser
                .parseFromString(object.toXMLString(), 'text/xml')
                .documentElement;
            break;
        case 'string':
            element = parser
                .parseFromString(object, 'text/xml')
                .documentElement;
            break;
        default:
            throw new Error('Argument error. (' + typeof(object) + ')');
        }
        
        return element;
    };

    return asDOM(object);
}

function fixTwitterEscapes(presence) {
    var status = presence.getElementsByTagName('status')[0];
    status.textContent = status.textContent
        .replace('&gt;', '>')
        .replace('&lt;', '<');
}

function fixTimestampFormat(presence) {
    var delay = presence.getElementsByTagNameNS('urn:xmpp:delay', 'delay')[0];
    delay.setAttribute('stamp', dateToStamp(new Date(Date.parse(delay.textContent))));
    delay.textContent = '';
}


// UTILITIES
// ----------------------------------------------------------------------

function dateToStamp(date) {
    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }
    
    return (date.getUTCFullYear() + '-' +
            pad(date.getUTCMonth()+1) + '-' +
            pad(date.getUTCDate()) + 'T' +
            pad(date.getUTCHours()) + ':' +
            pad(date.getUTCMinutes()) + ':' +
            pad(date.getUTCSeconds()));
}


// DEVELOPER UTILITIES
// ----------------------------------------------------------------------

function serialize(element) {
    var serializer = Cc['@mozilla.org/xmlextras/xmlserializer;1']
        .getService(Ci.nsIDOMSerializer);
    serialize = function(element) {
        return serializer.serializeToString(element);
    };
    return serialize(element);
}

function d(s) {
    dump('Twitter connector: ' + s +'\n');
}

