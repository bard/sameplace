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


// STATE
// ----------------------------------------------------------------------

var request;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    request = window.arguments[0];
    
    $('#address').focus();

    var accountsUp = XMPP.accounts.filter(XMPP.isUp);
    var defaultAccount =
        accountsUp.length > 0 ?
        accountsUp[0].jid :
        XMPP.accounts[0].jid;

    $('#account').setAttribute('value', defaultAccount);
    $('#account').setAttribute('label', defaultAccount);

    if(request.title)
        $('#title').setAttribute('title', request.title);

    update();
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function accepted() {
    request.address = $('#address').value;
    request.account = $('#account').value;
    request.confirm = true;
    return true;
}

function canceled() {
    return true;
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function update() {
    if($('#account').value && $('#address').value)
        $('#main').getButton('accept').disabled = false;
    else
        $('#main').getButton('accept').disabled = true;
}
