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
// ---------------------------------------------------------------------

var URL_FRIENDS   = 'http://twitter.com/statuses/friends.xml';
var URL_TIMELINE  = 'http://twitter.com/statuses/friends_timeline.xml';
var URL_XSL       = 'chrome://sameplace/content/connectors/twitter.xsl';

var ns_twitter    = 'http://hyperstruct.net/xmpp4moz/connectors#twitter';
var ns_disco_info = 'http://jabber.org/protocol/disco#info'
var ns_register   = 'jabber:iq:register';
var ns_roster     = 'jabber:iq:roster';


// CONSTRUCTOR
// ----------------------------------------------------------------------

function Twitter(server, name) {
    this._server = server;
    this._name = name || arguments.callee.name.toLowerCase();
    this._jid = this._name + '.' + this._server.jid;

    this._user_jid = undefined;
    this._remote_username = undefined;
    this._remote_password = undefined;

    this._url_retrieval_times = {};
    this._timer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
}


// SERVICE API IMPLEMENTATION
// ----------------------------------------------------------------------

Twitter.prototype.__defineGetter__('name', function() {
    return this._name;
});

Twitter.prototype.receive = function(element) {
    switch(element.localName()) {
    case 'iq':
        var query = element.*::query;
        if(query == undefined)
            return;

        var handler = Twitter.handlers
            .iq[element.@type][query.namespace().uri];
        if(handler)
            handler.call(this, element);
        else
            this.send(<iq to={element.@from}
                      type='result' id={element.@id}>
                      <error code='501' type='cancel'>
                      <feature-not-implemented xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                      </error>
                      </iq>);
        break;
    case 'message':
        var handler = Twitter.handlers
            .message;
        if(handler)
            handler.call(this, element);
        break;
    case 'presence':
        var handler = Twitter.handlers
            .presence[element.@type.toString() || 'available'];
        if(handler)
            handler.call(this, element);
        break;
    }
};


// SERVICE HANDLERS
// ----------------------------------------------------------------------

Twitter.handlers = {
    iq       : { get: {}, set: {} },
    presence : { },
    message  : { }
};

// Here we reply to information discovery requests with general
// information about the service (<identity/>) and features we support.
//
// Of <identity/> attributes, 'name' can be anything; 'category' and
// 'type' must be chosen among those described in
// http://www.xmpp.org/registrar/disco-categories.html
//
// More info: XEP-0030

Twitter.handlers.iq.get[ns_disco_info] = function(element) {
    this.send(<iq to={element.@from} type='result' id={element.@id}>
              <query xmlns='http://jabber.org/protocol/disco#info'>
              <identity category='gateway' type='twitter' name='Twitter Transport'/>;
              <feature var='http://jabber.org/protocol/disco'/>
              <feature var='jabber:iq:register'/>
              </query>
              </iq>);
};

// Before registering, the client will ask the service what
// credentials it should provide and what message it should display to
// the user.
//
// Obviously, username/password will work in 99% of the cases and this
// won't need modifications.
//
// Examples of 'element':
//
//   <iq type='get' from='user@x4m.localhost' to='twitter.x4m.localhost' id='reg01'>
//     <query xmlns='jabber:iq:register'/>
//   </iq>
//
// More info: XEP-0077

Twitter.handlers.iq.get[ns_register] = function(element) {
    this.send(<iq to={element.@from} type='result' id={element.@id}>
              <query xmlns='jabber:iq:register'>
              <instructions>Please enter your Twitter username and password.</instructions>
              <username/>
              <password/>
              </query>
              </iq>);
};

// Client requests registration and provides credentials for the
// remote service.
// 
// We first validate credentials by trying to authenticate with remote
// service.  If authentication is successful, we:
//
//   1. save client's JID and remote credentials;
//
//   2. ask client to add us to its contact list;
//
//   3. retrieve remote contact list, converting it to jabber roster
//      format in the process
//
//   4. cause synchronization of client's roster, by either:
//
//      4a. passing remote contact list to virtual server, telling it
//          to update client's roster...
//
//      4b. ...or send contact list items to client, so that it can
//          decide whether to update roster or not.
//
// According to XEP-0100, 4b should be the chosen behaviour.  4a is
// not standarde, but since in our case the service is always local to
// the server and even the server is local to the user machine, we
// take a shortcut and modify roster directly.
//
// Code below won't probably need modification.  The bulk of the
// action happens in authenticate() and in retrieveFriends().
//
// Examples of 'element':
//
//   <iq type='set' from='user@x4m.localhost' to='twitter.x4m.localhost' id='reg01'>
//     <query xmlns='jabber:iq:register'>
//       <username>foo</username>
//       <password>bar</username>
//     </query>
//   </iq>
//
// More info: XEP-0100

Twitter.handlers.iq.set[ns_register] = function(element) {
    this.setCredentials(element.@from,
                        element..ns_register::username,
                        element..ns_register::password);

    var _ = this;
    this.authenticate({
        onSuccess: function() {
            // Save client's info here

            _.send(<iq to={element.@from} type='result' id={element.@id}/>);
            _.send(<presence to={element.@from} type='subscribe'/>);
            _.retrieveFriends(function(rosterIq) {
                _._roster = rosterIq.ns_roster::query;
//                _.server.mergeRoster(rosterIq.ns_roster::query);

                // Alternate way:
                // for each(var item in rosterItems) {
                //     _.send(<presence from={item.@jid} type='subscribe' to={element.@from}/>);
                // }
            });
        },
        onFailure: function(code) {
            _.send(<iq to={element.@from} type='error' id={element.@id}>
                   {element.*::query}
                   <error code='406' type='modify'>
                   <not-acceptable xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                   </error>
                   </iq>)
        }
    });
};

// To every message coming from the client we give a standard reply.
// If you want to provide bot-like functionality, this is the place to
// be.
//
// Note that we only reply to messages that have human-readable
// content (body).  Clients also use messages for sending typing
// notifications, but we don't want to act on those.
//
// Examples of 'element':
//
//   <message type='chat' from='user@x4m.localhost' to='twitter.x4m.localhost'>
//     <body>hello... anybody out there?</body>
//   </message>
//
//   <message type='chat' from='user@x4m.localhost' to='someone@twitter.x4m.localhost'>
//     <body>hello... anybody out there?</body>
//   </message>

Twitter.handlers.message = function(element) {
    if(element.body != undefined) {
        var username = JID(element.@from).username;
        if(username) {
            var reply = element.copy();
            reply.@type = 'error';
            reply.@from = username;
            reply.@to = element.@from;
            reply.error = (<error code="503" type="cancel">
                           <service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                           </error>);
            this.send(reply);
        } else
            this.send(<message to={element.@from}>
                      <body>.</body>
                      </message>);
    }
};

// Client send presence notifications.  If it's the first one, log
// into remote service using saved credentials.
//
// If appropriate, reflect presence status (away, busy, etc.) and
// status message to remote service.
//
// Examples of 'element':
//
//   <presence from='user@x4m.localhost'/>
//
//   <presence from='user@x4m.localhost'>
//     <show>away</show>
//     <status>not here right now</status>
//   </presence>

Twitter.handlers.presence.available = function(element) {
    if(!this._connected_to_remote)
        this.start();
};

// Client has become unavailable.  Log out of the remote service.
//
// Examples of 'element':
//
//   <presence from='user@x4m.localhost' type='unavailable'/>

Twitter.handlers.presence.unavailable = function(element) {
    if(this._connected_to_remote)
        this.stop();
};

// Twitter.handlers.presence.subscribe = function(packet) {
    
// };

// Twitter.handlers.presence.subscribed = function(packet) {
    
// };



// INTERNALS
// ----------------------------------------------------------------------

Twitter.prototype.send = function(element) {
    this._server.fromService(this, element);
};

Twitter.prototype.start = function() {
    this._connected_to_remote = true;

//    _.server.mergeRoster(this._roster);

    var _ = this;
    this._timer.initWithCallback({ notify: function(timer) { _.retrieveStatuses(); } },
                                 60000,
                                 Ci.nsITimer.TYPE_REPEATING_SLACK);
    this.retrieveStatuses(true);
};

Twitter.prototype.stop = function() {
    this._timer.cancel();
    this._connected_to_remote = false;
};

Twitter.prototype.setUserCredentials = function(userJid, remoteUsername, remotePassword) {
    this._user_jid = userJid;
    this._remote_username = remoteUsername;
    this._remote_password = remotePassword;
};

Twitter.prototype.authenticate = function(callbacks) {
    this.httpRequest(URL_TIMELINE, {
        onLoad: function(req) {
            switch(req.status) {
            case 200:
                callbacks.onSuccess();
                break;
            case 401: // Not Authorized
            case 502: // Bad Gateway
            default:
                callbacks.onFailure(req.status);
                break;
            }
        },
        onError: function(req) {
            callbacks.onError(req.status);
        }
    }, true);
};

Twitter.prototype.retrieveFriends = function(action) {
    var _ = this;
    this.retrieveAsXMPP(URL_FRIENDS, function(stream) {
        action(asXML(stream.firstChild));
    }, true);
};

Twitter.prototype.retrieveStatuses = function(forceRetrieval) {
    var _ = this;
    this.retrieveAsXMPP(
        URL_TIMELINE,
        function(stream) {
            if(!stream.firstChild)
                return;

            for(var i=0,l=stream.childNodes.length; i<l; i++)
                _.send(stream.childNodes[i]);
        },
        forceRetrieval);
};

Twitter.prototype.retrieveAsXMPP = function(url, action, forceRetrieval) {
    var _ = this;
    this.httpRequest(url, { onLoad: function(req) {
        if(req.status != 200)
            return;

        var stream = foreignToXMPP(req.responseXML, { service_jid: _._jid }).firstChild;
        action(stream);
    }}, forceRetrieval);
};

Twitter.prototype.httpRequest = function(url, callbacks, forceRetrieval) {
    var request = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
        .createInstance(Ci.nsIXMLHttpRequest);

    var _ = this;
    if(callbacks.onLoad)
        request.addEventListener('load', function(event) {
            if(request.status == 304)
                return;
            if(request.status == 200)
                _._url_retrieval_times[url] = (new Date()).toUTCString();
                
            callbacks.onLoad(request);
        }, false);
    if(callbacks.onError)
        request.addEventListener('error', function(event) {
            callbacks.onError(request);
        }, false);

    request.open('GET', url, true, this._remote_username, this._remote_password);
    if(this._url_retrieval_times[url] && !forceRetrieval)
        request.setRequestHeader('If-Modified-Since', this._url_retrieval_times[url]);

    request.send(null);
};


// UTILITIES
// ----------------------------------------------------------------------

function foreignToXMPP(foreignXML, params) {
    var doc = Cc['@mozilla.org/xml/xml-document;1']
        .createInstance(Ci.nsIDOMXMLDocument);
    var xsltproc = Cc['@mozilla.org/document-transformer;1?type=xslt']
        .createInstance(Ci.nsIXSLTProcessor);
    var stylesheet = Cc['@mozilla.org/xml/xml-document;1']
        .createInstance(Ci.nsIDOMXMLDocument);

    stylesheet.async = false;
    stylesheet.load(URL_XSL);
    xsltproc.importStylesheet(stylesheet);

    foreignToXMPP = function(foreignXML, params) {
        for(var name in params) {
            dump('xslt - setting ' + name + ' to ' + params[name] + '\n');
            xsltproc.setParameter(null, name, params[name]);
        }
        return xsltproc.transformToFragment(foreignXML, doc);
    };
    
    return foreignToXMPP(foreignXML, params);
}



// TESTS
// ----------------------------------------------------------------------

Twitter.test = function() {
//     var fakeServer = {
//         fromService: function(service, packet) {
//             repl.print(packet);
//         }
//     };
//     var twitter = new Twitter(fakeServer);

//     twitter.receive(<iq from='user@x4m.localhost/Firefox'
//                     to='twitter.x4m.localhost'
//                     type='get' id='reg01'>
//                     <query xmlns='jabber:iq:register'/>
//                     </iq>);
//     twitter.receive(<iq from='user@x4m.localhost/Firefox'
//                     to='twitter.x4m.localhost'
//                     type='set' id='reg01'>
//                     <query xmlns='jabber:iq:register'>
//                     <username>foo</username>
//                     <password>bar</password>
//                     </query>);


    function clearAuth() {
        Cc['@mozilla.org/network/http-auth-manager;1']
            .getService(Ci.nsIHttpAuthManager)
            .clearAll();
    }

    var tests = {
        'Authenticate': function(success, failure) {
            var twitter = new Twitter({});
            twitter.setUserCredentials('user@x4m.localhost/Firefox',
                                       'hyperstruct',
                                       'rehtrew');
            twitter.authenticate({
                onSuccess: function() { success(); },
                onFailure: function() { failure(); }
            });
        },

        'Retrieve friends': function(success, failure) {
            var twitter = new Twitter({});
            twitter.setUserCredentials('user@x4m.localhost/Firefox',
                                       'hyperstruct',
                                       'rehtrew');
            twitter.retrieveFriends(function(xml) {
                success();
            });
        }
    }

    function runTests(tests, onTestRun) {
        var queue = [];
        for(var name in tests)
            queue.push([name, tests[name]]);
        
        function next() {
            if(queue.length == 0)
                return;
            
            var [name, test] = queue.shift();
            
            function success() {
                if(timedOut) return;
                executed = true;

                onTestRun(name, 'success');
                window.setTimeout(next, 0);
            }

            function failure() {
                if(timedOut) return;
                executed = true;

                onTestRun(name, 'failure');
                window.setTimeout(next, 0);
            }

            function timeout() {
                if(executed) return;
                timedOut = true;

                onTestRun(name, 'timeout');
                window.setTimeout(next, 0);
            }

            var executed = false, timedOut = false;
            window.setTimeout(timeout, 2000);
            test(success, failure);
        }

        next();
    }

    runTests(tests, function(testName, result) {
        repl.print(testName + ': ' + result);
    });
};
