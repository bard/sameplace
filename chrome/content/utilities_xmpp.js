/*
  Copyright (C) 2005-2006 by Massimiliano Mirra

  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 2 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software
  Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301 USA

  Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
*/


function isMUC(account, address) {
    var ns_muc = 'http://jabber.org/protocol/muc';
    var ns_private = 'jabber:iq:private';
    var ns_bookmarks = 'storage:bookmarks';

    return XMPP.cache.fetch({
        event     : 'presence',
        direction : 'out',
        account   : account,
        stanza    : function(s) {
                return (s.@to != undefined &&
                        XMPP.JID(s.@to).address == address &&
                        s.ns_muc::x != undefined);
            }}).length > 0 ||
        XMPP.cache.fetch({
            event     : 'iq',
            direction : 'in',
            account   : account,
            stanza    : function(s) {
                    return (s.ns_private::query
                            .ns_bookmarks::storage
                            .ns_bookmarks::conference
                            .(@jid == address) != undefined);
                }}).length > 0;
}

function displayNameFor(presence) {
   var memo = arguments.callee.memo || (arguments.callee.memo = {});
   var stanzaString = presence.stanza.toXMLString();

   if(!memo[stanzaString]) 
       memo[stanzaString] =
           (presence.stanza.ns_muc::x == undefined ?
            XMPP.nickFor(presence.account, XMPP.JID(presence.stanza.@from).address) :
            XMPP.JID(presence.stanza.@to).address);
    
    return memo[stanzaString];
}

function contactCompletionsFor(substring) {
    function presenceDegree(stanza) {
        if(stanza.@type == undefined && stanza.show == undefined)
            return 4;
        else if(stanza.@type == 'unavailable')
            return 0;
        else
            switch(stanza.show.toString()) {
            case 'chat': return 5; break;
            case 'dnd':  return 3; break;
            case 'away': return 2; break;
            case 'xa':   return 1; break;
            default:
                throw new Error('Unexpected. (' + stanza.toXMLString() + ')');
            }
    }

    var completions = [];

    // Look for completions in roster

    XMPP.cache.fetch({
        event     : 'iq',
        direction : 'in',
        stanza    : function(s) { return s.ns_roster::query != undefined; }})
        .forEach(
            function(iq) {
                for each(var item in iq.stanza..ns_roster::item) {
                    var account = iq.session.name;
                    var address = item.@jid;
                    var nick    = XMPP.nickFor(account, address);
                    if(nick.toLowerCase().indexOf(substring.toLowerCase()) == 0)
                        completions.push(XMPP.presenceSummary(account, address));
                }                     
            });

    // Look for completions in outgoing MUC presences (i.e. active rooms)

    XMPP.cache.fetch({
        event     : 'presence',
        direction : 'out',
        stanza    : function(s) { return s.ns_muc::x != undefined; }
        }).forEach(
            function(presence) {
                var account = presence.session.name;
                var address = XMPP.JID(presence.stanza.@to).address;
                if(address.toLowerCase().indexOf(substring.toLowerCase()) == 0)
                    completions.push(presence);
            });
        
    completions.sort(
        function(a, b) {
            // Primary sort by presence, secondary by name

            var diff = presenceDegree(b.stanza) - presenceDegree(a.stanza);
            if(diff == 0)
                diff = (displayNameFor(a).toLowerCase() < displayNameFor(b).toLowerCase()) ? -1 : 1;
            return diff;
        });

    return completions;
}

function isMUCJoined(account, address) {
    var presence = XMPP.cache.fetch({
        account   : account,
        event     :'presence',
        direction : 'out',
        stanza    : function(s) {
                return s.@to != undefined &&
                    XMPP.JID(s.@to).address == address;
            }})[0];

    if(presence)
        if(presence.stanza.@type == undefined)
            return true;
        else if(presence.stanza.@type == 'unavailable')
            return false;
        else
            throw new Error('Unexpected. (' + presence.stanza.toXMLString() + ')');
    else
        return false;
}

function getMUCBookmarks(account) {
    var iq = XMPP.cache.fetch({
        event     : 'iq',
        direction : 'in',
        account   : account,
        stanza    : function(s) {
                return s.ns_private::query.ns_bookmarks::storage != undefined;
            }})[0];

    if(iq)
        return iq.stanza.ns_private::query.copy();
}

function isMUCBookmarked(account, address) {
    var query = getMUCBookmarks(account);
    var bookmark = query.ns_bookmarks::storage.ns_bookmarks::conference.(@jid == address);
    return bookmark != undefined;
}

