dump("XPCOM Component has been loaded in Firefox \n");
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


// ----------------------------------------------------------------------

// GLOBAL DEFINITIONS

/* Enable external scripts import */
const loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
  .getService(Ci.mozIJSSubScriptLoader);

/* Initialize interfaces to manage prefs */
const pref = Components
  .classes["@mozilla.org/preferences-service;1"]
  .getService(Components.interfaces.nsIPrefService)
  .getBranch('extensions.notifyme.');

const appCheck = Components
  .classes["@mozilla.org/preferences-service;1"]
  .getService(Components.interfaces.nsIPrefService)
  .getBranch('general.useragent.extra.');

/* NameSpaces */
const ns_muc      = new Namespace('http://jabber.org/protocol/muc');
const ns_muc_user = new Namespace('http://jabber.org/protocol/muc#user');
const ns_composing = new Namespace('http://jabber.org/protocol/chatstates');

/* Global vars */
var win;
var popup;
var roomspopup;

var channel;
var XMPP;
var account;
var utils = {};

var avatar;


var rooms = {};

var isFirefox;
var isThunderbird;
// ----------------------------------------------------------------------


function init() {

  // External scripts import
  var env = {};
  loader.loadSubScript('chrome://xmpp4moz/content/xmpp.js', env);
  XMPP = env.XMPP;
  loader.loadSubScript('chrome://notifyme/content/lib/nm_util_impl.js', utils);

    

  // Application detecting
  var children = appCheck.getChildList("", {});
  if (children == "thunderbird"){
    dump("XPCOM Component has been loaded in Thunderbird \n");
    isThunderbird = true;
    isFirefox = false;
	
    runInThunderbird();
  }
  if (children == "firefox"){
    dump("XPCOM Component has been loaded in Firefox \n");
    isFirefox = true;
    isThunderbird = false;
	
    runInFirefox();
  }

}

function runInFirefox(){
  channel = XMPP.createChannel(
			       <query xmlns="http://jabber.org/protocol/disco#info">
			       <feature var="http://jabber.org/protocol/muc"/>
			       <feature var="http://jabber.org/protocol/muc#user"/>
			       <feature var="http://jabber.org/protocol/xhtml-im"/>
			       <feature var="http://jabber.org/protocol/chatstates"/>
			       </query>);    

  channel.on({
    event     : 'message',
	direction : 'in',
	}, function(message) {
      //var msg = new String(message.stanza.body);
      //dump("event: message, direction: in \nmessage.stanza.body = " + msg + "\n");

	

      // Detects if msg body is not blank
      if(message.stanza.body == undefined){
	//dump("message.stanza.body == undefined \n");
      }

      /* Detects if sidebar is not Expanded OR
	 Firefox is minimized OR
	 Firefox is another desktop OR
	 Firefox is on current desktop but behind others windows (Firefox 3 only) */
      else if((isCompact()) || win.windowState == win.STATE_MINIMIZED || !(win.document.hasFocus && win.document.hasFocus())){
	msgbody = new String(message.stanza.body);
	account = message.account;
	var address = XMPP.JID(message.stanza.@from).address;

	detectMsgTypeNSend(message, address, account);
		
      }

      else{
	//dump("Sidebar is exanded \n");
      }
    });
}

function runInThunderbird(){
  var wm = Components
    .classes["@mozilla.org/appshell/window-mediator;1"]
    .getService(Components.interfaces.nsIWindowMediator);
  // MEMO: Specifing navigator:browser Notify me won't work with Thunderbird
  win = wm.getMostRecentWindow("");
  var sameplaceframe = win.document.getElementById("sameplace-frame");
    

  channel = XMPP.createChannel(
			       <query xmlns="http://jabber.org/protocol/disco#info">
			       <feature var="http://jabber.org/protocol/muc"/>
			       <feature var="http://jabber.org/protocol/muc#user"/>
			       <feature var="http://jabber.org/protocol/xhtml-im"/>
			       <feature var="http://jabber.org/protocol/chatstates"/>
			       </query>);    
  channel.on({
    event     : 'message',
	direction : 'in',
	}, function(message) {
      var msg = new String(message.stanza.body);
      dump("event: message, direction: in \nmessage.stanza.body = " + msg + "\n");
	    
      // Detects if msg body is not blank
      if(message.stanza.body == undefined){
	dump("message.stanza.body == undefined \n");
      }

      // Detects if sidebar is expanded
      else if(sameplaceframe.collapsed == true){
	      
	msgbody = new String(message.stanza.body);
	account = message.account;
	var address = XMPP.JID(message.stanza.@from).address;
	      
	detectMsgTypeNSend(message, address, account);
      }
      else{
	//dump("Sidebar is exanded \n");
      }
    });
}



/* Detects if Sidebar is not expanded */
function isCompact(){
  var wm = Components
    .classes["@mozilla.org/appshell/window-mediator;1"]
    .getService(Components.interfaces.nsIWindowMediator);
  // MEMO: Specifing navigator:browser Notify me won't work with Thunderbird
  win = wm.getMostRecentWindow("navigator:browser");
    
  if(win.sameplace.isCompact()) return true;
  else return false;
}

function detectMsgTypeNSend(message, address, account){
  // Detects if users wants alert popups 
  popup = eval(pref.getBoolPref('popup'));
  roomspopup = eval(pref.getBoolPref('roomspopup'));

  // Detects if message comes from a room and obtain contact nick by resourse
  if(message.stanza.@type == "groupchat" && roomspopup){
    var check = message.stanza.toXMLString();
    if (check.match("jabber:x:delay") != null)
      {
      }
    else{
      // dump('\n message from room\n');
      var nick = XMPP.JID(message.stanza.@from).resource + " from " + XMPP.JID(message.stanza.@from).address;
      avatar = utils.getAvatar(account, address, XMPP);
      composeAndSend(nick, msgbody, avatar);
    }
  }
    
  else if(message.stanza.@type == "chat" && popup){
    // Obtains contact nick as you aliased it in your contact list, i.e. Ivan for imorgillo@sameplace.cc
    var nick = XMPP.nickFor(message.account, XMPP.JID(message.stanza.@from).address);
    avatar = utils.getAvatar(account, address, XMPP);
	
    composeAndSend(nick, msgbody, avatar);
  }
}

/*
// Jabiff legacy. It could be usefull in the future.

function observe(subject, topic, data) {
if(data != 'JabBiff')
return;
        
switch(topic) {
case 'alertfinished':
this._busy = false;
break;
case 'alertclickcallback':
break;
}
}
*/


// Detects if somebody sent you a link, an image or a long message
function composeAndSend(nick, body, avatar){

  if(body.match("image:") != null || body.match("<img") != null ){
    utils.showmsgpopup(avatar, nick, "has sent you an image");
  }
  else if (body.match("http://") != null || body.match("<a href=") != null ){
    utils.showmsgpopup(avatar, nick, "has sent you a link");
  }
  /*
    else if (body.match("jabber:x:delay") != null){
    // Does nothing
    dump('\n msg comes from room history\n');
    }
  */
  else{
    /* Checks if msg body is longer than 50 chars and cuts it */
    if(body.length > 50) body = body.substring(0,51) + " ...";
    utils.showmsgpopup(avatar, nick, body);
  }
}