/*
 * Copyright 2008-2009 by Massimiliano Mirra
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

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var Cu = Components.utils;

Cu.import('resource://xmpp4moz/xmpp.jsm');
Cu.import('resource://xmpp4moz/namespaces.jsm');
Cu.import('resource://xmpp4moz/task.jsm');
Cu.import('resource://xmpp4moz/json.jsm');
Cu.import('resource://sameplace/main.jsm');
Cu.import('resource://sameplace/util.jsm');


// DEFINITIONS
// ----------------------------------------------------------------------

var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.panel.stream.');


// STATE
// ----------------------------------------------------------------------

var channel, view, store;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    channel = XMPP.createChannel();
    store = JSON.parse(pref.getCharPref('store'));

    // Since the view's load event handler is going to use
    // configuration data, we need to get there before it does to load
    // the data, thus we watch the DOMContentLoaded event instead of
    // the load event.
    $('#stream').addEventListener('DOMContentLoaded', loadedView, true);
    $('#stream').addEventListener('click', clickedView, true);
    $('#stream').contentDocument.location.href = 'resource://sameplace/stream/stream.xhtml';
}

function loadedView(event) {
    // Handle the load event only once.
    $('#stream').removeEventListener('DOMContentLoaded', loadedView, true);

    view = event.currentTarget.contentWindow;

    channel.on(function(ev) (ev.name == 'message' &&
                             ev.xml.body != undefined),
               function(message) forwardEvent(message));

    channel.on(function(ev) (ev.name == 'presence' &&
                             ev.xml.status.text() != undefined),
               function(presence) forwardEvent(presence));

    // XXX should stream view get this for itself?

    // XMPP.accounts.forEach(function(account) {
    //     XMPP.send(account,
    //               <iq type='get'>
    //               <query xmlns={ns_roster}/>
    //               <cache-control xmlns={ns_x4m_in}/>
    //               </iq>,
    //               forwardEvent);
    // });

    view.addEventListener('custom/sendxmpp', function(event) {
        var stanza = new XML(event.target.textContent);
        var account = stanza.ns_x4m_in::meta.@account.toString();
        delete stanza.ns_x4m_in::meta;

        // if(XMPP.isUp(account)) {
            if(stanza.name() == 'iq')
                XMPP.send(account, stanza, function(reply) forwardEvent(reply));
            else
                XMPP.send(account, stanza);
        // } else {
        //     var reply = stanza.copy();
        //     reply.@type = 'error';
        //     reply.error =
        //         <error type='cancel'>
        //         <service-unavailable xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
        //         </error>;
        //     forwardEvent(reply);
        // }
    }, false);

    view.addEventListener('custom/store/save', function(event) {
        var object = JSON.parse(event.target.textContent);
        store[object._id] = object;
        pref.setCharPref('store', JSON.stringify(store));
    }, false);

    var store = JSON.parse(pref.getCharPref('store'));
    for(let key in store) {
        let storageNode = view.document.getElementById('storage-' + key);
        storageNode.textContent = JSON.stringify(store[key]);

        let updateEvent = view.document.createEvent('Event');
        updateEvent.initEvent('custom/store/update', true, false);
        storageNode.dispatchEvent(updateEvent);
    }

    // function onBlur(event) {
    //     dump('here: ' + event.target + ':'  + top.document.hasFocus() + '\n');
    //     if('location' in event.target)
    //         dump(event.target.location.href + '\n')

    //     if('location' in event.target &&
    //        event.target.location.href == top.document.location.href) {
    //         var blurEvent = document.createEvent('Event');
    //         blurEvent.initEvent('custom/blur', true, false);
    //         view.dispatchEvent(blurEvent);
    //     }
    // }
    // top.addEventListener('blur', onBlur, true);

    // function onResize(event) {
    //     dump('minimized!\n');
    // }
    // top.addEventListener('resize', onResize, false);

    // window.addEventListener('unload', function() {
    //     top.removeEventListener('resize', onResize, false);
    //     top.removeEventListener('blur', onBlur, true);
    // }, false);
}

// FINALIZATION
// ----------------------------------------------------------------------

function finish() {
    channel.release();
}


// REACTIONS
// ----------------------------------------------------------------------

function clickedView(event) {
    if(event.button != 0)
        return;

    var htmlAnchor =
        event.target instanceof HTMLAnchorElement ?
        event.target : (event.target.parentNode instanceof HTMLAnchorElement ?
                        event.target.parentNode : null);

    if(htmlAnchor && htmlAnchor.getAttribute('href') != '#') {
        event.preventDefault();
        util.openURL(htmlAnchor.href);
    }
}

// ACTIONS
// ----------------------------------------------------------------------

function forwardEvent(packet) {
    view.postMessage(packet.stanza, '*');
}


// LAB AREA
// ----------------------------------------------------------------------

// Temporary.  Under consideration for inclusion in xmpp.js, possibly
// with task() or XMPP.task().  Connection control part under
// consideration for inclusion in client_service.js

XMPP.req = function(account, stanza) {
    return function(resume) {
        XMPP.sendPseudoSync(account, stanza, function(reply) resume(reply));
    }
};

XMPP.sendPseudoSync = function(account, stanza, replyHandler) {
    var connectionControl = stanza.ns_x4m_in::connection.@control.toString();

    if(XMPP.isDown(account) && !connectionControl)
        XMPP.send(account, stanza, replyHandler);
    else switch(connectionControl) {
    case 'cache,offline':
        var tmp = stanza.copy();
        delete tmp.ns_x4m_in::*;
        // Per RFC-3920, iq's of type="get" must contain only one
        // (namespaced) child indicating the semantics of the
        // request, thus we assume that once we've removed our
        // non-standard control element, we are left with the
        // semanticts-indicating child only.
        var child = tmp.*;

        var reply = XMPP.cache.first(
            XMPP.q()
                .event('iq')
                .account(account)
                .from(stanza.@to)
                .type('result')
                .direction('in')
                .child(child.namespace().toString(), child.name().localName));

        if(reply)
            replyHandler(reply);
        else {
            var replyStanza = stanza.copy();
            replyStanza.@type = 'error';
            replyStanza.appendChild(<error xmlns={ns_x4m_in} type='ondemand-connection-refused'/>);
            replyStanza.appendChild(<meta xmlns={ns_x4m_in} account={account} direction='in'/>);
            replyHandler(XMPP.packet(replyStanza));
        }

        break;
    case 'cache':
    case 'cache,connect':
        // TODO throw error if it's not an iq or if it's an iq-set
        // TODO investigate HTTP criteria for caching, they should be
        // similar

        var tmp = stanza.copy();
        delete tmp.ns_x4m_in::*;
        // Per RFC-3920, iq's of type="get" must contain only one
        // (namespaced) child indicating the semantics of the
        // request, thus we assume that once we've removed our
        // non-standard control element, we are left with the
        // semanticts-indicating child only.
        var child = tmp.*;

        var reply = XMPP.cache.first(
            XMPP.q()
                .event('iq')
                .account(account)
                .from(stanza.@to)
                .type('result')
                .direction('in')
                .child(child.namespace().toString(), child.name().localName));

        if(reply)
            replyHandler(reply);
        else {
            if(connectionControl == 'cache') {
                var replyStanza = tmp;
                replyStanza.@type = 'error';
                replyStanza.appendChild(<error xmlns={ns_x4m_in} type='cache-miss'/>);
                replyStanza.appendChild(<meta xmlns={ns_x4m_in} account={account} direction='in'/>);
                replyHandler(XMPP.packet(replyStanza));
            }
            else
                XMPP.send(account, stanza, replyHandler);
        }
    }
};

XMPP.packet = function(xmlStanza) {
    return {
        get direction() {
            return xmlStanza.ns_x4m_in::meta.@direction.toString();
        },

        get account() {
            return xmlStanza.ns_x4m_in::meta.@account.toString();
        },

        get stanza() {
            return xmlStanza;
        },

        get event() {
            return xmlStanza.name().localName;
        }
    }
};
