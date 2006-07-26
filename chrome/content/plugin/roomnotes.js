// ----------------------------------------------------------------------
// GUI REACTIONS

function noteRequestedOpenNotes(event) {
    var account = getAncestorAttribute(event.currentTarget, 'account');
    var address = getAncestorAttribute(event.currentTarget, 'address');
    var url = 'chrome://roomnotes/content/roomnotes.xul';
 
    withContent(
        account, address, url,
        function(window) {
            top.getBrowser().selectedTab =
                top.getBrowser().tabContainer.childNodes[
                    findBrowserIndex(account, address, url)];
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
    var url = 'chrome://roomnotes/content/roomnotes.xul';
 
    withContent(
        account, address, url,
        function(window) {
            window.sendNoteAddition(
                account, address,
                event.target.firstChild.nextSibling.textContent);
        });
}

