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
