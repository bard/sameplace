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


window.addEventListener('load', function(event) {
    const ns_http_auth  = 'http://jabber.org/protocol/http-auth';
    
    channel.on({
        event     : 'connector',
        state     : 'active'
    }, function(connector) {
        if(isCollapsed())
            toCompact();
    });

    channel.on({
        event     : 'message',
        direction : 'in',
        stanza    : function(s) {
            // Allow non-error messages with readable body [1] or
            // error messages in general [2] but not auth requests [3]
            return (((s.@type != 'error' && s.body.text() != undefined) || // [1]
                     (s.@type == 'error')) && // [2]
                    (s.ns_http_auth::confirm == undefined)) // [3]
            }
    }, function(message) {
        if(!_('button'))
            return;
        if(!hostsConversations())
            return;
        if(isCompact() || isCollapsed())
            _('button').setAttribute('pending-messages', 'true');
    });

    // In page context menu (if available), only display the "install
    // scriptlet" option if user clicked on what could be a scriptlet.

    var pageMenu = document.getElementById('contentAreaContextMenu');
    if(pageMenu) {
        pageMenu.addEventListener('popupshowing', function(event) {
            _('install-scriptlet').hidden = !isJavaScriptLink(document.popupNode);
        }, false);
    }

    // What's a man to do to keep things decoupled...  What we're
    // doing here is basically "pop sidebar open when conversation
    // opens, but ONLY if conversation opened as a result of user
    // clicking on a contact", and the way we find out that is by
    // checking whether conversation opened within two seconds
    // from user clicking on the contact.
    
    var whenDidUserClickOnContact = 0;
    _('frame').addEventListener('contact/select', function(event) {
        if(!isCompact()) return;
        whenDidUserClickOnContact = Date.now();
    }, false);
    _('frame').addEventListener('conversation/open', function(event) {
        if(!isCompact()) return;
        if(Date.now() - whenDidUserClickOnContact < 2000)
            toExpanded();
    }, false);

    _('frame').addEventListener('detach', function(event) {
        var wndContacts = window.open(
            'chrome://sameplace/content/experimental/contacts.xul',
            'SamePlace:Contacts', 'chrome');
        wndContacts.addEventListener('unload', function(event) {
            if(event.target == wndContacts.document &&
               event.target.location.href != 'about:blank') {
                loadAreas();
                toCompact();
            }
        }, false);
        _('frame').contentDocument.location.href = 'about:blank';
        toCollapsed();
    }, false);    
}, false);

function hostsContacts() {
    return _('frame').contentDocument.location.href != 'about:blank';
}

function hostsConversations() {
    var chatOverlayName = util.getChatOverlayName();
    return (hostsContacts() &&
            (chatOverlayName == 'sidebar' ||
             chatOverlayName == 'messagepane'));
}

function toggle() {
    if(isCollapsed())
        toExpanded();
    else if(isCompact())
        toCollapsed();
    else
        toCompact();
}

function isCompact() {
    return _('box').width == _('box').getAttribute('minwidth');
}

function isCollapsed() {
    return _('box').collapsed;
}

function toCompact() {
    if(_('box').collapsed)
        _('box').collapsed = false;
    else
        _('box').__restore_width = _('box').width;
    _('box').width = _('box').getAttribute('minwidth');

    if(_('button')) // XXX verify whether this actually makes sense.
        _('button').removeAttribute('pending-messages');
}

function toCollapsed() {
    _('box').collapsed = true;
}

function toExpanded() {
    loadAreas();
    _('box').collapsed = false;
    if(_('box').__restore_width)
        _('box').width = _('box').__restore_width;
    else
        _('box').width = 300;
    
    if(_('button'))
        _('button').removeAttribute('pending-messages');
}

function displayContacts() {
    // XXX won't work for external
    toExpanded();
}

function getContacts() {
    // XXX won't work for external
    _('frame').contentWindow.requestedToggleFilter();
}
