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


// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

with(Cc['@mozilla.org/moz/jssubscript-loader;1']
     .getService(Ci.mozIJSSubScriptLoader))
    loadSubScript('chrome://xmpp4moz/content/lib/misc.js');

load('chrome://sameplace/content/connectors/virtual_server.js', ['Server']);
load('chrome://sameplace/content/connectors/service_twitter.js', ['Twitter']);
load('chrome://sameplace/content/connectors/service_echo.js', ['Echo']);


// INITIALIZATION
// ----------------------------------------------------------------------

function init(userJid, password) {
    this._jid = userJid;
    this._server = new Server('x4m.localhost', this._jid, this);
    this._server.addService(new Twitter(this._server));
    this._server.addService(new Echo(this._server));
}


// PUBLIC INTERFACE
// ----------------------------------------------------------------------

function setSession(session) {
    this._session = session;
}

function connect() {
    if(this.isConnected())
        return;

    this.setState('connecting');
    this.setState('authenticating');
    this.setState('active');
}

function disconnect() {
    if(!this.isConnected())
        return;

    this.setState('disconnected');
}

function isConnected() {
    return (this._state == 'authenticating' ||
            this._state == 'active');
}

function send(element) {
    this.toServer(element);
}


// COMMON TO CONNECTORS
// ----------------------------------------------------------------------

function addObserver(observer) {
    if(!this._observers)
        this._observers = [];
    this._observers.push(observer);    
}

function notifyObservers(s, topic, data) {
    var subject;
    if(typeof(s) == 'string') {
        subject = Cc['@mozilla.org/supports-string;1']
            .createInstance(Ci.nsISupportsString);
        subject.data = s;
    } else
        subject = s;

    for each(var observer in this._observers) {
        try {
            observer.observe(subject, topic, data);
        } catch(e) {
            Cu.reportError(e);
        }
    }
}

function removeObserver(observer) {
    var index = this._observers.indexOf(observer);
    if(index != -1) 
        this._observers.splice(index, 1);    
}


// INTERNALS
// ----------------------------------------------------------------------

function setState(name) {
    this._state = name;
    this.notifyObservers(name, 'connector', null);
}

function toServer(dom) {
    this._server.fromClient(asXML(dom));
}

function fromServer(xml) {
    this._session.receive(asDOM(xml));
}

