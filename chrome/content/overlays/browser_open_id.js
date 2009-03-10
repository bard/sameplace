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

    sameplace.channel.on({
        event     : 'message',
        direction : 'in',
        stanza    : function(s) {
            return s.ns_http_auth::confirm != undefined;
        }
    }, function(message) {
        if(window == sameplace.getMostRecentWindow())
            sameplace.receivedAuthConfirmRequest(message);
    });
}, false);

sameplace.receivedAuthConfirmRequest = function(message) {
    const ns_http_auth  = 'http://jabber.org/protocol/http-auth';

    var request = message.stanza;

    var response =
        <message to={request.@from}>
        <confirm xmlns={ns_http_auth}
    method={request.ns_http_auth::confirm.@method}
    url={request.ns_http_auth::confirm.@url}
    id={request.ns_http_auth::confirm.@id}/>
        </message>;

    function onDeny() {
        response.@type = 'error';
        response.error =
            <error code="401" type="auth">
            <not-authorized xmlns="urn:ietf:params:xml:xmpp-stanzas"/>
            </error>;
        XMPP.send(message.account, response);
    }

    function onAuthorize() {
        XMPP.send(message.account, response)
    }

    var strings = document.getElementById('sameplace-strings');
    var userMessage = strings.getFormattedString(
        'notification.openIDRequest.message', [
            request.ns_http_auth::confirm.@url,
            request.@to,
            request.ns_http_auth::confirm.@id]);

    var xulNotify = getBrowser().getNotificationBox();
    if(xulNotify) {
        xulNotify.appendNotification(
            userMessage, 'sameplace-auth-confirm',
            null, xulNotify.PRIORITY_INFO_HIGH,
            [{label: strings.getString('notification.openIDRequest.confirm.label'),
              accessKey: strings.getString('notification.openIDRequest.confirm.accesskey'),
              callback: onAuthorize},
             {label: strings.getString('notification.openIDRequest.deny.label'),
              accessKey: strings.getString('notification.openIDRequest.deny.accesskey'),
              callback: onDeny}]);
    } else {
        if(window.confirm(userMessage))
            onAuthorize();
        else
            onDeny();
    }
}
