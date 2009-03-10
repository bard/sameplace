function entity(identifier) {
    var memo = arguments.callee.memo || (arguments.callee.memo = { __proto__: null });
    if(identifier in memo)
        return memo[identifier];

    var entity = identifier.match(/^xmpp:/) ?
        URI(identifier) :
        JID(identifier);

    memo[identifier] = entity;
    return entity;
}

function URI(spec) {
    if(document.location.href.match(/^chrome:\/\//)) {
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
        uri.QueryInterface(Ci.nsIURI);

        var m = uri.path.match(/(.+?)\?(.+)$/);
        var path, query;
        if(m) {
            path = m[1];
            query = m[2];
        } else {
            path = uri.path;
        }

        return {
            account: (uri.username && uri.host) ?
                uri.username + '@' + uri.host : undefined,
            address: path.replace(/^\//, ''),
            action: query
        };
    } else {
        uri = parseUri(spec);
        parseUri.options.strictMode = true;

        return {
            account: uri.authority,
            address: JID(uri.path.replace(/^\//, '')).address,
            action: uri.query
        }
    }
}

function JID(string) {
    var memo = arguments.callee.memo || (arguments.callee.memo = {});
    if(string in memo)
        return memo[string];
    var m = string.match(/^(.+?@)?(.+?)(?:\/|$)(.*$)/);

    if(!m)
        throw new Error('Malformed JID. (' + string + ')');

    var jid = {};

    if(m[1])
        jid.username = m[1].slice(0, -1);

    jid.hostname = m[2];
    jid.resource = m[3];
    jid.nick     = m[3];
    jid.full     = m[3] ? string : null;
    jid.address  = jid.username ?
        jid.username + '@' + jid.hostname :
        jid.hostname;

    memo[string] = jid;
    return jid;
}
