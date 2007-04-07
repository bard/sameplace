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


var behaviour = behaviour || {};

/**
 * Behaviour for popup showing image palette(s).
 *
 * Dependencies: getElementsByAttribute() from main.js.
 *
 */

behaviour.palette = function(palette) {
    var defaultEmoticons = [
        'angel', 'crying', 'devil-grin', 'glasses', 'kiss',
        'monkey', 'plain', 'sad', 'smile-big', 'smile', 'grin',
        'surprise', 'wink' ];

    palette.add = function(imageUrl) {
        var thumb = document.createElement('img');
        thumb.setAttribute('src', imageUrl);
        getElementByAttribute(palette, 'class', 'menu-content').appendChild(thumb);
    };

    defaultEmoticons.forEach(
        function(name) {
            palette.add('./emoticons/' + name + '.png?alt="' + name + '"');
        });
};

