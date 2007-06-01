// Workaround for bug in Firefox 1.5 -- body of tabbrowser.addTab()
// references nsIWebNavigation but it is not defined anywhere.

const nsIWebNavigation = Ci.nsIWebNavigation;

// Workaround for Thunderbird -- it comes with no
// browser-status-filter component.

if(!('@mozilla.org/appshell/component/browser-status-filter;1' in Components.classes))
    window.addEventListener(
        'DOMContentLoaded', function(event) {
            if(event.target == document)
                thunderbirdTabbrowserFix(_('conversations'));
        }, false);

function thunderbirdTabbrowserFix(tabbrowser) {
    tabbrowser.enterTabbedMode = function() {
        this.mTabbedMode = true; // Welcome to multi-tabbed mode.

        // Get the first tab all hooked up with a title listener and popup blocking listener.
        this.mCurrentBrowser.addEventListener("DOMTitleChanged", this.onTitleChanged, true);

        var throbberElement = document.getElementById("navigator-throbber");
        if (throbberElement && throbberElement.hasAttribute("busy")) {
            this.mCurrentTab.setAttribute("busy", "true");
            this.mIsBusy = true;
            this.setTabTitleLoading(this.mCurrentTab);
            this.updateIcon(this.mCurrentTab);
        } else {
            this.setTabTitle(this.mCurrentTab);
            this.setIcon(this.mCurrentTab, this.mCurrentBrowser.mIconURL);
        }


        // XXX bard: there is no browser-status-filter;1 in
        // Thunderbird, we're using this (and hoping for the best)
        // instead of the commented block below
        this.mCurrentBrowser.webProgress.addProgressListener(
            this.mTabProgressListener(this.mCurrentTab,
                                      this.mCurrentBrowser,
                                      false),
            Components.interfaces.nsIWebProgress.NOTIFY_ALL);

        
//         var filter;
//         if (this.mTabFilters.length > 0) {
//             // Use the filter hooked up in our addProgressListener
//             filter = this.mTabFilters[0];
//         } else {
//             // create a filter and hook it up to our first browser
//             filter = Components.classes["@mozilla.org/appshell/component/browser-status-filter;1"]
//             .createInstance(Components.interfaces.nsIWebProgress);
//             this.mTabFilters[0] = filter;
//             this.mCurrentBrowser.webProgress.addProgressListener(filter, Components.interfaces.nsIWebProgress.NOTIFY_ALL);
//         }

//         // Remove all our progress listeners from the active browser's filter.
//         for (var i = 0; i < this.mProgressListeners.length; i++) {
//             var p = this.mProgressListeners[i];
//             if (p)
//                 filter.removeProgressListener(p);
//         }


//         // Wire up a progress listener to our filter.
//         const listener = this.mTabProgressListener(this.mCurrentTab,
//                                                    this.mCurrentBrowser,
//                                                    false);
//         filter.addProgressListener(listener, Components.interfaces.nsIWebProgress.NOTIFY_ALL);
    };

    tabbrowser.addTab = function(
        aURI, aReferrerURI, aCharset, aPostData, aOwner, aAllowThirdPartyFixup) {

        this._browsers = null; // invalidate cache

        if (!this.mTabbedMode)
            this.enterTabbedMode();

        // if we're adding tabs, we're past interrupt mode, ditch the owner
        if (this.mCurrentTab.owner)
            this.mCurrentTab.owner = null;

        var t = document.createElementNS(
            "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
            "tab");

        var blank = (aURI == "about:blank");

        if (blank)
            t.setAttribute("label", this.mStringBundle.getString("tabs.untitled"));
        else
            t.setAttribute("label", aURI);

        t.setAttribute("crop", "end");
        t.maxWidth = 250;
        t.minWidth = this.mTabContainer.mTabMinWidth;
        t.width = 0;
        t.setAttribute("flex", "100");
        t.setAttribute("validate", "never");
        t.setAttribute("onerror", "this.parentNode.parentNode.parentNode.parentNode.addToMissedIconCache(this.getAttribute('image')); this.removeAttribute('image');");
        t.className = "tabbrowser-tab";

        this.mTabContainer.appendChild(t);

        if (document.defaultView
            .getComputedStyle(this.mTabContainer, "")
            .direction == "rtl") {
            /* In RTL UI, the tab is visually added to the left side of the
             * tabstrip. This means the tabstip has to be scrolled back in
             * order to make sure the same set of tabs is visible before and
             * after the new tab is added */

            this.mTabContainer.mTabstrip.scrollBoxObject
                .scrollBy(this.mTabContainer.firstChild.boxObject.width, 0);
        }

        // invalidate cache, because mTabContainer is about to change
        this._browsers = null; 

        // If this new tab is owned by another, assert that relationship
        if (aOwner !== undefined && aOwner !== null) {
            t.owner = aOwner;

            var self = this;
            function attrChanged(event) {
                if (event.attrName == "selectedIndex" &&
                    event.prevValue != event.newValue)
                    self.resetOwner(parseInt(event.prevValue));
            }
            if (!this.mTabChangedListenerAdded) {
                this.mTabBox.addEventListener("DOMAttrModified", attrChanged, false);
                this.mTabChangedListenerAdded = true;
            }
        }

        var b = document.createElementNS(
            "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
            "browser");
        b.setAttribute("type", "content-targetable");
        b.setAttribute("message", "true");
        b.setAttribute("contextmenu", this.getAttribute("contentcontextmenu"));
        b.setAttribute("tooltip", this.getAttribute("contenttooltip"));
        if (this.hasAttribute("autocompletepopup"))
            b.setAttribute("autocompletepopup", this.getAttribute("autocompletepopup"));

        // Add the Message and the Browser to the box
        var notificationbox = document.createElementNS(
            "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
            "notificationbox");
        notificationbox.setAttribute("flex", "1");
        notificationbox.appendChild(b);
        b.setAttribute("flex", "1");
        this.mPanelContainer.appendChild(notificationbox);

        b.addEventListener("DOMTitleChanged", this.onTitleChanged, true);

        if (this.mStrip.collapsed)
            this.setStripVisibilityTo(true);

        this.mPrefs.setBoolPref("browser.tabs.forceHide", false);

        // wire up a progress listener for the new browser object.
        var position = this.mTabContainer.childNodes.length-1;
        var tabListener = this.mTabProgressListener(t, b, blank);

        // XXX bard: no browser-status-filter in Thunderbird!
//           const filter = Components.classes["@mozilla.org/appshell/component/browser-status-filter;1"]
//           .createInstance(Components.interfaces.nsIWebProgress);
//           filter.addProgressListener(tabListener, Components.interfaces.nsIWebProgress.NOTIFY_ALL);
//           b.webProgress.addProgressListener(filter, Components.interfaces.nsIWebProgress.NOTIFY_ALL);
//           this.mTabFilters[position] = filter;
        this.mTabListeners[position] = tabListener;

        b._fastFind = this.fastFind;

        var uniqueId = "panel" + Date.now() + position;
        this.mPanelContainer.lastChild.id = uniqueId;
        t.linkedPanel = uniqueId;
        t.linkedBrowser = b;
        t._tPos = position;
        if (t.previousSibling.selected)
            t.setAttribute("afterselected", true);

        if (!blank) {
            // pretend the user typed this so it'll be available till
            // the document successfully loads
            b.userTypedValue = aURI;

            if (aPostData === undefined)
                aPostData = null;
            const nsIWebNavigation = Components.interfaces.nsIWebNavigation;
            var flags = nsIWebNavigation.LOAD_FLAGS_NONE;
            if (aAllowThirdPartyFixup) {
                flags = nsIWebNavigation.LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP;
            }
            b.loadURIWithFlags(aURI, flags, aReferrerURI, aCharset, aPostData);
        }

        // |setTimeout| here to ensure we're post reflow
        var _delayedUpdate = function(aTabContainer) {
            aTabContainer.adjustTabstrip();

            if (aTabContainer.selectedItem != t)
                aTabContainer._notifyBackgroundTab(t);

            // XXXmano: this is a temporary workaround to bug 343585
            // We need to manually update the scroll buttons disabled state
            // if a tab was inserted to the overflow area or removed from it
            // without any scrolling and when the tabbar has already
            // overflowed.
            aTabContainer.mTabstrip._updateScrollButtonsDisabledState();
        }
        setTimeout(_delayedUpdate, 0, this.mTabContainer);

        // Dispatch a new tab notification.  We do this once we're
        // entirely done, so that things are in a consistent state
        // even if the event listener opens or closes tabs.
        var evt = document.createEvent("Events");
        evt.initEvent("TabOpen", true, false);
        t.dispatchEvent(evt);

        return t;                
    };

    tabbrowser.removeTab = function(aTab) {
        this._browsers = null; // invalidate cache
        if (aTab.localName != "tab")
            aTab = this.mCurrentTab;

        var l = this.mTabContainer.childNodes.length;
        if (l == 1 && this.mPrefs.getBoolPref("browser.tabs.autoHide")) {
            // hide the tab bar
            this.mPrefs.setBoolPref("browser.tabs.forceHide", true);
            this.setStripVisibilityTo(false);
            return;
        }

        var ds = this.getBrowserForTab(aTab).docShell;
        if (ds.contentViewer && !ds.contentViewer.permitUnload())
            return;

        // see notes in addTab
        var _delayedUpdate = function(aTabContainer) {
            aTabContainer.adjustTabstrip();
            aTabContainer.mTabstrip._updateScrollButtonsDisabledState();
        }
        setTimeout(_delayedUpdate, 0, this.mTabContainer);

        if (l == 1) {
            // add a new blank tab to replace the one we're about to close
            // (this ensures that the remaining tab is as good as new)
            this.addTab("about:blank");
            l++;
        }
        else if (l == 2) {
            var autohide = this.mPrefs.getBoolPref("browser.tabs.autoHide");
            var tabStripHide = !window.toolbar.visible;
            if (autohide || tabStripHide)
                this.setStripVisibilityTo(false);
        }

        // We're committed to closing the tab now.  
        // Dispatch a notification.
        // We dispatch it before any teardown so that event listeners can
        // inspect the tab that's about to close.
        var evt = document.createEvent("Events");
        evt.initEvent("TabClose", true, false);
        aTab.dispatchEvent(evt);

        var index = -1;
        if (this.mCurrentTab == aTab)
            index = this.mTabContainer.selectedIndex;
        else {
            // Find and locate the tab in our list.
            for (var i = 0; i < l; i++)
                if (this.mTabContainer.childNodes[i] == aTab)
                    index = i;
        }

        // Remove the tab's filter and progress listener.
        var oldBrowser = this.getBrowserAtIndex(index);
        // XXX bard: commented out
//         const filter = this.mTabFilters[index];
//         oldBrowser.webProgress.removeProgressListener(filter);
//         filter.removeProgressListener(this.mTabListeners[index]);
//         this.mTabFilters.splice(index, 1);
        this.mTabListeners.splice(index, 1);

        // Remove our title change and blocking listeners
        oldBrowser.removeEventListener("DOMTitleChanged", this.onTitleChanged, true);

        // We are no longer the primary content area.
        oldBrowser.setAttribute("type", "content-targetable");

        // Get the index of the tab we're removing before unselecting it
        var currentIndex = this.mTabContainer.selectedIndex;

        var oldTab = aTab;

        // clean up the before/afterselected attributes before removing the tab
        oldTab.selected = false;

        // Remove this tab as the owner of any other tabs, since it's going away.
        for (i = 0; i < this.mTabContainer.childNodes.length; ++i) {
            var tab = this.mTabContainer.childNodes[i];
            if ("owner" in tab && tab.owner == oldTab)
                // |tab| is a child of the tab we're removing, make it an orphan
                tab.owner = null;
        }

        // Because of the way XBL works (fields just set JS
        // properties on the element) and the code we have in place
        // to preserve the JS objects for any elements that have
        // JS properties set on them, the browser element won't be
        // destroyed until the document goes away.  So we force a
        // cleanup ourselves.
        // This has to happen before we remove the child so that the
        // XBL implementation of nsIObserver still works.  But
        // clearing focusedWindow happens below because it gets
        // reset by updateCurrentBrowser.
        oldBrowser.destroy();

        // Remove the tab
        this.mTabContainer.removeChild(oldTab);
        // invalidate cache, because mTabContainer is about to change
        this._browsers = null; 
        this.mPanelContainer.removeChild(oldBrowser.parentNode);

        try {
            // if we're at the right side (and not the logical end,
            // which is why this works for both LTR and RTL)
            // of the tabstrip, we need to ensure that we stay 
            // completely scrolled to the right side
            var tabStrip = this.mTabContainer.mTabstrip;
            var scrollPos = {};
            tabStrip.scrollBoxObject.getPosition(scrollPos, {});
            var scrolledSize = {};
            tabStrip.scrollBoxObject.getScrolledSize(scrolledSize, {});

            if (scrollPos.value + tabStrip.boxObject.width >= 
                scrolledSize.value) {
                tabStrip.scrollByPixels(-1 * this.mTabContainer.firstChild
                                        .boxObject.width);
            }
        }
        catch (ex) {
        }

        // Find the tab to select
        var newIndex = -1;
        if (currentIndex > index)
            newIndex = currentIndex-1;
        else if (currentIndex < index)
            newIndex = currentIndex;
        else {
            if ("owner" in oldTab && oldTab.owner &&
                this.mPrefs.getBoolPref("browser.tabs.selectOwnerOnClose")) {
                for (i = 0; i < this.mTabContainer.childNodes.length; ++i) {
                    tab = this.mTabContainer.childNodes[i];
                    if (tab == oldTab.owner) {
                        newIndex = i;
                        break;
                    }
                }
            }
            if (newIndex == -1)
                newIndex = (index == l - 1) ? index - 1 : index;
        }

        // Select the new tab
        this.selectedTab = this.mTabContainer.childNodes[newIndex];

        for (i = oldTab._tPos; i < this.mTabContainer.childNodes.length; i++) {
            this.mTabContainer.childNodes[i]._tPos = i;
        }
        this.mTabBox.selectedPanel = this.getBrowserForTab(this.mCurrentTab).parentNode;
        this.mCurrentTab.selected = true;

        this.updateCurrentBrowser();

        // see comment above destroy above
        oldBrowser.focusedWindow = null;
        oldBrowser.focusedElement = null;
    };
}