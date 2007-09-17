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

    deck.addEventListener('DOMNodeInserted', function(event) {
        if(event.relatedNode == deck && event.target.tagName == 'browser')
            deck.collapsed = false;
    }, false);

    tabs.addEventListener('DOMNodeRemoved', function(event) {
        if(event.relatedNode == tabs && event.target.tagName == 'tab')
            tabs.collapsed = (tabs.childNodes.length == 1);
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
        tab._browser = browser;
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
    
    deck.__defineGetter__('browsers', function() {
        return this.childNodes;
    });
    
    deck.getBrowserAtIndex = function(i) {
        return this.childNodes[i];
    };
    
    deck.getBrowserForTab = function(tab) {
        return tab._browser;
    };
    
    deck.__defineGetter__('selectedTab', function() {
        return tabs.selectedItem;
    });
    
    deck.__defineSetter__('selectedTab', function(tab) {
        tabs.selectedItem = tab;
    });
    
    deck.removeTab = function(tab) {
        if(tab == tabs.selectedItem && tab.previousSibling)
            tabs.selectedItem = tab.previousSibling;
    
        // Force unload event.
        tab._browser.loadURI('about:blank');
        this.removeChild(tab._browser);
        tabs.removeChild(tab);
    };
    
    deck.removeCurrentTab = function() {
        this.removeTab(this.selectedTab);
    };

    deck.__defineGetter__('tabContainer', function() {
        return tabs;
    });
    
    // XXX only used by conversations.js for detecting tab selection;
    // use TabSelect event there instead, and modify here accordingly.
    deck.mPanelContainer = deck;

    // XXX not necessary if mTabContainer in conversations.js is
    // replaced with tabContainer
    deck.mTabContainer = tabs;
};



