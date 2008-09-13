/*
  This file is part of 'Notify me' (SamePlace addon).

  'Notify me' is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License,
  or any later version.
  
  'Notify me' is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.
  
  You should have received a copy of the GNU General Public License
  along with 'Notify me'.  If not, see <http://www.gnu.org/licenses/>.
*/

/// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;

const pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.notifyme.');

var roomsarray = new Array();
var pref_roomsarray;
var initList;

// INITIALIZATION
// ----------------------------------------------------------------------
function init() {
    window.sizeToContent();
    roomsarray = eval(pref.getCharPref('rooms2join'));

    initList = document.getElementById('thelist');   
    //    roomsarray.forEach(printElt);
    roomsarray.forEach(appendToList);
    
}

function addItem(){
    // Gets rooms list and current room user wants to add
    var list = document.getElementById('thelist');
    
    var roomid = document.getElementById('roomid').value;
    var nick = document.getElementById('nickid').value;
    
    if (nick != "") var room = roomid + nick;
    else {
	alert("Choose a nickname");
	return false;
    }

    list.appendItem(room, room);
    
    // Prints latest element
    var count = list.getRowCount();
    //alert(list.getItemAtIndex(--count).label);

    var length = roomsarray.push(room);
    //roomsarray.forEach(printElt);
    pref_roomsarray = roomsarray.toSource();
    //alert(pref_roomsarray);
    pref.setCharPref('rooms2join', pref_roomsarray);
}

function removeSelectedRoom(){
    
    var list = document.getElementById('thelist');
    var count = list.selectedCount;
    while (count--){
	var item = list.selectedItems[0];
	list.removeItemAt(list.getIndexOfItem(item));
	roomsarray.splice(list.getIndexOfItem(item), 1);
    }
    
    pref_roomsarray = roomsarray.toSource();
    pref.setCharPref('rooms2join', pref_roomsarray);
    //alert(pref_roomsarray);
}

function receivedRET(event) {
    if (event.keyCode == KeyEvent.DOM_VK_RETURN) {
        addItem();
	return false;
    }
    return true;
}
function printElt(element, index, array) {
    alert("[" + index + "] is " + element);
}

function appendToList(element, index, array) {
    // alert("[" + index + "] is " + element);
    initList.appendItem(element, element);
}

function getRooms(){
    roomsarray = eval(pref.getCharPref('rooms2join'));
    return roomsarray;
}