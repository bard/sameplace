/*
 * Copyright 2009 by Massimiliano Mirra
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


// DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://xmpp4moz/xmpp.jsm');
Cu.import('resource://xmpp4moz/namespaces.jsm');


// IMPLEMENTATION
// ----------------------------------------------------------------------

function XMPPContactAutocomplete() { }

XMPPContactAutocomplete.prototype = {
    classDescription : 'XMPP Contact Autocomplete',

    classID          : Components.ID('{acdc75ae-b3a7-4477-b09a-ed6656ab592b}'),

    contractID       : '@mozilla.org/autocomplete/search;1?name=xmpp-contacts',

    QueryInterface   : XPCOMUtils.generateQI([Ci.nsIAutoCompleteSearch]),

    startSearch: function(searchString, searchParam, result, listener) {
        // This autocomplete source assumes the developer attached a JSON string
        // to the the "autocompletesearchparam" attribute or "searchParam" property
        // of the <textbox> element. The JSON is converted into an array and used
        // as the source of match data. Any values that match the search string
        // are moved into temporary arrays and passed to the AutoCompleteResult

        var results = [];
        var comments = [];

        var rosters = XMPP.cache.all(
            XMPP.q()
                .event('iq')
                .direction('in')
                .type('result')
                .child('jabber:iq:roster', 'query'));

        for each(let roster in rosters) {
            for each(let xmlRosterItem in roster.stanza..ns_roster::item) {
                let completion;
                let jid = xmlRosterItem.@jid.toString();
                let name = xmlRosterItem.@name.toString();

                if(name.toLowerCase().indexOf(searchString) != -1)
                    completion = name;
                else if(jid.toLowerCase().indexOf(searchString) != -1)
                    completion = jid;

                if(completion) {
                    results.push('xmpp://' + XMPP.JID(roster.account).address + '/' + jid);
                    comments.push(name || jid);
                }
            }
        }

        if(searchParam == 'add' &&
           !searchString.match(/^xmpp:/)) {
            comments.push('Add new contact "' + searchString + '"');
            results.push('xmpp:' + searchString + '?roster');
        }

        var newResult = new ContactAutocompleteResult(
            searchString,
            Ci.nsIAutoCompleteResult.RESULT_SUCCESS, 0, '', results, comments);

        listener.onSearchResult(this, newResult);
    },

    stopSearch: function() {
    }
};

function ContactAutocompleteResult(searchString, searchResult,
                                   defaultIndex, errorDescription,
                                   results, comments) {
    this._searchString = searchString;
    this._searchResult = searchResult;
    this._defaultIndex = defaultIndex;
    this._errorDescription = errorDescription;
    this._results = results;
    this._comments = comments;
}

ContactAutocompleteResult.prototype = {
    _searchString: '',
    _searchResult: 0,
    _defaultIndex: 0,
    _errorDescription: '',
    _results: [],
    _comments: [],

    /**
   * The original search string
   */
    get searchString() {
        return this._searchString;
    },

    /**
   * The result code of this result object, either:
   *         RESULT_IGNORED   (invalid searchString)
   *         RESULT_FAILURE   (failure)
   *         RESULT_NOMATCH   (no matches found)
   *         RESULT_SUCCESS   (matches found)
   */
    get searchResult() {
        return this._searchResult;
    },

    /**
   * Index of the default item that should be entered if none is selected
   */
    get defaultIndex() {
        return this._defaultIndex;
    },

    /**
   * A string describing the cause of a search failure
   */
    get errorDescription() {
        return this._errorDescription;
    },

    /**
   * The number of matches
   */
    get matchCount() {
        return this._results.length;
    },

    /**
   * Get the value of the result at the given index
   */
    getValueAt: function(index) {
        return this._results[index];
    },

    /**
   * Get the comment of the result at the given index
   */
    getCommentAt: function(index) {
        return this._comments[index];
    },

    /**
   * Get the style hint for the result at the given index
   */
    getStyleAt: function(index) {
        if(!this._comments[index])
            return null;  // not a category label, so no special styling

        if(index == 0)
            return 'suggestfirst';  // category label on first line of results

        return 'suggesthint';   // category label on any other line of results
    },

    /**
   * Get the image for the result at the given index
   * The return value is expected to be an URI to the image to display
   */
    getImageAt : function (index) {
        return '';
    },

    /**
   * Remove the value at the given index from the autocomplete results.
   * If removeFromDb is set to true, the value should be removed from
   * persistent storage as well.
   */
    removeValueAt: function(index, removeFromDb) {
        this._results.splice(index, 1);
        this._comments.splice(index, 1);
    },

    QueryInterface: XPCOMUtils.generateQI([Ci.nsIAutoCompleteResult])
};


// REGISTRATION
// ----------------------------------------------------------------------

var components = [XMPPContactAutocomplete];

function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}
