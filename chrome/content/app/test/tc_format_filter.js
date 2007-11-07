var regexp = /(^|\s)\*(\S|\S.+?\S)\*($|[^\d\w])/g;

var shouldMatch = [
    ' *hello* ',
    ' *hello world* ',
    '\n*hello world*',
    '*hello world* ',
    '*hello world*',
    '*hello world*,',
    '*1*'
];

var shouldNotMatch = [
    'http://test.com/my*nice*url',
    'inner*stars*stars',
    ' * stars with spaces * ',
    '* 1 *'
];

var matchResults = shouldMatch.map(function(string) {
    return string + '\t->\t' + (string.match(regexp) ? 'OK' : 'FAIL');
});

var notMatchResults = shouldNotMatch.map(function(string) {
    return string + '\t->\t' + (string.match(regexp) ? 'FAIL' : 'OK');
});


repl.print(matchResults.concat(notMatchResults).join('\n'));


    function processFormatBold(xmlMessageBody) {
        var regexp = /(^|\s)\*(.+?)\*($|[^\w\d])/g;
        
        return xml.mapTextNodes(xmlMessageBody, function(textNode) {
            return text.mapMatch(textNode.toString(), regexp, function(wholeMatch, before,
                                                                content, after) {
                return <span style="font-weight: bold;">{before}{content}{after}</span>;
            });
        });
    }

XML.ignoreWhitespace = false;
XML.prettyPrinting = false;
processFormatBold(<body> hello *world* ahah</body>)
