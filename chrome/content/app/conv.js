// DEFINITIONS
// ----------------------------------------------------------------------

var serializer  = new XMLSerializer();
var parser      = new DOMParser();

var conv = {};


// PUBLIC FUNCTIONALITY
// ----------------------------------------------------------------------

conv.toXML = function(domElement) {
    return new XML(serializer.serializeToString(domElement));    
};

conv.toDOM = function(thing) {
    return parser.parseFromString((typeof(thing) == 'xml' ?
                                   thing.toXMLString() : thing),
                                  'application/xhtml+xml').documentElement;    
};
