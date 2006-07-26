// ----------------------------------------------------------------------
// GUI REACTIONS

function noteRequestedOpenNotes(event) {
    var account = getAncestorAttribute(event.currentTarget, 'account');
    var address = getAncestorAttribute(event.currentTarget, 'address');
    var url = 'chrome://roomnotes/content/roomnotes.xul';
 
    withContent(
        account, address, url,
        function(window) {
            focusContent(account, address, url);
        });
}


// ----------------------------------------------------------------------
// GUI REACTIONS

function noteRequestedSave(event) {
    var element = document.popupNode;
    if(element.className != 'message')
        while(element.nodeName != 'body' &&
              element.className != 'message')
            element = element.parentNode;

    if(element.className == 'message') {
        // XXX not clean, should somehow depend on event or popupNode, not on current conversation
        var url = 'chrome://roomnotes/content/roomnotes.xul';
        var account = _('conversations').selectedPanel.getAttribute('account');
        var address = _('conversations').selectedPanel.getAttribute('address');
        withContent(
            account, address, url,
            function(window) {
                window.sendNoteAddition(
                    account, address,
                    element.firstChild.nextSibling.textContent);
            });
    }
}
