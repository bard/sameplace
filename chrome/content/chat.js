// UTILITIES
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById(id);
}

function visible(element) {
    element.style.display = 'block';
}

function hidden(element) {
    element.style.display = 'none';
}


// INITIALIZATION
// ----------------------------------------------------------------------

function init(event) {
    for each(id in ['topic', 'resources', 'groups']) {
        _(id).addEventListener(
            'DOMNodeInserted', function(event) {
                refresh(event.currentTarget);
            }, false);

        _(id).addEventListener(
            'DOMNodeRemoved', function(event) {
                refresh(event.currentTarget);
            }, false);

        refresh(_(id));
    }
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function refresh(element) {
    switch(element.getAttribute('id')) {
    case 'topic':
        (element.textContent ? visible : hidden)
            (element.parentNode);
        break;
    case 'resources':
    case 'groups':
        (element.getElementsByTagName('li').length > 0 ? visible : hidden)
            (element.parentNode);
        break;
    }
}