
// DEFINITIONS
// ----------------------------------------------------------------------

Cu.import('resource://xmpp4moz/namespaces.jsm');


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    var request = window.arguments[0];

    for each(let concreteContact in request.concreteContacts) {
        let xulConcreteContact = document.createElement('checkbox');
        xulConcreteContact.setAttribute('account', concreteContact.account);
        xulConcreteContact.setAttribute('address', concreteContact.address);

        var addressOccurrences =
            request.concreteContacts.reduce(
                function(sum, c) c.address == concreteContact.address ? sum + 1 : sum, 0);

        // Only make a longer label is there's ambiguity (i.e. two
        // equal addresses from same account)
        xulConcreteContact.setAttribute(
            'label',
            (addressOccurrences == 1 ?
             concreteContact.address :
             (concreteContact.address + ' (via ' + concreteContact.account + ')')));

        xulConcreteContact.setAttribute('checked', 'true');
        $('#concrete-contacts').appendChild(xulConcreteContact);
    }
}

function refresh() {
    $('#main').getButton('accept').disabled = !$('#concrete-contacts > [checked="true"]');
}

function acceptedDialog() {
    var xulConcreteContact = $('#concrete-contacts').firstChild;
    while(xulConcreteContact) {
        if(xulConcreteContact.checked)
            XMPP.send(xulConcreteContact.getAttribute('account'),
                      <iq type='set'>
                      <query xmlns={ns_roster}>
                      <item jid={xulConcreteContact.getAttribute('address')} subscription='remove'/>
                      </query>
                      </iq>);

        xulConcreteContact = xulConcreteContact.nextSibling;
    }
}

function cancelledDialog() {

}