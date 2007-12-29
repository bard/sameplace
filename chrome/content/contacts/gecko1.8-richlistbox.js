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


window.addEventListener('load', function(event) {
    if(typeof($('#contacts')._setItemSelection) == 'function') {
        $('#contacts')._setItemSelection = function(aItem) {
            if (this._selectedItem)
                this._selectedItem.selected = false
            
            this._selectedItem = aItem;
            this._selectedIndex = this.getIndexOf(aItem);
            this.ensureSelectedElementIsVisible();
            
            if (aItem) {
                aItem.selected = true;
                // commenting the following as it will FUBAR control-space.
                //aItem.focus();
            }
        }
    }
}, false);