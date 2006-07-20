// ----------------------------------------------------------------------
// GUI REACTIONS

function samepageRequestedOpenEditor(event) {
    var account = getAncestorAttribute(event.currentTarget, 'account');
    var address = getAncestorAttribute(event.currentTarget, 'address');
    var url = 'chrome://samepage/content/samepage.xul' + '?account=' + account + '&address=' + address;

    withContent(
        account, address, url,
        function(window) {
            var index = findBrowserIndex(account, address, url);
            top.getBrowser().selectedTab = top.getBrowser().tabContainer.childNodes[index];
        });
}
