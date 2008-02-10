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


function commandFilter(message) {
    if(message.body == undefined)
        return message;
    
    var match = message.body.toString().match(/^\/(\w+)($|\s.+$)/);
    if(!match)
        return message;

    var [_, commandName, argstring] = match;

    if(commandName in commands)
        return commands[commandName].call(null, argstring);
    else
        return message;
}

var commands = {
    'topic': function(argstring) {
        if(!isGroupchat)
            return;

        return (<message type="groupchat">
                <subject>{argstring}</subject>
                </message>);
    },

    'kick': function(argstring) {
        if(!isGroupchat)
            return;

        var nick = $.trim(argstring);

        return (<iq type="set">
                <query xmlns='http://jabber.org/protocol/muc#admin'>
                <item nick={nick} role='none'/>
                </query>
                </iq>) 
    },

    'nick': function(argstring) {
        if(!isGroupchat)
            return;

        var nick = $.trim(argstring);

        // payload isn't required by protocol, but it's currently
        // needed by xmpp4moz for correct bookkeeping of the cache.
        return <presence to={"/" + nick}>
            <x xmlns="http://jabber.org/protocol/muc"/>
            </presence>;
    },

    // XXX does not support XHTML messages yet
    
    'msg': function(argstring) {
        if(!isGroupchat)
            return;
        
        var match = argstring.match(/^\s*([^\s]+)\s+(.+)$/);
        if(match) {
            var [_, nick, body] = match;
            return (<message type="chat" to={'/' + nick}>
                    <body>{body}</body>
                    </message>);
        }
        return match;
    },

    // Implements the output side of a "Send a nudge" feature.
    // http://www.xmpp.org/extensions/xep-0224.html
    
    'nudge': function(argstring) {
        var body = $.trim(argstring);
        return (<message type="chat">
                <attention xmlns="http://www.xmpp.org/extensions/xep-0224.html#ns"/>
                <body>{body}</body>
                </message>);
    }
};


function formatFilter(message) {
    if(message.body == undefined)
        return message;
    
    function processFormatBold(xmlMessageBody) {
        var regexp = /(^|\s)\*(\S|\S.+?\S)\*($|[^\d\w])/g;
        
        return xml.mapTextNodes(xmlMessageBody, function(textNode) {
            return text.mapMatch(textNode.toString(), regexp, function(wholeMatch, before,
                                                                content, after) {
                return <span style="font-weight: bold;">{before}{content}{after}</span>;
            });
        });
    }
    
    function processFormatItalic(xmlMessageBody) {
        var regexp = /(^|\s)_(\S.+?\S)_($|[^\d\w])/g;
        
        return xml.mapTextNodes(xmlMessageBody, function(textNode) {
            return text.mapMatch(
                textNode.toString(), regexp, function(wholeMatch, before,
                                               content, after) {
                    return <span style="font-style: italic;">{before}{content}{after}</span>;
                });
        });
    }

    message.ns_xhtml_im::html.ns_xhtml::body =
        processFormatBold(
            processFormatItalic(message.ns_xhtml_im::html.ns_xhtml::body));
    
    return message;
}
