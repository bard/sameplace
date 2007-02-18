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
 * Behaviour for a <div> containing an <iframe>, which will be turned
 * into an edit area.
 *
 * Custom events:
 *
 *   - 'load': thrown when edit area is ready.
 *
 *   - 'accept' thrown when user presses Enter; use "xhtml" property
 *     to retrieve xhtml content.
 *
 *   - 'resizing': thrown when edit area grows to accomodate
 *     input.
 *
 * Dependencies: conv.js
 *
 */

behaviour.input = function(container) {
    // Utilities
    // ------------------------------------------------------------

    function forwardKeyEvent(event, target) {
        var synthKeyEvent = document.createEvent('KeyEvents');
        synthKeyEvent.initKeyEvent(
            event.type,      //  in DOMString typeArg,
            false,           //  in boolean canBubbleArg,
            false,           //  in boolean cancelableArg,
            null,            //  in nsIDOMAbstractView viewArg,
                             //     Specifies UIEvent.view. This value may be null.
            event.ctrlKey,   //  in boolean ctrlKeyArg,
            event.altKey,    //  in boolean altKeyArg,
            event.shiftKey,  //  in boolean shiftKeyArg,
            event.metaKey,   //  in boolean metaKeyArg,
            event.keyCode,   //  in unsigned long keyCodeArg,
            event.charCode); //  in unsigned long charCodeArg);
        target.dispatchEvent(synthKeyEvent);
    }

    function dispatchSimpleEvent(eventType, target) {
        var synthEvent = document.createEvent('Event');
        synthEvent.initEvent(eventType, true, false);
        target.dispatchEvent(synthEvent);
    }
    
    // Local state
    // ------------------------------------------------------------

    var iframe = container.getElementsByTagName('iframe')[0];
    var originalHeight = iframe.contentDocument.body.scrollHeight;

    // Setting up iframe content
    // ------------------------------------------------------------
    
    iframe.contentDocument.open();
    iframe.contentDocument.write(
        '<html xmlns="http://www.w3.org/1999/xhtml">' +
        '<head><title></title>' +
        '<style type="text/css">' +
        'body { margin: 0; font-family: sans-serif; font-size: 10pt; }' +
        '</style></head>' +
        '<body></body></html>');
    iframe.contentDocument.close();
    iframe.contentDocument.designMode = 'on';

    // Wiring iframe events and reactions
    // ------------------------------------------------------------
    
    iframe.contentWindow.addEventListener(
        'scroll', function(event) {
            var totalHeight = iframe.contentDocument.body.scrollHeight;

            // If scroll event is caused by appearance of a horizontal
            // scroll bar, e.g. when only a very long non-wrapping
            // line has been written, current default height (two
            // lines) will be less than the total height (one line).
            // We don't want the input area to shrink below the
            // default, though, so guarding here against such case.

            if(container.clientHeight < totalHeight)
                container.style.height = totalHeight + 'px';

        }, false);

    iframe.contentWindow.addEventListener(
        'resize', function(event) {
            dispatchSimpleEvent('resizing', container);
        }, false);

    iframe.contentWindow.addEventListener(
        'keypress', function(event) {
            if(event.keyCode == KeyEvent.DOM_VK_RETURN) {
                event.preventDefault();
                if(event.currentTarget.document.body.innerHTML == '<br>')
                    return;
                
                var content = container.xhtml;
                if(content) {
                    dispatchSimpleEvent('accept', container);
                    container.reset();
                }
            }
        }, false);

    iframe.contentWindow.addEventListener(
        'keypress', function(event) {
            forwardKeyEvent(event, container);
        }, false);

    iframe.contentWindow.addEventListener(
        'keyup', function(event) {
            forwardKeyEvent(event, container);
        }, false);
    
    iframe.addEventListener(
        'load', function(event) {
            if(event.currentTarget)
                dispatchSimpleEvent('load', container);
        }, true);

    // Adding/overriding container methods
    // ------------------------------------------------------------

    container.isEmpty = function() {
        return container.html == '<br>';
    };

    container.focus = function() {
        iframe.contentWindow.focus();
    };

    container.blur = function() {
        iframe.blur();
    };

    container.execCommand = function(command, argument) {
        iframe.contentDocument.execCommand(
            command, false, argument);
    };

    container.__defineGetter__(
        'html', function() {
            return iframe.contentDocument.body.innerHTML;
        });

    container.__defineGetter__(
        'xhtml', function() {
            var xhtmlBody = conv.htmlDOMToXHTML(iframe.contentDocument.body);

            // Stripping trailing <br/>, if present.
            var lastChildIndex = xhtmlBody.children().length()-1;
            if(xhtmlBody.*::*[lastChildIndex].localName() == 'br')
                delete xhtmlBody.*::*[lastChildIndex];

            return xhtmlBody;
        });

    container.reset = function() {
        var document = iframe.contentDocument;
        container.style.height = originalHeight + 'px';
        
        window.setTimeout(
            function() {
                document.body.innerHTML = '';
                document.designMode = 'off';
                document.designMode = 'on';
            }, 0);
    };
}
