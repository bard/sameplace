const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

try {

/* ---------------------------------------------------------------------- */
/*                        Protocol specific code                          */

const kSCHEME = 'xmpp';
const kPROTOCOL_NAME = 'XMPP Protocol';
const kPROTOCOL_CID = Components.ID('{101008f2-4454-4bdb-9f3a-ae3b02eeb20d}');
const kCONTENT_NAME = 'XMPP Content Handler';
const kCONTENT_CID = Components.ID('{2d12cfe5-8cdd-49bb-b766-e551343c1265}');


/* ---------------------------------------------------------------------- */
/*                            Template code                               */

const kPROTOCOL_CONTRACTID = '@mozilla.org/network/protocol;1?name=' + kSCHEME;
const kSIMPLEURI_CONTRACTID = '@mozilla.org/network/simple-uri;1';
const kIOSERVICE_CONTRACTID = '@mozilla.org/network/io-service;1';
const kCONTENT_CONTRACTID = '@mozilla.org/uriloader/content-handler;1?type=x-application-' + kSCHEME;


// PROTOCOL HANDLER
// ----------------------------------------------------------------------

const ww = Cc['@mozilla.org/embedcomp/window-watcher;1']
    .getService(Ci.nsIWindowWatcher);

function ProtocolHandler() {}

ProtocolHandler.prototype = {
    scheme: kSCHEME,

    defaultPort: 5222,

    protocolFlags: Ci.nsIProtocolHandler.URI_NORELATIVE,

    allowPort: function(port, scheme) {
        return false;
    },

    newURI: function(spec, charset, baseURI) {
        // xmpp URIs can come, with regard to the authority component,
        // in three formats:
        //
        //   xmpp:contact@domain.org
        //   xmpp:///contact@domain.org
        //   xmpp://user@domain.org/contact@domain.org
        //
        // We tell them apart by the number of slashes: three or none
        // means there's no authority component; two means there's an
        // authority component.

        var uri = Cc['@mozilla.org/network/standard-url;1']
            .createInstance(Ci.nsIStandardURL);

        var type;
        if(spec.match(/^xmpp:\/{3}/) ||
           spec.match(/^xmpp:[^\/]/))
            type = Ci.nsIStandardURL.URLTYPE_NO_AUTHORITY;
        else if(spec.match(/^xmpp:\/\/[^\/]/))
            type = Ci.nsIStandardURL.URLTYPE_AUTHORITY;
        else
            throw new Error('Malformed URL'); // XXX should probably throw nsIException

        uri.init(type, 5222, spec, null, null);
        return uri.QueryInterface(Ci.nsIURI);
    },

    newChannel: function(uri) {

        // Look for the query part
        var m = uri.path.match(/(.+?)\?(.+)$/);
        var path, query;
        if(m) {
            path = m[1];
            query = m[2];
        } else {
            path = uri.path;
        }

        // Path part will always start with a slash after URI parsing,
        // even for URIs in the form of xmpp:node@domain
        var jid = path.replace(/^\//, '');
        var account = uri.username + '@' + uri.host;

        switch(query) {
        case 'roster':
        case 'remove':
        case 'subscribe':
        case 'unsubscribe':
        case 'join':
        case 'message':
        default:
            var array = Cc['@mozilla.org/supports-array;1']
                .createInstance(Ci.nsISupportsArray);
            array.AppendElement(asXPCOM(account));
            array.AppendElement(asXPCOM(jid));

            ww.openWindow(
                null,
                'chrome://sameplace/content/dialogs/' + (
                    query == 'join' ? 'join_room.xul' : 'open_conversation.xul'
                ),
                null, '', array);
        }

        return new Channel(uri);
    },

    QueryInterface: function(iid) {
        if(!iid.equals(Ci.nsIProtocolHandler) &&
           !iid.equals(Ci.nsISupports))
            throw Cr.NS_ERROR_NO_INTERFACE;

        return this;
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

function Channel(uri) {
   this.URI = uri;
   this.originalURI = uri;
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


// INTERNALS
// ----------------------------------------------------------------------

function asXPCOM(thing) {
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


// XPCOM REGISTRATION
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




} catch(e) {
    dump(e + '\n');
    dump(e.stack + '\n');
}
