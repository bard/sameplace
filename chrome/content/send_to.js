function selectedContact(event) {
    var account = event.target.getAttribute('account');
    var address = event.target.getAttribute('address');
    var type = XMPP.isMUC(account, address) ? 'groupchat' : 'normal';

    var node = document.popupNode;
    var url, text;
    if(node.nodeName.toLowerCase() == 'a' && ('href' in node)) {
        url = node.href;
        text = node.textContent.replace(/^\s*/, '').replace(/\s*$/, '');
    } else {
        url = getBrowser().currentURI.spec;
        text = getBrowser().contentDocument.title;
    }

    XMPP.send(account,
              <message to={address} type={type}>
              <body>{url}</body>
              <html xmlns="http://jabber.org/protocol/xhtml-im">
              <body xmlns="http://www.w3.org/1999/xhtml">
              <a href={url}>{text || url}</a>
              </body>
              </html>
              <x xmlns="jabber:x:oob">
              <url>{url}</url>
              </x>
              </message>);
}

function showingPopup(event) {
    const ns_muc = 'http://jabber.org/protocol/muc';
    const ns_muc_user = 'http://jabber.org/protocol/muc#user';
    var xulMenupopup = event.target;

    function makeContactItem(account, address, label, show) {
        var xulMenuitem = document.createElement('menuitem');
        xulMenuitem.setAttribute('account', account);
        xulMenuitem.setAttribute('address', address);
        xulMenuitem.setAttribute('label', label);
        xulMenuitem.setAttribute('availability', 'available');
        xulMenuitem.setAttribute('show', show);
        xulMenuitem.setAttribute('class', 'menuitem-iconic xmpp-presence');
        
        return xulMenuitem;
    }

    // Contacts


    var contactItems = XMPP.cache.fetch({
        event     : 'presence',
        direction : 'in',
        stanza    : function(s) {
            return s.@type == undefined && s.ns_muc_user::x == undefined;
        }
    }).map(function(presence) {
        var address = XMPP.JID(presence.stanza.@from).address;
        return makeContactItem(presence.account,
                               address,
                               XMPP.nickFor(presence.account, address),
                               presence.stanza.show.toString());
    });

    var roomItems = XMPP.cache.fetch({
        event     : 'presence',
        direction : 'out',
        stanza    : function(s) {
            return s.ns_muc::x != undefined; // && s.@type == undefined ?
        }
    }).map(function(presence) {
        var address = XMPP.JID(presence.stanza.@to).address;
        return makeContactItem(presence.account,
                               address,
                               address);
    });

    contactItems.concat(roomItems).sort(function(xulItem1, xulItem2) {
        return (xulItem1.getAttribute('label').toLowerCase() >
                xulItem2.getAttribute('label').toLowerCase());
    }).forEach(function(xulItem) {
        xulMenupopup.appendChild(xulItem);
    });
}

function hiddenPopup(event) {
    var xulPopup = event.target;
    while(xulPopup.firstChild)
        xulPopup.removeChild(xulPopup.firstChild);
}
