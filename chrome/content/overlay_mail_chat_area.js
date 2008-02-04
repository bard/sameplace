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
    var xulPanels = document.getElementById('sameplace-conversations');
    var xulTabs = document.getElementById('sameplace-conversation-tabs');
    var xulMsgBox = document.getElementById('messagepanebox');
    conversations = {};
    Components
        .classes['@mozilla.org/moz/jssubscript-loader;1']
        .getService(Components.interfaces.mozIJSSubScriptLoader)
        .loadSubScript('chrome://sameplace/content/experimental/conversations_impl.js',
                       conversations);

    tabbedArea(xulPanels, xulTabs);
    conversations.init(xulPanels, xulTabs);

    xulPanels.addEventListener('conversation/close', function(event) {
        if(xulTabs.childNodes.length == 2) {
            xulPanels.collapsed = true;
            xulTabs.collapsed = true;            
        }
    }, false);

    function switchToIM() {
        xulPanels.height = xulMsgBox.height;
        xulPanels.collapsed = false;
        xulMsgBox.collapsed = true;
    }

    function switchToMail() {
        xulMsgBox.height = xulPanels.height;
        xulPanels.collapsed = true;
        xulMsgBox.collapsed = false;
    }

    xulTabs.addEventListener('select', function(event) {
        if(xulTabs.selectedIndex == 0 && !xulPanels.collapsed)
            switchToMail();
        else if(xulTabs.selectedIndex > 0 && xulPanels.collapsed)
            switchToIM();
    }, false);

    xulPanels.addEventListener('conversation/open', function(event) {
        xulTabs.parentNode.collapsed = false;
    }, false);

    window.addEventListener('contact/select', function(event) {
        conversations.selectedContact(event.target.getAttribute('account'),
                                      event.target.getAttribute('address'));
    }, false);

    // Hot-patch Thunderbird to switch to mail view when thread pane
    // selection changes

    let(__ThreadPaneSelectionChanged = ThreadPaneSelectionChanged)
        ThreadPaneSelectionChanged = function() {
            xulTabs.selectedIndex = 0;
            return __ThreadPaneSelectionChanged.apply(null, arguments);
        };

    // Hot-patch tabbed area to make room for fake mail tab

    conversations.__selectedTab = conversations.selectedTab;
    conversations.selectedTab = function(event) {
        if(event.target.selectedIndex != 0)
            this.__selectedTab(event);
    };

    xulPanels.__removeTab = xulPanels.removeTab;
    xulPanels.removeTab = function(tab) {
        if(tab != xulTabs.firstChild)
            this.__removeTab(tab);
    };
}, false);



