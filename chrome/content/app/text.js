var text = {};

/**
 * For each match of regexp in string, executes processFn.  Returns an
 * array of unprocessed string parts plus processed string parts.
 *
 */
    
text.mapMatch = function(string, regexp, processFn) {
    if(!regexp.global)
        throw new Error('RegExp must be global. (' + regexp.source + ')');

    var parts = [];
    var start = 0;

    var match = regexp.exec(string);
    while(match) {
        parts.push(string.substring(start, match.index));

        start = regexp.lastIndex;

        parts.push(processFn(match));

        match = regexp.exec(string);
    }
    parts.push(string.substring(start, string.length));

    return parts;
};

