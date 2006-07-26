// ----------------------------------------------------------------------
// GUI REACTIONS

function samepageRequestedOpenEditor(event) {
    var account = getAncestorAttribute(event.currentTarget, 'account');
    var address = getAncestorAttribute(event.currentTarget, 'address');
    var url = 'chrome://samepage/content/samepage.xul';

    withContent(
        account, address, url,
        function(window) {
            top.getBrowser().selectedTab =
                top.getBrowser().tabContainer.childNodes[
                    findBrowserIndex(account, address, url)];
        });
}
