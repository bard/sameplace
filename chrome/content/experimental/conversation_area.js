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
    var pref = Cc['@mozilla.org/preferences-service;1']
        .getService(Ci.nsIPrefService)
        .getBranch('extensions.sameplace.');

    var overlays = {
        'external': 'conversations_overlay_outer.xul',
        'sidebar': 'conversations_overlay.xul'
    };

    document.loadOverlay(
        'chrome://sameplace/content/experimental/' + overlays[pref.getCharPref('chatArea')], {
            observe: function(subject, topic, data) {
                // On Firefox3, when overlay observer is called,
                // overlay content isn't there yet.  So let's give it 
                // some time... and hope for the best.
                setTimeout(function(){ conversations.init(); }, 1000);
            }
        });
}, false);
