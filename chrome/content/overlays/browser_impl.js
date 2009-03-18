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
        if(isHidden())
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
}, false);


// HACK: hot-patch toggleSidebar() so that when Firefox 'regular'
// sidebar is open, SamePlace is closed.  Inverse is in show().

if(pref.getCharPref('openMode') == 'sidebar') {
    window.__wrapped_by_sameplace_toggleSidebar = toggleSidebar;
    window.toggleSidebar = function() {
        if(!sameplace.isHidden())
            sameplace.hide();
        window.__wrapped_by_sameplace_toggleSidebar.apply(null, arguments);
    }
}

function toggle() {
    if(isHidden())
        show();
    else
        hide();
}

function isHidden() {
    switch(pref.getCharPref('openMode')) {
    case 'standalone':
        return getMostRecentWindow('SamePlace') == null;
        break;
    case 'sidebar':
        return _('box').collapsed;
        break;
    }
}

function hide() {
    switch(pref.getCharPref('openMode')) {
    case 'standalone':
        break;
    case 'sidebar':
        _('box').collapsed = true;
        break;
    }
}

function show() {
    switch(pref.getCharPref('openMode')) {
    case 'standalone':
        let spWindow = getMostRecentWindow('SamePlace');
        if(spWindow)
            spWindow.focus();
        else
            window.open('chrome://sameplace/content/standalone.xul', 'SamePlace', 'chrome');
        break;
    case 'sidebar':
        loadAreas();
        if(!document.getElementById('sidebar-box').hidden)
            toggleSidebar();
        _('box').collapsed = false;

        if(_('button'))
            _('button').removeAttribute('pending-messages');
        break;
    }
}
