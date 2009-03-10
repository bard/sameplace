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


window.addEventListener('load', function() {
    const ns_x4m_ext = 'http://hyperstruct.net/xmpp4moz/protocol/external';

    sameplace.channel.on({
        event     : 'message',
        stanza    : function(s) {
            return (s.ns_x4m_ext::share != undefined &&
                    s.@type != 'error');
        }
    }, function(message) {
        if(window == sameplace.getMostRecentWindow('navigator:browser'))
            sameplace.seenSharedAppNegotiation(message);
    });
}, false);

sameplace.seenSharedAppNegotiation = function(message) {
    const ns_x4m_ext = 'http://hyperstruct.net/xmpp4moz/protocol/external';
    
    if(!('addTab' in getBrowser()))
        return;

    var url = message.stanza.ns_x4m_ext::share.@url;
    var xulNotify = getBrowser().getNotificationBox();
    if(!xulNotify)
        return;

    function interact(account, address, url, panel, nextAction) { // XXX duplicated
        if(account)
            dump('**** SamePlace **** Deprecation **** ' + getStackTrace() + '\n');
        if(address)
            dump('**** SamePlace **** Deprecation **** ' + getStackTrace() + '\n');

        // XXX these are set here and re-set in XMPP.connectPanel().
        // find out why it wasn't enough to set them in
        // XMPP.connectPanel() only.
        var account = panel.getAttribute('account');
        var address = panel.getAttribute('address');

        function activate() {
            XMPP.connectPanel(panel, account, address, /^javascript:/.test(url));
        }

        nextAction = nextAction || function() {};

        if(!url) {
            activate();
            nextAction();
        }
        else if(url.match(/^javascript:/)) {
            panel.loadURI(url);
            activate();
            nextAction();
        }
        else {
            afterLoad(panel, function(panel) {
                activate();
                nextAction();
            });
            panel.setAttribute('src', url);
        }
    }

    function afterLoad(panel, action) { // XXX duplicated
        // catch the load event of panel's document in capturing
        // phase. then catch the load event of the contained window in
        // bubbling phase (we can't do this before there's a window,
        // obviously.)

        panel.addEventListener('load', function(event) {
            if(event.target != panel.contentDocument)
                return;
            panel.removeEventListener('load', arguments.callee, true);
            
            // The following appears not to work if reference to
            // panel is not the one carried by event object.
            panel = event.currentTarget;
            panel.contentWindow.addEventListener('load', function(event) {
                action(panel);
            }, false);
        }, true);
    }

    function onAccept() {
        XMPP.send(message.account,
                  <message to={message.stanza.@from}>
                  <share xmlns={ns_x4m_ext} response='accept' url={url}/>
                  </message>);

        if(!(url.match(/^javascript:/) || getBrowser().currentURI.spec == 'about:blank'))
            getBrowser().selectedTab = getBrowser().addTab();
        
        var panel = getBrowser().selectedBrowser;
        panel.setAttribute('account', message.account);
        panel.setAttribute('address', XMPP.JID(message.stanza.@from).address);
        interact(null, null, url == 'current' ? null : url, panel);
    }

    function onDecline() {
        XMPP.send(message.account,
                  <message to={message.stanza.@from}>
                  <share xmlns={ns_x4m_ext} response='decline' url={url}/>
                  </message>);
    }

    if(message.direction == 'in') {
        switch(message.stanza.ns_x4m_ext::share.@response.toString()) {
        case '':
            var strings = document.getElementById('sameplace-strings');
            // it's a request
            xulNotify.appendNotification(
                strings.getFormattedString('notification.sharedAppInvitation.message',
                                           [message.stanza.@from, url]),
                'sameplace-shareapp-request',
                null, xulNotify.PRIORITY_INFO_HIGH,
                [{label: strings.getString('notification.sharedAppInvitation.accept.label'),
                  accessKey: strings.getString('notification.sharedAppInvitation.accept.accesskey'),
                  callback: onAccept},
                 {label: strings.getString('notification.sharedAppInvitation.decline.label'),
                  accessKey: strings.getString('notification.sharedAppInvitation.decline.accesskey'),
                  callback: onDecline}]);
            break;
        case 'accept':
            xulNotify.appendNotification(
                message.stanza.@from + ' accepted to interact on ' + url,
                    'sameplace-shareapp-request',
                null, xulNotify.PRIORITY_INFO_HIGH);
            break;
        case 'decline':
            xulNotify.appendNotification(
                message.stanza.@from + ' declined to interact on ' + url,
                    'sameplace-shareapp-request',
                null, xulNotify.PRIORITY_INFO_HIGH);
            break;
        }
    }
}
