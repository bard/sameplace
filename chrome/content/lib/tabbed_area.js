function tabbedArea(deck, tabs) {
    
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

    // Prevent click event from descending down to the close button,
    // since that assumes it's being used in a <tabbrowser/>, and
    // listening to command event instead.
    
    var closeButtonBox = document.getAnonymousElementByAttribute(
        tabs, 'class', 'tabs-closebutton-box');

    closeButtonBox.addEventListener('click', function(event) {
        event.stopPropagation()
    }, true);

    var closeButton = document.getAnonymousElementByAttribute(
        tabs, 'class', 'tabs-closebutton-box').firstChild;

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

