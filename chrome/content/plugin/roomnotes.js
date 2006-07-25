// ----------------------------------------------------------------------
// GUI REACTIONS

function noteRequestedOpenNotes(event) {
    var account = getAncestorAttribute(event.currentTarget, 'account');
    var address = getAncestorAttribute(event.currentTarget, 'address');
    var nick = getAncestorAttribute(event.currentTarget, 'resource');
    var url = 'chrome://roomnotes/content/roomnotes.xul' +
        '?account=' + account +
        '&address=' + address +
        '&nick=' + nick;
 
   withContent(
        account, address, url,
        function(window) {
            var index = findBrowserIndex(account, address, url);
            top.getBrowser().selectedTab = top.getBrowser().tabContainer.childNodes[index];
        });
}


// ----------------------------------------------------------------------
// HOOKS

window.addEventListener(
    'load', function(event) {
        addHook('open conversation', function(conversation) {
                    _(conversation, {role: 'chat-output'}).addEventListener(
                        'click', function(event) { noteRequestedSave(event); }, true);
                });
    }, false);


// ----------------------------------------------------------------------
// GUI ACTIONS

function noteRequestedSave(event) {
    if(event.target.className != 'message')
        return;
    
    var account = getAncestorAttribute(event.currentTarget, 'account');
    var address = getAncestorAttribute(event.currentTarget, 'address');
    var nick = getAncestorAttribute(event.currentTarget, 'resource');
    var url = 'chrome://roomnotes/content/roomnotes.xul' +
        '?account=' + account +
        '&address=' + address +
        '&nick=' + nick;
 
    withContent(
        account, address, url,
        function(window) {
            window.sendNoteAddition(
                account, address, nick,
                event.target.firstChild.nextSibling.textContent);
        });
}

