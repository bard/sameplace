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


var behaviour = behaviour || {};

/**
 * Behaviour for info popup.
 *
 * Dependencies: jQuery.js
 *
 */

behaviour.info = function(info) {
    function getElementByContent(parent, textContent) {
        for(var child = parent.firstChild; child; child = child.nextSibling) {
            if(child.textContent == textContent)
                return child;
        }

        for(var child = parent.firstChild; child; child = child.nextSibling) {
            var matchingChild = getElementByContent(child, textContent);
            if(matchingChild)
                return matchingChild;
        }
        return undefined;
    }

    function _(role) {
        return $('[@role=' + role + ']', info)[0];
    }

    for each(role in ['resources']) {
        _(role).addEventListener(
            'DOMNodeInserted', function(event) {
                info.refresh(event.currentTarget);
            }, false);
        
        _(role).addEventListener(
            'DOMNodeRemoved', function(event) {
                info.refresh(event.currentTarget);
            }, false);
    };

    info.updateAddress = function(address) {
        _('address').textContent = address;
    };

    info.updateResources = function(resource, availability) {
        if(!resource)
            return;

        var domResource = getElementByContent(_('resources'), resource);
    
        if(domResource) {
            if(availability == 'unavailable')
                _('resources').removeChild(domResource);
        }
        else 
            if(availability != 'unavailable') {
                domResource = document.createElement('li');
                domResource.textContent = resource;
                _('resources').insertBefore(domResource, _('resources').firstChild);
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
                $(element.parentNode).css({visible: ''});
            else {
                alert('here')
                $(element.parentNode).css({visible: 'none'});
            }
            break;
            default: throw new Error('Unexpected.');
        }
    };

    info.hasResource = function(resource) {
        return getElementByContent(_('resources'), resource);
    };

    info.setMode = function(mode) {
        switch(mode) {
            case 'groupchat':
            _('heading-resources').textContent = 'Participants';
            break;
            case 'chat':
        
            break;
        }
    };
};

