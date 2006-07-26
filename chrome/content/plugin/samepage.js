// ----------------------------------------------------------------------
// GUI REACTIONS

function samepageRequestedOpenEditor(event) {
    var account = getAncestorAttribute(event.currentTarget, 'account');
    var address = getAncestorAttribute(event.currentTarget, 'address');
    var url = 'chrome://samepage/content/samepage.xul';

    withContent(
        account, address, url,
        function(window) {
            focusContent(account, address, url);
        });
}
