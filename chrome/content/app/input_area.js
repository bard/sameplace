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
 * Wrapper for iframe providing an HTML input area.
 *
 */


// INITIALIZATION
// ----------------------------------------------------------------------

function InputArea(iframe) {
    _this = this;
    this._iframe = iframe;

    iframe.contentDocument.open();
    iframe.contentDocument.write(
        '<html xmlns="http://www.w3.org/1999/xhtml">' +
        '<head><title></title></head>' +
        '<body style="margin: 0; font-family: sans-serif; font-size: 10pt;">' +
        '</body></html>');
    iframe.contentDocument.close();
    iframe.contentDocument.designMode = 'on';

    iframe.contentWindow.addEventListener(
        'keypress', function(event) { _this.pressedKey(event); }, false);
    iframe.addEventListener(
        'load', function(event) { event.currentTarget && _this.onLoad(); }, true);    
}


// CALLBACKS
// ----------------------------------------------------------------------

InputArea.prototype.onLoad = function() {};

InputArea.prototype.onAcceptContent = function(content) {};


// PUBLIC FUNCTIONALITY
// ----------------------------------------------------------------------

InputArea.prototype.focus = function() {
    this._iframe.contentWindow.focus();
};

InputArea.prototype.reset = function() {
    var document = this._iframe.contentDocument;
    
    window.setTimeout(
        function() {
            document.body.innerHTML = '';
            document.designMode = 'off';
            document.designMode = 'on';
        }, 0);
};

InputArea.prototype.execCommand = function(command, argument) {
    this._iframe.contentDocument.execCommand(
        command, false, argument);
};


// INTERNALS
// ----------------------------------------------------------------------

InputArea.prototype.pressedKey = function(event) {
    if(event.keyCode == KeyEvent.DOM_VK_RETURN) {
        var document = event.currentTarget.document;
        var content = document.body.innerHTML;
        
        event.preventDefault();
        if(content == '<br>')
            return;

        this.onAcceptContent(content);
        this.reset();

    } else if(event.charCode == 'h'.charCodeAt(0) && event.ctrlKey == true) {
        event.preventDefault();
    }
};

