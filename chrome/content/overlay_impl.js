// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;
const RDF = Cc["@mozilla.org/rdf/rdf-service;1"]
    .getService(Ci.nsIRDFService);    
const RDFCU = Cc["@mozilla.org/rdf/container-utils;1"]
    .getService(Ci.nsIRDFContainerUtils);
const BMSVC = Cc['@mozilla.org/browser/bookmarks-service;1']
    .getService(Ci.nsIBookmarksService);


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;


// GUI UTILITIES (SPECIFIC)
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById('sameplace-' + id);
}


// INITIALIZATION
// ----------------------------------------------------------------------

function initOverlay(event) {
    channel = XMPP.createChannel();

    channel.on(
        {event: 'stream', direction: 'out', state: 'open'},
        function(stream) {
            if(window == Cc["@mozilla.org/appshell/window-mediator;1"]
               .getService(Ci.nsIWindowMediator)
               .getMostRecentWindow('navigator:browser'))
                loadSidebar();
        });

    var button = document.getElementById('xmpp-button');
    button.addEventListener(
        'command', function(event) {
            if(event.target == button)
                toggleSidebar();
        }, false);

    setTimeout(function() { addBookmark(); }, 250);
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function addBookmark() {
    var folderName = 'SamePlace';

    var dsBookmarks = Cc["@mozilla.org/rdf/datasource;1?name=bookmarks"]
        .getService(Ci.nsIRDFDataSource);

    var bookmark = dsBookmarks.GetSource(
        RDF.GetResource('http://home.netscape.com/NC-rdf#Name'),
        RDF.GetLiteral(folderName), true);

    if(!(bookmark && RDFCU.IsContainer(dsBookmarks, bookmark)))
        BMSVC.createFolderInContainer(
            folderName, RDF.GetResource('NC:BookmarksRoot'), null);
}

function loadSidebar(force) {
    var frame = _('sidebar').firstChild.contentWindow;

    if(force || frame.location.href != 'chrome://sameplace/content/sameplace.xul') 
        frame.location.href = 'chrome://sameplace/content/sameplace.xul';

    showSidebar();
}

function toggleSidebar() {
    if(_('sidebar').collapsed) {
        _('sidebar').collapsed = false;
        _('sidebar-splitter').hidden = false;
    } else {
        _('sidebar').collapsed = true;
        _('sidebar-splitter').hidden = true;
    }
}

function showSidebar() {
    _('sidebar').collapsed = false;
    _('sidebar-splitter').hidden = false;
}

function log(msg) {
    Cc[ "@mozilla.org/consoleservice;1" ]
        .getService(Ci.nsIConsoleService)
        .logStringMessage(msg);
}


