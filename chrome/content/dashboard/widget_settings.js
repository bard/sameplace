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


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

window.addEventListener('dashboard/load', function(event) { settings.init(); }, false)
window.addEventListener('dashboard/unload', function(event) { settings.finish(); }, false)

var settings = {};

settings.init = function() {
    this._pref = Cc['@mozilla.org/preferences-service;1']
        .getService(Ci.nsIPrefService)
        .getBranch('extensions.sameplace.');

    this._prompt = Cc['@mozilla.org/embedcomp/prompt-service;1']
        .getService(Ci.nsIPromptService);

    $('#widget-settings-open-mode').value = this._pref.getCharPref('openMode');
};

settings.finish = function() {
    this._channel.release();
};


// UI REACTIONS
// ----------------------------------------------------------------------

settings.changedOpenMode = function(event) {
    var mode = event.target.value;

    if(mode !== this._pref.getCharPref('openMode')) {
        this._pref.setCharPref('openMode', mode);
        this._prompt.alert(null, 'Changing open mode',
                           'This setting will take effect after browser is restarted.');
    }
};