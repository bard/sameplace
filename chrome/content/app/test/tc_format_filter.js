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


var regexp = /(^|\s)\*(\S|\S.+?\S)\*($|[^\d\w])/g;

var shouldMatch = [
    ' *hello* ',
    ' *hello world* ',
    '\n*hello world*',
    '*hello world* ',
    '*hello world*',
    '*hello world*,',
    '*1*'
];

var shouldNotMatch = [
    'http://test.com/my*nice*url',
    'inner*stars*stars',
    ' * stars with spaces * ',
    '* 1 *'
];

var matchResults = shouldMatch.map(function(string) {
    return string + '\t->\t' + (string.match(regexp) ? 'OK' : 'FAIL');
});

var notMatchResults = shouldNotMatch.map(function(string) {
    return string + '\t->\t' + (string.match(regexp) ? 'FAIL' : 'OK');
});


repl.print(matchResults.concat(notMatchResults).join('\n'));


    function processFormatBold(xmlMessageBody) {
        var regexp = /(^|\s)\*(.+?)\*($|[^\w\d])/g;
        
        return xml.mapTextNodes(xmlMessageBody, function(textNode) {
            return text.mapMatch(textNode.toString(), regexp, function(wholeMatch, before,
                                                                content, after) {
                return <span style="font-weight: bold;">{before}{content}{after}</span>;
            });
        });
    }

XML.ignoreWhitespace = false;
XML.prettyPrinting = false;
processFormatBold(<body> hello *world* ahah</body>)
