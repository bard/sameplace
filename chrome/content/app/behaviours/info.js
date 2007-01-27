/*
  Copyright (C) 2005-2006 by Massimiliano Mirra

  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 2 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software
  Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301 USA

  Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
*/


/**
 * Wrapper for popup showing contact information.
 *
 */


// GLOBAL STATE
// ----------------------------------------------------------------------

var info = {};


// PUBLIC FUNCTIONALITY
// ----------------------------------------------------------------------

info.init = function(element) {
    this._root = element;
    
    for each(role in ['resources']) {
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

    var domResource = getElementByContent(this._('resources'), resource);
    
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
    return getElementByAttribute(this._root, 'role', role);
};