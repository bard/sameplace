/*
 * Copyright 2006-2007 by Massimiliano Mirra
 * 
 * This file is part of SamePlace.
 * 
 * SamePlace is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 3 of the License, or (at your
 * option) any later version.
 * 
 * SamePlace is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * The interactive user interfaces in modified source and object code
 * versions of this program must display Appropriate Legal Notices, as
 * required under Section 5 of the GNU General Public License version 3.
 *
 * In accordance with Section 7(b) of the GNU General Public License
 * version 3, modified versions must display the "Powered by SamePlace"
 * logo to users in a legible manner and the GPLv3 text must be made
 * available to them.
 * 
 * Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
 *  
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
    // XXX should not be hardcoded; but other means of setting it seem unreliable
    var originalHeight = 36;


    // Setting up iframe content
    // ------------------------------------------------------------

    // Separate file for input area won't work in Firefox2, so we use
    // this.  This in turn doesn't work in Firefox3, so we use the
    // separate file.

    if(navigator.userAgent.match(/rv:1.8/)) {
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
    }

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
            // Using a bug to fix another:
            // https://bugzilla.mozilla.org/show_bug.cgi?id=309903
            // Swallowing "printable" keypresses so that they don't
            // trigger find-as-you-type.
            if(!event.altKey && !event.ctrlKey)
                event.stopPropagation();
        }, false);

    iframe.contentWindow.addEventListener(
        'keyup', function(event) {
            forwardKeyEvent(event, container);
        }, false);

    iframe.contentWindow.addEventListener(
        'keypress', function(event) {
            if(event.ctrlKey &&
               !event.altKey &&
               !event.shiftKey &&
               !event.metaKey) {

                var command;
                switch(String.fromCharCode(event.charCode)) {
                case 'b':
                    command = 'bold';
                    break;
                case 'i':
                    command = 'italic';
                    break;
                case 'u':
                    command = 'underline';
                    break;
                }

                if(command) {
                    event.preventDefault();
                    iframe.contentDocument.execCommand(command, false, null);
                }
            }
        }, false);

    iframe.addEventListener('load', function(event) {
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
        'editArea', function() {
            return iframe.contentWindow;
        });

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
