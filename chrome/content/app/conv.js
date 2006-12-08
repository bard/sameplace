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


/**
 * Routines for plain text/HTML/XML conversion.
 *
 */


// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const serializer  = new XMLSerializer();
const parser      = new DOMParser();

const smileys = {
    '0:-)':  'angel',
    '0:)':   'angel',
    ':\'(':  'crying',
    '>:-)':  'devil-grin',
    '>:)':   'devil-grin',
    'B-)':   'glasses',
    'B)':    'glasses',
    ':-*':   'kiss',
    ':*':    'kiss',
    ':-(|)': 'monkey',
    ':(|)':  'monkey',
    ':-|':   'plain',
    ':-(':   'sad',
    ':(':    'sad',
    ':-))':  'smile-big',
    ':))':   'smile-big',
    ':-)':   'smile',
    ':)':    'smile',
    ':-D':   'grin',
    ':D':    'grin',
    ':-0':   'surprise',
    ':0':    'surprise',
    ';)':    'wink',
    ';-)':   'wink'
};
const smileyRegexp;
const urlRegexp = new RegExp('(https?:\/\/|www\.)[^ \\t\\n\\f\\r"<>|()]*[^ \\t\\n\\f\\r"<>|,.!?(){}]');

var conv = {};


// INITIALIZATION
// ----------------------------------------------------------------------

var smileySymbols = [];
for(var symbol in smileys)
    smileySymbols.push(symbol);

smileyRegexp = smileySymbols.map(
    function(symbol) {
        return symbol.replace(/(\(|\)|\*|\|)/g, '\\$1');
    }).join('|');


// PUBLIC FUNCTIONALITY
// ----------------------------------------------------------------------

conv.toXML = function(domElement) {
    return new XML(serializer.serializeToString(domElement));    
};

conv.toDOM = function(thing) {
    return parser.parseFromString((typeof(thing) == 'xml' ?
                                   thing.toXMLString() : thing),
                                  'application/xhtml+xml').documentElement;    
};

conv.plainTextToHTML = function(text) {
    var container = document.createElement('div');
    
    text = text.toString();
    
    var rx = new RegExp([urlRegexp.source, smileyRegexp].join('|'), 'g');
    
    var start = 0;
    var match = rx.exec(text);
    while(match) {
        container.appendChild(
            document.createTextNode(
                text.substring(start, match.index)));

        start = rx.lastIndex;

        var translatedElement;
        if(match[0].match(smileyRegexp)) {
            translatedElement = document.createElement('img');
            translatedElement.setAttribute('class', 'emoticon');
            translatedElement.setAttribute('alt', match[0]);
            translatedElement.
                setAttribute('src',
                             'emoticons/' + smileys[match[0]] + '.png');
        } else {
            translatedElement = document.createElement('a');
            var url = match[0];
            translatedElement.textContent = url;
            if(!/^https?:\/\//.test(url))
                url = 'http://' + url;
            translatedElement.setAttribute('href', url);
        }
        container.appendChild(translatedElement);

        match = rx.exec(text);
    }
    container.appendChild(
        document.createTextNode(
            text.substring(start, text.length)));

    return container;
}