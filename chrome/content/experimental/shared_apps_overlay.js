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


// GUI REACTIONS
// ----------------------------------------------------------------------

window.addEventListener('load', function(event) {
    var xulContactPopup = $('#contact-popup');
    fetchFeed('http://apps.sameplace.cc/feed.xml', function(feed, e) {
        if(!feed) throw e;
        
        var menus = {};
        function menuFor(category) {
            if(!menus[category]) {
                var xulMenu = document.createElement('menu');
                xulMenu.setAttribute('class', 'offset');
                xulMenu.setAttribute('label', category);
                xulMenu.setAttribute('tooltiptext', category);
                xulContactPopup.insertBefore(
                    xulMenu,
                    $(xulContactPopup, '> .shared-app-separator'));
                
                var xulPopup = document.createElement('menupopup');
                xulMenu.appendChild(xulPopup);
                menus[category] = xulPopup;
            }
            return menus[category];
        }
        
        for(var i=0; i<feed.items.length; i++) {
            var item = feed.items.queryElementAt(i, Ci.nsIFeedEntry);
            
            var menuItem = document.createElement('menuitem');
            menuItem.setAttribute('class', 'shared-app');
            menuItem.setAttribute('label', item.fields.getProperty('title'));
            menuItem.setAttribute('value', item.fields.getProperty('link'));
            menuItem.setAttribute('tooltiptext', item.fields.getProperty('description'));
            menuFor(item.fields.getProperty('dc:subject')).appendChild(menuItem);
        }

        xulContactPopup.addEventListener('command', function(event) {
            if(!hasClass(event.target, 'shared-app'))
                return;

            var url = event.target.value;
            var xulContact = $(document.popupNode, '^ .contact');
            var account = xulContact.getAttribute('account');
            var address = xulContact.getAttribute('address');

            interact(account, address, url);
        }, false);

    });
}, false);


// OTHER ACTIONS
// ----------------------------------------------------------------------

function interact(account, address, url) {
    if(!(url.match(/^javascript:/) ||
         getBrowser().currentURI.spec == 'about:blank' ||
         url == ''))
        getBrowser().selectedTab = getBrowser().addTab();

    var xulPanel = getBrowser().selectedBrowser;

    function activate() {
        XMPP.connectPanel(xulPanel, account, address, /^javascript:/.test(url));
    }

    function notifyContact() {
        XMPP.send(account,
                  <message to={address}>
                  <share xmlns={ns_x4m_ext} url={xulPanel.currentURI.spec}/>
                  </message>);
    }

    if(!url) {
        activate();
        notifyContact();
    }
    else if(url.match(/^javascript:/)) {
        xulPanel.loadURI(url);
        activate();
    }
    else {
        afterLoad(xulPanel, function(panel) {
            activate();
            notifyContact();
        });
        xulPanel.loadURI(url);
    }
}


// NETWORK UTILITIES
// ----------------------------------------------------------------------

function fetchFeed(feedUrl, continuation) {
    if(!Ci.nsIFeed) {
        continuation(null);
        return;
    }
    
    var req = new XMLHttpRequest();

    req.onload = function() {
        var data = req.responseText;

        var ioService = Cc['@mozilla.org/network/io-service;1']
        .getService(Ci.nsIIOService);
        var uri = ioService.newURI(feedUrl, null, null);

        if(data.length) {
            var parser = Cc['@mozilla.org/feed-processor;1']
                .createInstance(Ci.nsIFeedProcessor);
            try {
                parser.listener = {
                    handleResult: function(result) {
                        continuation(result.doc.QueryInterface(Ci.nsIFeed));
                    }
                };
                parser.parseFromString(data, uri);
            }
            catch(e) {
                continuation(null, e);
            }
        }
    };

    req.open('GET', feedUrl, true);
    try {
        req.send(null);
    } catch(e) {
        continuation(null, e);
    }
}
