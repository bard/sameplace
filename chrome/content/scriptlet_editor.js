/*
  Copyright (C) 2007 by Massimiliano Mirra

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


// STATE
// ----------------------------------------------------------------------

var scriptlet;


// INITIALIZATION
// ----------------------------------------------------------------------

function init(event) {
    scriptlet = window.arguments[0];
    $('#main')._.getButton('extra2').disabled = true;
    updateState();
    updateAutoRestart();

    // XXX horrible kludge!
    setTimeout(
        function() {
            CodePress.run();
            stretchEditor();
            setTimeout(
                function() {
                    editor.setCode(scriptlet.source);
                    window.addEventListener(
                        'resize', function(event) { stretchEditor(); }, false);
                    editor.addEventListener(
                        'modified', function(event) { modifiedSource(); }, false);

                    // XXX bard: turns designMode off and back on.
                    // Without this, just after editor has appeared,
                    // it seems like it's possible to add text but not
                    // to remove (backspace, delete, etc.).
                    editor.reset();
                }, 500);
        }, 0);
}

function stretchEditor() {
    editor.style.height = _('editor-container').boxObject.height + 'px'
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function modifiedSource() {
    $('#main')._.getButton('extra2').disabled = false;
}

function requestedClose() {
    return true;
}

function requestedSave() {
    scriptlet.save(editor.getCode());
    $('#main')._.getButton('extra2').disabled = true;
    if($('#auto-restart')._.checked)
        restart();

    editor.contentWindow.focus();
    return false;
}

function requestedRestart() {
    restart();
    editor.contentWindow.focus();
    return false;
}

function toggledAutoRestart() {
    updateAutoRestart();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function restart() {
    try {
        scriptlet.reload();
        scriptlet.enable();
    } catch(e) {
        alert(e + '\n' + e.stack);
    }
}

function updateAutoRestart() {
    $('#main')._.getButton('extra1').disabled = $('#auto-restart')._.checked;
}

function updateState() {
    $('#state')._.value = scriptlet.enabled ? 'Enabled' : 'Disabled';
}