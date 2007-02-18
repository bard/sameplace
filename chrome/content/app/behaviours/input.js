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
            var synthResizingEvent = document.createEvent('Event');
            synthResizingEvent.initEvent('resizing', true, false);
            container.dispatchEvent(synthResizingEvent);
        }, false);

    iframe.contentWindow.addEventListener(
        'keypress', function(event) {
            if(event.keyCode == KeyEvent.DOM_VK_RETURN) {
                event.preventDefault();
                if(event.currentTarget.document.body.innerHTML == '<br>')
                    return;
                
                var content = container.xhtml;
                if(content) {
                    var synthEvent = document.createEvent('Event');
                    synthEvent.initEvent('accept', true, false);
                    container.dispatchEvent(synthEvent);
                    container.reset();
                }
            }
        }, false);

    iframe.addEventListener(
        'load', function(event) {
            if(event.currentTarget) {
                var synthLoadEvent = document.createEvent('Event');
                synthLoadEvent.initEvent('load', true, false);
                container.dispatchEvent(synthLoadEvent);
            }
        }, true);

    // Adding/overriding container methods
    // ------------------------------------------------------------

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
        'xhtml', function() {
            var body = iframe.contentDocument.body;

            var xhtmlBody = conv.htmlDOMToXHTML(body);

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
