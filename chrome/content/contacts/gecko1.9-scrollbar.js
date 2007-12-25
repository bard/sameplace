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
 * Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
 *  
 */


// We want to hide scrollbar in contact list.  The following works in
// Firefox 2 when put in the extension's skin:
//
//     #contacts scrollbar { display: none; }
//
// It doesn't work in Firefox 3 when put in the extension's skin.
// However, it does when put in userChrome.css.  Thus, we simulate
// that here using nsIStyleSheetService (kudos to dafi for the
// life-saving tip).

window.addEventListener('load', function() {
    var srvStyleSheet = Cc['@mozilla.org/content/style-sheet-service;1']
        .getService(Ci.nsIStyleSheetService)
    var uri = Cc['@mozilla.org/network/io-service;1']
        .getService(Ci.nsIIOService)
        .newURI('chrome://sameplace/skin/contacts/hide-scrollbar.css', null, null);

    if(!srvStyleSheet.sheetRegistered(uri, srvStyleSheet.AGENT_SHEET))
        srvStyleSheet.loadAndRegisterSheet(uri, srvStyleSheet.AGENT_SHEET);
}, false);
    
