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
    $('#source')._.value = scriptlet.source;
    $('#main')._.getButton('extra2').disabled = true;
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function modifiedSource(event) {
    $('#main')._.getButton('extra2').disabled = false;    
}

function requestedClose() {
    return true;
}

function requestedSave() {
    scriptlet.save($('#source')._.value);
    $('#main')._.getButton('extra2').disabled = true;
    $('#source')._.focus();
    return false;
}

function requestedReload() {
    scriptlet.reload();
    $('#source')._.focus();
    return false;
}