// GLOBAL STATE
// ----------------------------------------------------------------------

var info = {};


// PUBLIC FUNCTIONALITY
// ----------------------------------------------------------------------

info.init = function(element) {
    this._root = element;
    
    for each(role in ['topic', 'groups', 'resources']) {
        this._(role).addEventListener(
            'DOMNodeInserted', function(event) {
                info.refresh(event.currentTarget);
            }, false);

        this._(role).addEventListener(
            'DOMNodeRemoved', function(event) {
                info.refresh(event.currentTarget);
            }, false);
    }
};

info.updateAddress = function(address) {
    this._('address').textContent = address;
};

info.updateTitle = function(address) {
    document.title = address;
};

info.updateResources = function(resource, availability) {
    if(!resource)
        return;

    var domResource = x(this._('resources'), '//*[text()="' + resource + '"]');
    
    if(domResource) {
        if(availability == 'unavailable')
            this._('resources').removeChild(domResource);
    }
    else 
        if(availability != 'unavailable') {
            domResource = document.createElement('li');
            domResource.textContent = resource;
            this._('resources').insertBefore(domResource, this._('resources').firstChild);
        }
};

info.refresh = function(element) {
    switch(element.getAttribute('role')) {
    case 'topic':
        (element.textContent ? visible : hidden)
            (element.parentNode);
        break;
    case 'resources':
    case 'groups':
        if(element.getElementsByTagName('li').length > 0)
            visible(element.parentNode);
        else 
            hidden(element.parentNode);
        break;
    default: throw new Error('Unexpected.');
    }
};


// INTERNALS
// ----------------------------------------------------------------------

info._ = function(role) {
    return x(this._root, '//*[@role="' + role + '"]');
};

