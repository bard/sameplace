/* ---------------------------------------------------------------------- */
/*                        Protocol specific code                          */

const kSCHEME = 'xmpp';
const kPROTOCOL_NAME = 'XMPP Protocol';
const kPROTOCOL_CID = Components.ID('{101008f2-4454-4bdb-9f3a-ae3b02eeb20d}');
const kCONTENT_NAME = 'XMPP Content Handler';
const kCONTENT_CID = Components.ID('{2d12cfe5-8cdd-49bb-b766-e551343c1265}');


this.__defineGetter__(
    'XMPP', function() {
        if(!arguments.callee.XMPP)
            loader.loadSubScript('chrome://xmpp4moz/content/xmpp.js', arguments.callee);

        return arguments.callee.XMPP;
    });

function xpcomize(thing) {
    if(typeof(thing) == 'string') {
        var xpcomString = Cc["@mozilla.org/supports-string;1"]
            .createInstance(Ci.nsISupportsString);
        xpcomString.data = thing;
        return xpcomString;
    } else if(thing instanceof Ci.nsISupports) {
        return thing;
    } else {
        throw new Error('Neither an XPCOM object nor a string. (' + thing + ')');
    }
}

function onNewChannel(URI) {
    var m = URI.spec.match(/^xmpp:([^\?$]+)(\?join)?$/);
    var jid = encodeURI(m[1]);
    var request = Cc['@mozilla.org/properties;1'].createInstance(Ci.nsIProperties);
    request.set('address', xpcomize(jid));
    request.set('type', xpcomize(m[2] ? 'groupchat' : 'chat'));
    
    ww.openWindow(
        null, 'chrome://sameplace/content/open_conversation.xul',
        'SamePlace:OpenConversation', '', request);
    
    return new Channel(URI);
}



/* ---------------------------------------------------------------------- */
/*                            Template code                               */ 

const kPROTOCOL_CONTRACTID = '@mozilla.org/network/protocol;1?name=' + kSCHEME;
const kSIMPLEURI_CONTRACTID = '@mozilla.org/network/simple-uri;1';
const kIOSERVICE_CONTRACTID = '@mozilla.org/network/io-service;1';
const kCONTENT_CONTRACTID = '@mozilla.org/uriloader/content-handler;1?type=x-application-' + kSCHEME;

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
    .getService(Ci.mozIJSSubScriptLoader);
const ww = Cc['@mozilla.org/embedcomp/window-watcher;1']
    .getService(Ci.nsIWindowWatcher);


// PROTOCOL HANDLER
// ----------------------------------------------------------------------

function ProtocolHandler() {}

ProtocolHandler.prototype = {
    QueryInterface: function(iid) {
        if(!iid.equals(Ci.nsIProtocolHandler) &&
           !iid.equals(Ci.nsISupports))
            throw Cr.NS_ERROR_NO_INTERFACE;

        return this;
    },

    scheme: kSCHEME,

    defaultPort: -1,

    protocolFlags: Ci.nsIProtocolHandler.URI_NORELATIVE | Ci.nsIProtocolHandler.URI_NOAUTH,
  
    allowPort: function(port, scheme) {
        return false;
    },

    newURI: function(spec, charset, baseURI) {
        var uri = Components.classes[kSIMPLEURI_CONTRACTID].createInstance(Ci.nsIURI);
        uri.spec = spec;
        return uri;
    },

    newChannel: function(URI) {
        return onNewChannel(URI);
    }
};


// CONTENT HANDLER
//----------------------------------------------------------------------

function ContentHandler() {}

ContentHandler.prototype = {
    QueryInterface: function(iid) {
        if(!iid.equals(Ci.nsIContentHandler))
            throw Cr.NS_ERROR_NO_INTERFACE;
        
        return this;
    },

    handleContent: function (contentType, windowTarget, request, aRemovedArg) {

    }
};


// CHANNEL
// ----------------------------------------------------------------------

function Channel(URI) {
   this.URI = URI;
   this.originalURI = URI;
}

Channel.prototype = {
    QueryInterface: function(iid) {
        if(!iid.equals(Ci.nsIChannel) &&
           !iid.equals(Ci.nsIRequest) &&
           !iid.equals(Ci.nsISupports))
            throw Cr.NS_ERROR_NO_INTERFACE;
        
        return this;
    },

    /* nsIChannel */
    loadAttributes: null,
    contentType: 'x-application-' + kSCHEME,
    contentLength: 0,
    owner: null,
    loadGroup: null,
    notificationCallbacks: null,
    securityInfo: null,

    open: function() {
        throw Cr.NS_ERROR_NOT_IMPLEMENTED; 
    },

    asyncOpen: function(observer, ctxt) {
        //observer.onStartRequest(this, ctxt);
    },

    asyncRead: function(listener, ctxt) {
        return listener.onStartRequest(this, ctxt);
    },

    /* nsIRequest */

    status: Cr.NS_OK,

    isPending: function() { 
        return true; 
    },

    cancel: function(status) {
        this.status = status;
    },

    suspend: function() {
        throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    },

    resume: function() {
        throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    }
};


// FACTORIES
// ----------------------------------------------------------------------

var ProtocolHandlerFactory = {
    createInstance: function(outer, iid) {
        if(outer != null)
            throw Cr.NS_ERROR_NO_AGGREGATION;
        
        if(!iid.equals(Ci.nsIProtocolHandler) &&
           !iid.equals(Ci.nsISupports))
            throw Cr.NS_ERROR_NO_INTERFACE;

        return new ProtocolHandler();
    }
};

var ContentHandlerFactory = {
    createInstance: function(outer, iid) {
        if (outer != null) {
            throw Cr.NS_ERROR_NO_AGGREGATION;
        }
        
        if (!iid.equals(Ci.nsIContentHandler) &&
            !iid.equals(Ci.nsISupports)) {
            throw Cr.NS_ERROR_INVALID_ARG;
        }
        return new ContentHandler();
    }
};


// MODULE
// ----------------------------------------------------------------------

var Module = {
    registerSelf: function(compMgr, fileSpec, location, type) {
        compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
        compMgr.registerFactoryLocation(kPROTOCOL_CID,
                                        kPROTOCOL_NAME,
                                        kPROTOCOL_CONTRACTID,
                                        fileSpec, 
                                        location, 
                                        type);
        compMgr.registerFactoryLocation(kCONTENT_CID,
                                        kCONTENT_NAME,
                                        kCONTENT_CONTRACTID,
                                        fileSpec, 
                                        location, 
                                        type);
    },

    getClassObject: function(compMgr, cid, iid) {
        if(!cid.equals(kPROTOCOL_CID))
            throw Cr.NS_ERROR_NO_INTERFACE;

        if(!iid.equals(Ci.nsIFactory))
            throw Cr.NS_ERROR_NOT_IMPLEMENTED;

        if(cid.equals(kCONTENT_CID))
            return ContentHandlerFactory;
        else if(cid.equals(kPROTOCOL_CID))
            return ProtocolHandlerFactory;
    },

    canUnload: function(compMgr) {
        return true;
    }
};

function NSGetModule(compMgr, fileSpec) {
    return Module;
}

