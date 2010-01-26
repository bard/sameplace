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

function tabbedArea(deck, tabs, closeButton) {
    
    // Connect tab events to deck reactions and viceversa.

    tabs.addEventListener('DOMNodeInserted', function(event) {
        if(event.relatedNode == tabs && event.target.tagName == 'tab')
            tabs.collapsed = false;

        // Make widths uniform
        var tab = tabs.firstChild;
        var width = tabs.boxObject.width / tabs.childNodes.length;
        while(tab) {
            tab.setAttribute('width', width);
            tab = tab.nextSibling;
        }
    }, false);

    tabs.addEventListener('click', function(event) {
        if(event.target.nodeName == 'tab' && event.button == 1)
            deck.removeTab(event.target);
    }, false);

    tabs.addEventListener('select', function(event) {
        deck.selectedIndex = tabs.selectedIndex;
    }, false);

    closeButton.addEventListener('command', function(event) {
        deck.removeTab(tabs.selectedItem);
    }, false);

    // Add tabbrowser-like functions to deck
    
    deck.addTab = function(url) {
        var browser = document.createElement('browser');
        browser.setAttribute('type', 'content');
        browser.setAttribute('flex', '1');
        this.appendChild(browser);
        
        var tab = document.createElement('tab');
        tab.setAttribute('crop', 'end');
        tab.setAttribute('flex', '1')
        tab.setAttribute('label', url);
        tabs.appendChild(tab);
        
        browser.addEventListener('DOMTitleChanged', function(event) {
            if(event.target != browser.contentDocument)
                return;
            tab.setAttribute('label', event.target.title);
        }, true);
        
        browser.loadURI(url);
        tab.linkedBrowser = browser;
        return tab;
    };
    
    deck.__defineGetter__('selectedBrowser', function() {
        return this.selectedPanel;
    });

    deck.__defineGetter__('contentWindow', function() {
        if(this.selectedPanel)
            return this.selectedPanel.contentWindow;
    });
    
    deck.__defineGetter__('currentURI', function() {
        if(this.selectedPanel && this.selectedPanel.nodeName == 'browser')
            return { spec: this.selectedPanel.contentDocument.location.href };
        else
            return { spec: null };
    });

    deck.getBrowserAtIndex = function(i) {
        return this.childNodes[i];
    };

    deck.__defineGetter__('browsers', function() {
        return this.childNodes;
    });
    
    deck.getBrowserForTab = function(tab) {
        return tab.linkedBrowser;
    };
    
    deck.__defineGetter__('selectedTab', function() {
        return tabs.selectedItem;
    });
    
    deck.__defineSetter__('selectedTab', function(tab) {
        tabs.selectedItem = tab;
    });
    
    deck.removeTab = function(tab) {
        if(tab == tabs.selectedItem)
            if(tab.previousSibling) {
                tabs.selectedItem = tab.previousSibling;
            } else if(tab.nextSibling) {
                tabs.selectedItem = tab.nextSibling;
            }

        tab.linkedBrowser.loadURI('about:blank');
        this.removeChild(tab.linkedBrowser);
        tabs.removeChild(tab);

        if(tabs.childNodes.length > 0)
            this.selectedIndex = tabs.selectedIndex;
    };
    
    deck.removeCurrentTab = function() {
        this.removeTab(this.selectedTab);
    };

    deck.__defineGetter__('tabContainer', function() {
        return tabs;
    });
};

