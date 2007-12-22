var request;

function init() {
    request = window.arguments[0];
    
    var xulContacts = document.getElementById('contacts');
    for each(var [account, address, preSelected] in request.contacts) {
        var xulContact = document.createElement('listitem');
        xulContact.setAttribute('type', 'checkbox');
        xulContact.setAttribute('value', account + '\0' + address);
        xulContact.setAttribute('label', address);
        xulContact.setAttribute('checked', preSelected);
        xulContact.setAttribute('tooltiptext', 'Via ' + account);
        xulContacts.appendChild(xulContact);
    }

    document.getElementById('description').textContent = request.description;
}


function chosenOk() {
    request.choice = true;
}

function chosenCancel() {
    request.choice = false;
}