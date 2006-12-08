// DEFINITIONS
// ----------------------------------------------------------------------

var serializer  = new XMLSerializer();
var parser      = new DOMParser();

var smileys = {
    '0:-)':  'angel',
    '0:)':   'angel',
    ':\'(':  'crying',
    '>:-)':  'devil-grin',
    '>:)':   'devil-grin',
    'B-)':   'glasses',
    'B)':    'glasses',
    ':-*':   'kiss',
    ':*':    'kiss',
    ':-(|)': 'monkey',
    ':(|)':  'monkey',
    ':-|':   'plain',
    ':-(':   'sad',
    ':(':    'sad',
    ':-))':  'smile-big',
    ':))':   'smile-big',
    ':-)':   'smile',
    ':)':    'smile',
    ':-D':   'grin',
    ':D':    'grin',
    ':-0':   'surprise',
    ':0':    'surprise',
    ';)':    'wink',
    ';-)':   'wink'
};
var smileyRegexp;

var conv = {};


// INITIALIZATION
// ----------------------------------------------------------------------

var smileySymbols = [];
for(var symbol in smileys)
    smileySymbols.push(symbol);

smileyRegexp = smileySymbols.map(
    function(symbol) {
        return symbol.replace(/(\(|\)|\*|\|)/g, '\\$1');
    }).join('|');


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

conv.plainTextToHTML = function(text) {
    var container = document.createElement('div');
    
    text = text.toString();
    
    var rx = new RegExp([urlRegexp.source, smileyRegexp].join('|'), 'g');
    
    var start = 0;
    var match = rx.exec(text);
    while(match) {
        container.appendChild(
            document.createTextNode(
                text.substring(start, match.index)));

        start = rx.lastIndex;

        var translatedElement;
        if(match[0].match(smileyRegexp)) {
            translatedElement = document.createElement('img');
            translatedElement.setAttribute('class', 'emoticon');
            translatedElement.setAttribute('alt', match[0]);
            translatedElement.
                setAttribute('src',
                             'emoticons/' + smileys[match[0]] + '.png');
        } else {
            translatedElement = document.createElement('a');
            var url = match[0];
            translatedElement.textContent = url;
            if(!/^https?:\/\//.test(url))
                url = 'http://' + url;
            translatedElement.setAttribute('href', url);
        }
        container.appendChild(translatedElement);

        match = rx.exec(text);
    }
    container.appendChild(
        document.createTextNode(
            text.substring(start, text.length)));

    return container;
}