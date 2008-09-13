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

  Ivan Morgillo < imorgillo [at] sanniolug [dot] org >

*/
// INIZIALIZATIONS

// Manages prefs
const pref = Components
    .classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefService)
    .getBranch('extensions.sameplace.');

// Inizialize popup alert 
const alertService = Components
    .classes['@mozilla.org/alerts-service;1']
    .getService(Components.interfaces.nsIAlertsService);

// Initialize interfaces to play a sound alert
var player = Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound) ;
var ioservice = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService) ;
var music = ioservice.newURI ("chrome://sameplace/content/alert.wav" , "" , null ) ; 

// GLOBALS
const defaultAvatar = 'chrome://sameplace/skin/logo96.png';

// NAMESPACES
const ns_x4m_in = 'http://hyperstruct.net/xmpp4moz/protocol/internal';
const ns_vcard  = 'vcard-temp';

// ------------------------------------------------------------------

function getAvatar(account, address, XMPP){
    // address is something like hamen_testing2@sameplace.cc
    var avatar;

    XMPP.send(account,
              <iq to={address} type='get'><vCard xmlns='vcard-temp'/><cache-control xmlns={ns_x4m_in}/></iq>,
	      function(reply) {
		  
		  var photo = reply.stanza..ns_vcard::PHOTO;
		  avatar = 'data:' + photo.ns_vcard::TYPE + ';base64,' + photo.ns_vcard::BINVAL;
	      });

    if (avatar == undefined) avatar = defaultAvatar;
    return avatar;
}


// ShowS an alert popup and play a sound alert
function showmsgpopup(avatar, contact, text){
    
    /*    
    // Listening for callbacks 
    var listener = {
	observe: function(subject, topic, data) {
	    dump("subject=" + subject + ", topic=" + topic + ", data=" + data);
	}
    }
    alertService.showAlertNotification(avatar, contact, text, true, "cookie", listener);
    */
    alertService.showAlertNotification(avatar, contact, text, false, "", null);
    
    // Forces avatar to default avatar due a lag in avatar update
    //avatar = defaultAvatar;

    // Checks prefs to play / not to play a sound alert
    var sound = eval(pref.getBoolPref('sound'));
    if (sound) player.play(music);
}