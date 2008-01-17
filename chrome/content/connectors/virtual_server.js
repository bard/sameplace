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


// COMMENTARY
/**********************************************************************
This is a single-user, minimal XMPP server, meant to be used as a
virtual server, i.e. in the same process space of the client.

It is locked on the username provided via the constructor.  User does
not need to authenticate.

Use case is providing a base for additional plugins/services, mainly
transports that masquerade remote services as XMPP services.
**********************************************************************/


// TODO
/**********************************************************************
Server should ignore whatever "subscription" value client puts in
roster items, except "remove"

Server.handlers should handle not just iq but also other packet
types, like in services

Verify instances of toClient().  Ideally, route() should be used
everywhere.

Not related, but: since iq reply handlers are tracked via id's only,
remote entity could trigger execution by sending an appropriately
crafted id.  Thus, pending iq handlers should probably be keyed on
"from" bare hash + id.  Also, id should be used to check that an
incoming iq-result is actually in response to something we asked.

Possibly have route() stamp set server's jid as "from" attribute of
packets which don't have one.

Proper presence notification.
**********************************************************************/


// DEFINITIONS
// ----------------------------------------------------------------------

with(Cc['@mozilla.org/moz/jssubscript-loader;1']
     .getService(Ci.mozIJSSubScriptLoader))
    loadSubScript('chrome://xmpp4moz/content/lib/misc.js');

var ns_disco_info   = 'http://jabber.org/protocol/disco#info'
var ns_register     = 'jabber:iq:register';
var ns_roster       = 'jabber:iq:roster';
var ns_roster_deleg = 'http://hyperstruct.net/xmpp4moz/roster_delegation';


// API
// ----------------------------------------------------------------------

function Server(serverJid, userJid, clientConnector) {
    this._jid = serverJid;
    this._user_jid = userJid;
    this._connector = clientConnector;

    this._counter = 1000;
    this._services = [];
    this._user_roster = <query xmlns='jabber:iq:roster'/>;
    this._user_presence = <presence from={this._user_jid} type='unavailable'/>
    this._identity_cache = {};
}


// PROPERTIES
// ----------------------------------------------------------------------

Server.prototype.__defineGetter__('jid', function() {
    return this._jid;
});


// PACKET ENTRY AND EXIT POINTS
// ----------------------------------------------------------------------

Server.prototype.fromService = function(service, packet) {
    if(packet.@from == undefined)
        packet.@from = service.name + '.' + this._jid;
    else if(!packet.@from.match(/@/))
        packet.@from += '@' + service.name + '.' + this._jid;

    this.route(packet);

    if(packet.name() == 'presence' && packet.@type == 'subscribed')
        this.route(<presence from={packet.@from} to={this._user_jid}/>)
}

Server.prototype.toService = function(packet) {
    if(packet.@from == undefined)
        packet.@from = this._jid;

    this.getService(JID(packet.@to).hostname).receive(packet);
};

Server.prototype.fromClient = function(packet) {
    if(packet.name() == 'presence') {
        if(packet.@type == 'subscribe' || packet.@type == 'subscribed')
            packet.@from = JID(this._user_jid).address;
        else
            packet.@from = this._user_jid;
    }
    else
        packet.@from = this._user_jid;
        
    this.route(packet);
};

Server.prototype.route = function(packet) {
    if(packet.@to == undefined ||
       packet.@to == this._jid)
        this.handleLocal(packet)
    else if(JID(packet.@to).hostname == this._jid)
        this.handleUserBound(packet);
    else
        this.handleOutbound(packet);
};

Server.prototype.toClient = function(packet) {
    if(packet.@from == undefined)
        packet.@from = this._jid;
    this._connector.fromServer(packet);
};


// SERVICE HANDLING
// ----------------------------------------------------------------------

Server.prototype.getService = function(jid) {
    // no resource handling
    return this._services[jid];
};

Server.prototype.forEachService = function(action) {
    for(var jid in this._services)
        action(jid);
};

Server.prototype.isRegisteredService = function(jid) {
    return this._services[jid] != undefined;
};

Server.prototype.addService = function(service) {
    var jid = service.name + '.' + this._jid;
    if(!this._services[jid]) {
        this._services[jid] = service;
        this.route(<iq to={jid} from={this._jid} type='get' id={this._counter++}>
                   <query xmlns='http://jabber.org/protocol/disco#info'/>
                   </iq>);
    }
    else
        throw new Error('Service with same name already registered. (' + service.name + ')');
};

Server.prototype.isTransport = function(serviceJid) {
    var cachedIdentity = this._identity_cache[serviceJid];
    return (cachedIdentity && cachedIdentity.@category == 'gateway');
};


// PACKET HANDLING
// ----------------------------------------------------------------------

Server.prototype.handleUserBound = function(packet) {
    if(JID(packet.@to).address != JID(this._user_jid).address)
        throw new Error('Addressing unexisting user. (' + packet.@to + ')');

    if(packet.name() == 'presence' && packet.@type == 'subscribed') {
        var item = this._user_roster.ns_roster::item.(@jid == packet.@from);

        if(item != undefined && item.@ask == 'subscribe' &&
           (item.@subscription == 'none' || item.@subscription == 'from')) {
            item.@subscription = 'to';
            delete item.@ask;
            this.route(<iq from={this._jid} to={this._user_jid}
                       id={this._counter++} type='set'>
                       <query xmlns='jabber:iq:roster'>{item}</query>
                       </iq>);
        }
    }

    this.toClient(packet);
};

Server.prototype.handleOutbound = function(packet) {
    if(packet.name() == 'presence' && packet.@type == 'subscribe') {
        var item = <item xmlns='jabber:iq:roster' jid={packet.@to}
        subscription='none' ask='subscribe'/>;
        this._user_roster.appendChild(item);
        this.route(<iq from={this._jid} to={this._user_jid}
                   id={this._counter++} type='set'>
                   <query xmlns='jabber:iq:roster'>{item}</query>
                   </iq>);
    }

    if(this.isRegisteredService(JID(packet.@to).hostname))
        this.toService(packet);
    else {
        if(packet.name() == 'iq')
            this.route(<iq from={packet.@to} to={this._user_jid}
                       id={packet.@id} type='error'>
                       {packet.*::query}
                       <error code='503' type='cancel'>
                       <service-unavailable xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                       </error>
                       </iq>);
        else
            ; // XXX presence 404?
    }

    if(packet.name() == 'presence' && packet.@type == 'subscribed') {
        var presence = this._user_presence.copy();
        presence.@to = packet.@to;
        this.route(presence);
        
        var item;
        item = this._user_roster.ns_roster::item.(@jid == packet.@to);
        if(item != undefined)
            item.@subscription == 'from';
        else
            item = <item jid={packet.@to} subscription='from'/>
        
        this.route(<iq from={this._jid} to={this._user_jid}
                   type='set' id={this._counter++}>
                   <query xmlns='jabber:iq:roster'>
                   {item}
                   </query>
                   </iq>);
    }
};

Server.prototype.handleLocal = function(packet) {
//    XML.prettyPrinting = false; XML.ignoreWhitespace = true;
    
    switch(packet.localName()) {
    case 'iq':
        var query = packet.*::query;
        if(query == undefined)
            return;

        if(packet.@type == 'get' || packet.@type == 'set') {
            var handler = Server.handlers
                .iq[packet.@type][query.namespace().uri];
            if(handler)
                handler.call(this, packet);
            else
                this.route(<iq from={this._jid} to={this._user_jid}
                           id={packet.@id} type='error'>
                           <error code='501' type='cancel'>
                           <feature-not-implemented xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                           </error>
                           </iq>);
        } else if(packet.@type == 'result') {
            var handler = Server.handlers
                .iq[packet.@type][query.namespace().uri];
            if(handler)
                handler.call(this, packet);
        }

        break;
    case 'presence':
        if(packet.@to == undefined) {
            this._user_presence = packet.copy();

            var presenceBounce = packet.copy();
            presenceBounce.@from = this._user_jid;
            presenceBounce.@to = this._user_jid;
            this.route(presenceBounce);
        } else {
            if(packet.@type == 'subscribed') {
                this.route(<iq from={this._jid} to={this._user_jid}
                           id={this._counter++} type='set'>
                           <query xmlns='jabber:iq:roster'>
                           <item jid={packet.@from} subscription='from'/>
                           </query>
                           </iq>);
                let(presence = this._user_presence.copy()) {
                    presence.@from = this._user_jid;
                    presence.@to = packet.@to; // should be sending to bare jid
                    this.route(presence);
                }
            }
        }

        break;
    case 'message':
        break;
    default:
        dump('Warning: invalid packet received: ' + packet.toXMLString() + '\n');
    }        
};


// IQ HANDLERS
// ----------------------------------------------------------------------

Server.handlers = {
    iq: { set: {}, get: {}, result: {} }
};

Server.handlers.iq.get['http://jabber.org/protocol/disco#items'] = function(packet) {
    var query = <query xmlns='http://jabber.org/protocol/disco#items'/>;
    this.forEachService(function(serviceJid) {
        query.appendChild(<item jid={serviceJid}/>);
    });

    this.route(<iq from={this._jid} to={packet.@from} id={packet.@id} type='result'>
               {this.getItems()}
               </iq>);
};

Server.handlers.iq.result['http://jabber.org/protocol/disco#info'] = function(packet) {
    if(!this._identity_cache[packet.@from])
        this._identity_cache[packet.@from] = (packet
                                               .ns_disco_info::query
                                               .ns_disco_info::identity);
};

Server.handlers.iq.get['http://jabber.org/protocol/disco#info'] = function(packet) {
    this.route(<iq from={this._jid} to={this._user_jid}
               id={packet.@id} type='result'>
               <query xmlns='http://jabber.org/protocol/disco#info'>
               <identity category='server' type='im' name='xmpp4moz'/>
               <feature var='http://jabber.org/protocol/disco#info'/>
               <feature var='http://jabber.org/protocol/disco#items'/>
               </query>
               </iq>);
};

Server.handlers.iq.get['http://jabber.org/protocol/disco#info'] = function(packet) {
    this.route(<iq from={this._jid} to={this._user_jid}
               id={packet.@id} type='result'>
               <query xmlns='http://jabber.org/protocol/disco#info'>
               <identity category='server' type='im' name='xmpp4moz'/>
               <feature var='http://jabber.org/protocol/disco#info'/>
               <feature var='http://jabber.org/protocol/disco#items'/>
               </query>
               </iq>);
};

Server.handlers.iq.get['jabber:iq:roster'] = function(packet) {
    _ = this;
    var userJid = JID(packet.@from).address;
    this.forEachService(function(serviceJid) {
        var id = _._counter++;
        if(_.isTransport(serviceJid))
            _.toService(<iq type='get' id={id} to={serviceJid}>
                        <query xmlns={ns_roster_deleg}>
                        <owner jid={userJid}/>
                        </query>
                        </iq>);
    });
    
    this.toClient(<iq to={this._user_jid}
                  id={packet.@id} type='result'>{this._user_roster}</iq>);
}

Server.handlers.iq.set['jabber:iq:roster'] = function(packet) {
    // check for invalid query here...

    var newItem = packet.ns_roster::query.ns_roster::item;
    var oldItem = this._user_roster.ns_roster::item.(@jid == newItem.@jid);

    var push;
    if(newItem.@subscription == 'remove') { // deletion
        // if not olditem, send error
        delete oldItem[0];
        push = newItem.copy();
    }
    else if(oldItem != undefined) { // update
        oldItem.@name = newItem.@name;
        // set groups here...
        push = oldItem.copy();
    }
    else { // addition
        newItem.@subscription = 'none';
        this._user_roster.appendChild(newItem);
        push = newItem.copy();
    }

    this.toClient(<iq to={this._user_jid} id='push' type='set'>
                  <query xmlns='jabber:iq:roster'>{push}</query>
                  </iq>);

    this.toClient(<iq to={this._user_jid} id={packet.@id} type='result'/>);
};

Server.handlers.iq.set['http://hyperstruct.net/xmpp4moz/roster_delegation'] = function(packet) {
    this.route(<iq to={packet.@from} type='result' id={packet.@id}/>);
    var userJid = packet.ns_roster_deleg::query.ns_roster_deleg::owner.@jid;
    
    for each(var item in packet..ns_roster::query.ns_roster::item) {
        this.route(<iq from={this._jid} to={userJid} type='set' id='push'>
                   <query xmlns='jabber:iq:roster'>
                   <item jid={item.@jid} name={item.@name} subscription={item.@subscription}/>
                   </query>
                   </iq>);     
    }
};


// TESTS/SPECIFICATION
// ----------------------------------------------------------------------

Server.test = function() {
    if(!('assert' in this))
        Cc['@mozilla.org/moz/jssubscript-loader;1']
            .getService(Ci.mozIJSSubScriptLoader)
            .loadSubScript('chrome://xmpp4moz/content/lib/test.js');
    
    function MockConnector() {
        this._received = [];
    }
    MockConnector.prototype = {
        fromServer: function(packet) {
            this._received.push(packet);
        }
    };

    var tests = {
        setup: function() {
            this.connector = new MockConnector();
            this.server = new Server('x4m.localhost', 'user@x4m.localhost/Firefox', this.connector);
        },

        // GENERAL SEMANTICS

        'iqs to server with unrecognized query get feature-not-implemented as reply': function() {
            this.server.fromClient(<iq type='get' id='req01'>
                                   <query xmlns='foo:bar'/>
                                   </iq>);
            
            assert.equals([<iq from='x4m.localhost' to='user@x4m.localhost/Firefox'
                           id='req01' type='error'>
                           <error code='501' type='cancel'>
                           <feature-not-implemented xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                           </error></iq>],
                          this.connector._received);
        },

        'When client sends presence, server reflects it back to client': function() {
            this.server.fromClient(<presence/>);
            this.server.fromClient(<presence><show>away</show></presence>);

            assert.equals([<presence from='user@x4m.localhost/Firefox'
                           to='user@x4m.localhost/Firefox'/>,
                           <presence from='user@x4m.localhost/Firefox'
                           to='user@x4m.localhost/Firefox'><show>away</show></presence>],
                          this.connector._received);
        },

        // SERVICE HANDLING

        'Services can be added to server': function() {
            var _ = this;
            
            this.server.addService({
                name: 'echo',
                receive: function(packet) {
                    if(packet.name() == 'message')
                        _.server.fromService(this,
                                             <message to={packet.@from}>
                                             <body>You said: {packet.body.text()}</body>
                                             </message>);
                }
            });
            this.server.fromClient(<message to='echo.x4m.localhost'>
                                   <body>hello!</body>
                                   </message>);

            assert.equals([<message from='echo.x4m.localhost' to='user@x4m.localhost/Firefox'>
                           <body>You said: hello!</body>
                           </message>],
                          this.connector._received)
        },

        'Server prevents adding two services with same name': function() {
            this.server.addService({name: 'foo', receive: function() {}});
            assert.throwsError(function() { this.server.addService({name: 'foo', receive: function(){}}); });
        },

        'When service sends packet with from="foo", server makes that from="foo@service"': function() {
            var _ = this;
            this.server.addService({
                name: 'greet',
                receive: function(packet) {
                    if(packet.name() == 'message' &&
                       packet.@to == 'foo@greet.x4m.localhost') {
                        _.server.fromService(this,
                                             <message from='foo' to={packet.@from}>
                                             <body>Hello from foo</body>
                                             </message>);
                    }
                }
            });

            this.server.fromClient(<message to='foo@greet.x4m.localhost'>
                                   <body>hello!</body>
                                   </message>);

            assert.equals([<message from='foo@greet.x4m.localhost' to='user@x4m.localhost/Firefox'>
                           <body>Hello from foo</body>
                           </message>],
                          this.connector._received);
        },

        // ROSTER MANAGEMENT PROTOCOL
        
        'Client can retrieve its roster': function() {
            this.server.fromClient(<iq type='get' id='rost01'>
                                   <query xmlns='jabber:iq:roster'/>
                                   </iq>);

            assert.equals([<iq from='x4m.localhost' to='user@x4m.localhost/Firefox'
                           id='rost01' type='result'>
                           <query xmlns='jabber:iq:roster'/>
                           </iq>],
                          this.connector._received);
        },

        'Client can manage its add and delete to its roster': function() {
            this.server.fromClient(<iq type='set' id='rost01'>
                                   <query xmlns='jabber:iq:roster'>
                                   <item jid='foo@service.x4m.localhost'/>
                                   </query>
                                   </iq>);
            this.server.fromClient(<iq type='set' id='rost02'>
                                   <query xmlns='jabber:iq:roster'>
                                   <item jid='bar@service.x4m.localhost'/>
                                   </query>
                                   </iq>);
            this.server.fromClient(<iq type='set' id='rost03'>
                                   <query xmlns='jabber:iq:roster'>
                                   <item jid='foo@service.x4m.localhost' subscription='remove'/>
                                   </query>
                                   </iq>);
            this.server.fromClient(<iq type='get' id='rost04'>
                                   <query xmlns='jabber:iq:roster'/>
                                   </iq>);

            assert.equals([<iq from='x4m.localhost' to='user@x4m.localhost/Firefox'
                           id='push' type='set'>
                           <query xmlns='jabber:iq:roster'>
                           <item subscription='none' jid='foo@service.x4m.localhost'/>
                           </query>
                           </iq>,
                           <iq from='x4m.localhost' to='user@x4m.localhost/Firefox'
                           id='rost01' type='result'/>, 
                           <iq from='x4m.localhost' to='user@x4m.localhost/Firefox'
                           id='push' type='set'>
                           <query xmlns='jabber:iq:roster'>
                           <item subscription='none' jid='bar@service.x4m.localhost'/>
                           </query>
                           </iq>,
                           <iq from='x4m.localhost' to='user@x4m.localhost/Firefox'
                           id='rost02' type='result'/>,
                           <iq from='x4m.localhost' to='user@x4m.localhost/Firefox'
                           id='push' type='set'>
                           <query xmlns='jabber:iq:roster'>
                           <item subscription='remove' jid='foo@service.x4m.localhost'/>
                           </query>
                           </iq>,
                           <iq from='x4m.localhost' to='user@x4m.localhost/Firefox'
                           id='rost03' type='result'/>,
                           <iq from='x4m.localhost' to='user@x4m.localhost/Firefox'
                           id='rost04' type='result'>
                           <query xmlns='jabber:iq:roster'>
                           <item subscription='none' jid='bar@service.x4m.localhost'/>
                           </query>
                           </iq>],
                          this.connector._received);
        },

        'Client can subscribe to presence of services': function() {
            var _ = this;
            this.server.addService({
                name: 'service',
                receive: function(packet) {
                    if(packet.name() == 'presence' && packet.@type == 'subscribe') {
                        _.server.fromService(this,
                                             <presence to={packet.@from} type='subscribed'/>);
                    }
                }
            });

            this.server.fromClient(<presence to='service.x4m.localhost' type='subscribe'/>);

            assert.equals([<iq from='x4m.localhost' to='user@x4m.localhost/Firefox'
                           type='set' id='1001'>
                           <query xmlns='jabber:iq:roster'>
                           <item jid='service.x4m.localhost' subscription='none'
                           ask='subscribe'/>
                           </query>
                           </iq>,
                           <iq from='x4m.localhost' to='user@x4m.localhost/Firefox'
                           type='set' id='1002'>
                           <query xmlns='jabber:iq:roster'>
                           <item jid='service.x4m.localhost' subscription='to'/>
                           </query>
                           </iq>,                        
                           <presence from='service.x4m.localhost'
                           to='user@x4m.localhost' type='subscribed'/>,
                           <presence from='service.x4m.localhost'
                           to='user@x4m.localhost/Firefox'/>],
                          this.connector._received);
        },

        'Service can subscribe to presence of client': function() {
            var _ = this;
            var service = {
                name: 'service',
                receive: function(packet) {
                    this._received.push(packet);
                },
                _received: []
            };
            this.server.addService(service);

            this.server.fromClient(<presence/>);
            this.server.fromService(service,
                                    <presence to='user@x4m.localhost' type='subscribe'/>);
            this.server.fromClient(<presence to='service.x4m.localhost' type='subscribed'/>);

            assert.equals([<presence from='user@x4m.localhost/Firefox'
                           to='user@x4m.localhost/Firefox'/>,
                           <presence from='service.x4m.localhost' to='user@x4m.localhost'
                           type='subscribe'/>,
                           <iq from='x4m.localhost' to='user@x4m.localhost/Firefox'
                           type='set' id='1001'>
                           <query xmlns='jabber:iq:roster'>
                           <item jid='service.x4m.localhost' subscription='from'/>
                           </query>
                           </iq>],
                          this.connector._received);

            assert.equals([<iq from='x4m.localhost' to='service.x4m.localhost'
                           type='get' id='1000'>
                           <query xmlns='http://jabber.org/protocol/disco#info'/></iq>,
                           <presence from='user@x4m.localhost' to='service.x4m.localhost'
                           type='subscribed'/>,
                           <presence from='user@x4m.localhost/Firefox'
                           to='service.x4m.localhost'/>],
                          service._received);

        }
    };

    return runTests(tests);
    return runTests({
        setup: tests.setup,
        'Service can subscribe to presence of client': tests['Service can subscribe to presence of client']
    })

};

Server.test();


// ATTIC
// ----------------------------------------------------------------------

// Server.prototype.mergeRoster = function(rosterQuery) {
//     var diff;
//     [this._roster, diff] = Server.mergeRoster(this._roster, rosterQuery);
// };

// Server.mergeRoster = function(oldRoster, rosterChanges) {
//     var newRoster = oldRoster.copy();
//     var diff = [];
//     for each(var changeItem in rosterChanges.ns_roster::item) {
//         var item = newRoster.ns_roster::item.(@jid == changeItem.@jid);
//         if(item != undefined && changeItem.@subscription == 'remove') {
//             diff.push(changeItem);
//             delete item[0];
//         }
//         else if(item == undefined) {
//             diff.push(changeItem);
//             newRoster.appendChild(changeItem);
//         }
//         else {
//             if(changeItem.@name != undefined)
//                 item.@name = changeItem.@name;
//             if(changeItem.@subject != undefined)
//                 item.@subscription = changeItem.@subscription;
//             diff.push(item);
//         }
//     }
//     return [newRoster, diff];
// };

//         'Can merge roster with externally provided one': function() {
//             XML.ignoreWhitespace = true; XML.prettyPrinting = false;

//             var roster, diff;
//             roster =
//                 <query xmlns='jabber:iq:roster'>
//                 <item jid='ford@betelgeuse.org' subscription='both'/>
//                 <item jid='arthur@earth.org' subscription='both'/>
//                 </query>;

//             [roster, diff] = Server
//                 .mergeRoster(roster,
//                              <query xmlns='jabber:iq:roster'>
//                              <item jid='marvin@spaceship.org' subscription='both'/>
//                              </query>);
            
//             assert.equals(<query xmlns='jabber:iq:roster'>
//                           <item jid='ford@betelgeuse.org' subscription='both'/>
//                           <item jid='arthur@earth.org' subscription='both'/>
//                           <item jid='marvin@spaceship.org' subscription='both'/>
//                           </query>,
//                           roster);

//             assert.equals([<item xmlns={ns_roster}
//                            jid='marvin@spaceship.org'
//                            subscription='both'/>], diff);

//             [roster, diff] = Server
//                 .mergeRoster(roster,
//                              <query xmlns='jabber:iq:roster'>
//                              <item jid='marvin@spaceship.org' subscription='remove'/>
//                              </query>);

//             assert.equals(<query xmlns='jabber:iq:roster'>
//                           <item jid='ford@betelgeuse.org' subscription='both'/>
//                           <item jid='arthur@earth.org' subscription='both'/>
//                           </query>,
//                           roster);

//             assert.equals([<item xmlns='jabber:iq:roster' jid='marvin@spaceship.org'
//                            subscription='remove'/>],
//                           diff);

//             [roster, diff] =
//                 Server.mergeRoster(roster,
//                                    <query xmlns='jabber:iq:roster'>
//                                    <item jid='arthur@earth.org' name='Arthur'/>
//                                    </query>);

//             assert.equals(<query xmlns='jabber:iq:roster'>
//                           <item jid='ford@betelgeuse.org' subscription='both'/>
//                           <item jid='arthur@earth.org' name='Arthur' subscription='both'/>
//                           </query>,
//                           roster);

//             assert.equals([<item xmlns='jabber:iq:roster' jid='arthur@earth.org'
//                            name='Arthur' subscription='both'/>],
//                           diff);
//         }

        // ROSTER DELEGATION PROTOCOL

//         'When client requests roster, server also forwards request to transport services': function() {
//             return;
//             var _ = this;
//             this.server.addService({
//                 name: 'transport',
//                 receive: function(packet) {
//                     if(packet.name() == 'presence') {
//                         // transport logs in to remote service...
                        
//                         reply.@type = 'result';
//                         reply.@to = packet.@from;
//                         reply.@id = packet.@id;
//                         reply.ns_roster_deleg::query.appendChild(this._roster);
//                         _.server.fromService(this,
//                                              <iq type='set' id='deleg01' to='x4m.localhost'>
//                                              <query xmlns={ns_roster_deleg}>
//                                              <owner jid='user@x4m.localhost'/>
//                                              {this._roster}
//                                              </query>
//                                              </iq>);
//                     }
//                 },
//                 _roster:
//                     <query xmlns='jabber:iq:roster'>
//                     <item jid='foo@transport.x4m.localhost' name='Foo' subscription='both'/>
//                     </query>,
//             });
            
//             this.server.fromClient(<presence/>);

//             assert.equals([<iq to='user@x4m.localhost' from='x4m.localhost' type='set' id='push'>
//                            <query xmlns='jabber:iq:roster'>
//                            <item jid='foo@transport.x4m.localhost' name='Foo' subscription='both'/>
//                            </query>
//                            </iq>,
//                            <iq to='user@x4m.localhost' id='rost01' type='result' from='x4m.localhost'>
//                            <query xmlns='jabber:iq:roster'/>
//                            </iq>],
//                            this.connector._received);
//         }
