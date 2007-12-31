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


/**
 * Routines for generic text manipulation.
 *
 */


// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

var text = {};


// UTILITIES
// ----------------------------------------------------------------------

// For each match of _regexp_ in _string_, executes _processFn_ .
// Returns an array of unprocessed string parts plus processed string
// parts.
//
// Arguments
// to _function_ are the whole matching substring followed by submatches.
// For example:
//
//     text.mapMatch(
//         'hello world',
//         /(.)l/g,
//         function(wholeMatch, firstSubMatch) {
//             return { beforeL: firstSubMatch, whole: wholeMatch }
//         });
//
// Returns:
//
//     ["h", {beforeL:"e", whole:"el"}, "lo wo", {beforeL:"r", whole:"rl"}, "d"]
//
// Note that regexp must have the 'g' flag!
    
text.mapMatch = function(string, regexp, processFn) {
    if(!regexp.global)
        throw new Error('RegExp must be global. (' + regexp.source + ')');

    var parts = [];
    var start = 0;

    var match = regexp.exec(string);
    while(match) {
        parts.push(string.substring(start, match.index));

        start = regexp.lastIndex;

        parts.push(processFn.apply(null, match));

        match = regexp.exec(string);
    }
    parts.push(string.substring(start, string.length));

    return parts;
};

