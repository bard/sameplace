const CATEGORY = 'c-sameplace';
const CONTRACT_ID = '@mozilla.org/commandlinehandler/general-startup;1?type=sameplace';


const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const CLASS_ID = Components.ID('{2991c315-b871-42cd-b33f-bfee4fcbf682}');

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
const Handler = {
   /* QueryInterface: function(iid) {
        if(iid.equals(Ci.nsICommandLineHandler) ||
           iid.equals(Ci.nsIFactory) ||
           iid.equals(Ci.nsISupports))
            return this;

        throw Cr.NS_ERROR_NO_INTERFACE;
    }, */

    contractID : CONTRACT_ID,
    classID : CLASS_ID,
    QueryInterface : XPCOMUtils.generateQI([Ci.nsICommandLineHandler]),
    handle: function(cmdLine) {
        var uri;
        try {
            uri = cmdLine.handleFlagWithParam('sameplace', false);
        } catch (e) {
        }

        if(uri || cmdLine.handleFlag('sameplace', false)) {
            var windowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1']
                .getService(Ci.nsIWindowWatcher);
            var windowMediator = Cc['@mozilla.org/appshell/window-mediator;1']
                .getService(Ci.nsIWindowMediator)

            var window = windowMediator.getMostRecentWindow('SamePlace');
            if(window)
                window.focus();
            else
                windowWatcher.openWindow(
                    null, 'chrome://sameplace/content/standalone.xul',
                    'SamePlace', 'chrome,toolbar=no', null)

            cmdLine.preventDefault = true;
        }
    },

    helpInfo: '-sameplace              Start SamePlace.\n',

    createInstance: function(outer, iid) {
        if(outer != null)
            throw Cr.NS_ERROR_NO_AGGREGATION;

        return this.QueryInterface(iid);
    },

    lockFactory: function(lock) {
        /* no-op */
    }
};


const Module = {
    QueryInterface: function(iid) {
        if(iid.equals(Ci.nsIModule) ||
           iid.equals(Ci.nsISupports))
            return this;

        throw Cr.NS_ERROR_NO_INTERFACE;
    },

    getClassObject: function(compMgr, cid, iid) {
        if(cid.equals(CLASS_ID))
            return Handler.QueryInterface(iid);

        throw Cr.NS_ERROR_NOT_REGISTERED;
    },

    registerSelf: function(compMgr, fileSpec, location, type) {
        compMgr.QueryInterface(Ci.nsIComponentRegistrar);
        compMgr.registerFactoryLocation(CLASS_ID, 'Handler', CONTRACT_ID, fileSpec, location, type);

        var catMan = Cc['@mozilla.org/categorymanager;1'].getService(Ci.nsICategoryManager);
        catMan.addCategoryEntry('command-line-handler', CATEGORY, CONTRACT_ID, true, true);
    },

    unregisterSelf: function mod_unreg(compMgr, location, type) {
        compMgr.QueryInterface(Ci.nsIComponentRegistrar);
        compMgr.unregisterFactoryLocation(CLASS_ID, location);

        var catMan = Cc['@mozilla.org/categorymanager;1'].getService(Ci.nsICategoryManager);
        catMan.deleteCategoryEntry('command-line-handler', CATEGORY);
    },

    canUnload: function (compMgr) {
        return true;
    }
};

function NSGetModule(comMgr, fileSpec) {
    return Module;
}

const NSGetFactory = XPCOMUtils.generateNSGetFactory([Handler]);
