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
 * Behaviour for a <div> containing an <iframe>, which will be turned
 * into an edit area.
 *
 * Custom callbacks:
 *
 *   - onLoad(): called when edit area is ready.
 *
 *   - onAcceptContent(xhtml): called when user presses Enter; passed
 *     argument is an XML object with XHTML content.
 *
 *   - onResize(height): called when edit area grows to accomodate
 *     input; passed argument is the new height of the <div>.
 *
 * Dependencies: conv.js
 *
 */


// INITIALIZATION
// ----------------------------------------------------------------------

function Input(container) {
    var _this = this;
    this._container = container;
    this._iframe = container.getElementsByTagName('iframe')[0];

    this._iframe.contentDocument.open();
    this._iframe.contentDocument.write(
        '<html xmlns="http://www.w3.org/1999/xhtml">' +
        '<head><title></title>' +
        '<style type="text/css">' +
        'body { margin: 0; font-family: sans-serif; font-size: 10pt; }' +
        '</style></head>' +
        '<body></body></html>');
    this._iframe.contentDocument.close();
    this._iframe.contentDocument.designMode = 'on';

    this._originalHeight = this._iframe.contentDocument.body.scrollHeight;

    this._iframe.contentWindow.addEventListener(
        'scroll', function(event) {
            var totalHeight = _this._iframe.contentDocument.body.scrollHeight;

            // If scroll event is caused by appearance of a horizontal
            // scroll bar, e.g. when only a very long non-wrapping
            // line has been written, current default height (two
            // lines) will be less than the total height (one line).
            // We don't want the input area to shrink below the
            // default, though, so guarding here against such case.

            if(container.clientHeight < totalHeight)
                container.style.height = totalHeight + 'px';

        }, false);
    this._iframe.contentWindow.addEventListener(
        'resize', function(event) {
            _this.onResize(container.clientHeight); }, false);
    this._iframe.contentWindow.addEventListener(
        'keypress', function(event) {
            _this.pressedKey(event); }, false);
    this._iframe.addEventListener(
        'load', function(event) {
            event.currentTarget && _this.onLoad(); }, true);    
}


// CALLBACKS
// ----------------------------------------------------------------------

Input.prototype.onLoad = function() {};

Input.prototype.onAcceptContent = function(content) {};

Input.prototype.onResize = function(height) {};


// PUBLIC FUNCTIONALITY
// ----------------------------------------------------------------------

Input.prototype.focus = function() {
    this._iframe.contentWindow.focus();
};

Input.prototype.blur = function() {
    this._iframe.blur();
};

Input.prototype.reset = function() {
    var document = this._iframe.contentDocument;
    this._container.style.height = this._originalHeight + 'px';
    
    window.setTimeout(
        function() {
            document.body.innerHTML = '';
            document.designMode = 'off';
            document.designMode = 'on';
        }, 0);
};

Input.prototype.execCommand = function(command, argument) {
    this._iframe.contentDocument.execCommand(
        command, false, argument);
};


// INTERNALS
// ----------------------------------------------------------------------

Input.prototype.pressedKey = function(event) {
    if(event.keyCode == KeyEvent.DOM_VK_RETURN) {
        var body = event.currentTarget.document.body;
        
        event.preventDefault();
        if(body.innerHTML == '<br>')
            return;

        xhtmlBody = conv.htmlDOMToXHTML(body);

        // Stripping trailing <br/>, if present.
        var lastChildIndex = xhtmlBody.children().length()-1;
        if(xhtmlBody.*::*[lastChildIndex].localName() == 'br')
            delete xhtmlBody.*::*[lastChildIndex];

        this.onAcceptContent(xhtmlBody);
        this.reset();

    } else if(event.charCode == 'h'.charCodeAt(0) &&
              event.ctrlKey == true) {
        event.preventDefault();
    }
};

