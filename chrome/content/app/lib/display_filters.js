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


// DISPLAY FILTERS
// ----------------------------------------------------------------------

// Display filters receive the body of incoming and outgoing messages
// just before it would be displayed, and get a chance to modify it to
// change its appearance.  This allows, for example, making URLs
// clickable even if the user entered as plain text.  Note, however,
// that the incoming or outgoing messages is NOT modified.  If you
// want to do that on outgoing messages, use out filters.

// This display filter is not really used, but shows how a text
// processor works.  It replaces all occurrences of "<name>.<ext>"
// with "<type>:<name>.<ext>".  For unrecognized extensions, it also
// highlights the text.
//
//    foo.c => source:FOO.C
//    bar.h => header:BAR.H
//    baz.i => <strong>unknown:baz.i</strong>

function processSample(xmlMessageBody) {
    var regexp = /foo\.(\w)/g;

    return xml.mapTextNodes(xmlMessageBody, function(textNode) {
        return text.mapMatch(
            textNode.toString(), regexp, function(wholeName, extension) {
                switch(extension) {
                case 'c':
                    return 'source:' + wholeName.toUpperCase();
                    break;
                case 'h':
                    return 'header:' + wholeName.toUpperCase();
                    break;
                default:
                    return <strong>unknown: {wholeName.toUpperCase()}</strong>
                }
            });
    });
}

function processURLs(xmlMessageBody) {
    var regexp = /(https?:\/\/|xmpp:|www\.)[^ \t\n\f\r"<>|()]*[^ \t\n\f\r"<>|,.!?(){}]/g;

    return xml.mapTextNodes(xmlMessageBody, function(textNode) {
        return text.mapMatch(
            textNode.toString(), regexp, function(url, protocol) {
                switch(protocol) {
                case 'http://':
                case 'https://':
                case 'xmpp:':
                    return <a href={url}>{url}</a>;
                    break;
                default:
                    return <a href={'http://' + url}>{url}</a>;
                }
            });
    });
}

function processEmoticons(xmlMessageBody) {
    function makeMatcher(listOfStrings) {
        return new RegExp(listOfStrings.map(escape).join('|'), 'g');
    }

    function escape(string) {
        return string.replace(/(\(|\)|\*|\|)/g, '\\$1');
    }

    function getKeys(object) {
        var keys = [];
        for(var key in object)
            keys.push(key);
        return keys;
    }

    var _ = arguments.callee;
    _.emoticons = _.emoticons || {
        '0:-)':  'angel',
        '0:)':   'angel',
        ':\'(':  'crying',
        '>:-)':  'devil-grin',
        '>:)':   'devil-grin',
        '8-)':   'glasses',
        '8)':    'glasses',
        ':-*':   'kiss',
        ':*':    'kiss',
        ':-(|)': 'monkey',
        ':(|)':  'monkey',
        ':-|':   'plain',
        ':|':    'plain',
        ':-(':   'sad',
        ':(':    'sad',
        ':-))':  'smile-big',
        ':))':   'smile-big',
        ':-)':   'smile',
        ':)':    'smile',
        ':-D':   'grin',
        ':D':    'grin',
        ':-O':   'surprise',
        ':O':    'surprise',
        ';)':    'wink',
        ';-)':   'wink',
        '<3':	 'heart',
        'B-)':   'cool',
        'B)':    'cool'
   };
    _.regexp = _.regexp || makeMatcher(getKeys(_.emoticons));

    return xml.mapTextNodes(xmlMessageBody, function(textNode) {
        return text.mapMatch(
            textNode.toString(), _.regexp,
            function(emoticonSymbol) {
                var url = 'emoticons/' + _.emoticons[emoticonSymbol] + '.png';
                var cls = "smiley smiley-" + _.emoticons[emoticonSymbol];
                return <span class={cls}>{emoticonSymbol}</span>;
            });
    });
}
