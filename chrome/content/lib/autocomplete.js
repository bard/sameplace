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

function autoComplete(textbox) {
    var popup = document.createElement('popup');
    textbox.appendChild(popup);
    popup.enableKeyboardNavigator(false);

    function showCompletions() {
        popup.showPopup(
            textbox, -1, -1, 'tooltip', 'bottomleft', 'topleft');
    }

    function hideCompletions() {
        popup.hidePopup();        
    }

    function synthKeyEvent(keycode) {
        var event = document.createEvent('KeyEvents');
        event.initKeyEvent(
            'keypress',        //  in DOMString typeArg,
            false,             //  in boolean canBubbleArg,
            false,             //  in boolean cancelableArg,
            null,             //  in nsIDOMAbstractView viewArg,  Specifies UIEvent.view. This value may be null.
            false,            //  in boolean ctrlKeyArg,
            false,            //  in boolean altKeyArg,
            false,            //  in boolean shiftKeyArg,
            false,            //  in boolean metaKeyArg,
            keycode,               //  in unsigned long keyCodeArg,
            0);              //  in unsigned long charCodeArg);
        return event;
    }

    popup.addEventListener(
        'popupshowing', function(event) {
            if(popup.childNodes.length == 0) {
                event.preventDefault();
                popup.hidePopup();
            } 
        }, false);

    popup.addEventListener(
        'command', function(event) {
            textbox.value = event.target.label;
            popup.enableKeyboardNavigator(false);
            var completedEvent = document.createEvent('Event');
            completedEvent.initEvent('completed', true, false);
            event.target.dispatchEvent(completedEvent);
        }, false);

    textbox.addEventListener(
        'keypress', function(event) {
            switch(event.keyCode) {

            case KeyEvent.DOM_VK_ESCAPE:
                popup.hidePopup();
                break;

            case KeyEvent.DOM_VK_RETURN:
                break;

            case KeyEvent.DOM_VK_DOWN:
                popup.enableKeyboardNavigator(true);
                if('state' in popup) {
                    // gecko1.9 - no idea why it is needed
                    hideCompletions();
                    showCompletions();
                }
                popup.dispatchEvent(synthKeyEvent(KeyEvent.DOM_VK_DOWN));
                
                break;

            case KeyEvent.DOM_VK_UP:
                popup.enableKeyboardNavigator(true);
                popup.dispatchEvent(synthKeyEvent(KeyEvent.DOM_VK_UP));
                break;

            default:
            }
        }, false);

    textbox.addEventListener(
        'input', function(event) {
            if(textbox.value == '')
                hideCompletions();
            else {
                while(popup.firstChild)
                    popup.removeChild(popup.firstChild);
                
                var completeEvent = document.createEvent('Event');
                completeEvent.initEvent('complete', true, false);
                popup.dispatchEvent(completeEvent);
                
                showCompletions();
            }
        }, false);

    textbox.addEventListener(
        'blur', function(event) {
            hideCompletions();
        }, true);
};
