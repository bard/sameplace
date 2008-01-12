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

if(sameplace.experimentalMode()) {

// Hot-patch Thunderbird routines, hopefully in a robust way, as
// well as SamePlace toggle() function.  Do so in a smaller scope
// so we don't pollute the global namespace.

let(__CycleFolderView = CycleFolderView,
    savedTitle = '', isVisible, hide, show) {


    isVisible = function() {
        return !document.getElementById('sameplace-frame').collapsed;
    }

    hide = function() {
        document.getElementById('folderpane-title').value = savedTitle;
        document.getElementById('sameplace-frame').collapsed = true;
        document.getElementById('folderTree').collapsed = false;
    }

    show = function() {
        savedTitle = document.getElementById('folderpane-title').value;
        document.getElementById('folderpane-title').value = 'SamePlace';
        document.getElementById('sameplace-frame').collapsed = false;
        document.getElementById('folderTree').collapsed = true;
    }

    CycleFolderView = function(aCycleForward) {
        // This version makes it look like SP is one of the panels,
        // and thus appears during cycling.

        //         if(gCurrentFolderView == 0) {
        //             if(isVisible()) {
        //                 if(aCycleForward)
        //                     hide();
        //                 else {
        //                     hide();
        //                     __CycleFolderView(aCycleForward);
        //                 }
        //             } else {
        //                 if(aCycleForward)
        //                     __CycleFolderView(aCycleForward);
        //                 else
        //                     show();
        //             }
        //         } else if(gCurrentFolderView == kNumFolderViews-1) {
        //             if(isVisible()) {
        //                 if(aCycleForward) {
        //                     hide();
        //                     __CycleFolderView(aCycleForward);
        //                 } else
        //                     hide();
        //             } else {
        //                 if(aCycleForward)
        //                     show();
        //                 else
        //                     __CycleFolderView(aCycleForward);
        //             }
        //         } else {
        //             __CycleFolderView(aCycleForward);
        //         }

        if(isVisible())
            hide()
        __CycleFolderView(aCycleForward);
    }

    sameplace.toggle = function() {
        if(isVisible())
            hide();
        else
            show();
    }
}

}

