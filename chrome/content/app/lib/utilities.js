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


// GENERIC UTILITIES
// ----------------------------------------------------------------------

function JID(string) {
    try {
        var m = string.match(/^(.+?@)?(.+?)(?:\/|$)(.*$)/);

        var jid = {};

        if(m[1])
            jid.username = m[1].slice(0, -1);

        jid.hostname = m[2];
        jid.resource = m[3];
        jid.nick     = m[3];
        jid.full     = m[3] ? string : null;
        jid.address  = jid.username ?
            jid.username + '@' + jid.hostname :
            jid.hostname;

        return jid;
    }catch(e){
        window.alert('Error report: ' + e + '\n' +
                     'userAddress: ' + userAddress + '\n' +
                     'contactResource: ' + contactResource + '\n' +
                     'contactName: ' + contactName + '\n' +
                     'Stack trace:\n' + e.stack);
    }
}

function stripUriFragment(uri) {
    var hashPos = uri.lastIndexOf('#');
    return (hashPos != -1 ?
            uri.slice(0, hashPos) :
            uri);}

function padLeft(string, character, length) {
    string = string.toString();
    while(string.length < length)
        string = character + string;
    
    return string;
}

function formatTime(dateTime) {
    return padLeft(dateTime.getHours(), '0', 2) + ':' +
        padLeft(dateTime.getMinutes(), '0', 2) + ':' +
        padLeft(dateTime.getSeconds(), '0', 2)
}


function textToRGB(text) {
    var memo = arguments.callee.memo ||
        (arguments.callee.memo = {});
    if(memo[text])
        return memo[text];
    
    function hsv2rgb(h, s, v) {
        var colr = [2, 1, 0, 0, 3, 2];
        var colg = [3, 2, 2, 1, 0, 0];
        var colb = [0, 0, 3, 2, 2, 1];
        var colp = [4];
        var r = g = b = 0;
        var nh, ic, fc, ts;

        if(s == 0) {
            r = g = b = Math.round(255*v);
        } else {
            h = h % 360;
            nh = h/60;
            ic = Math.round(nh);
            fc = nh-ic;
            colp[2] = 255*v;
            colp[0] = colp[2]*(1-s);
            colp[1] = colp[2]*(1-s*fc);
            colp[3] = colp[2]*(1-s*(1-fc));
            r = Math.round(colp[colr[ic]]);
            g = Math.round(colp[colg[ic]]);
            b = Math.round(colp[colb[ic]]);
        }
        return [r, g, b];
    }

    function toRange(srcValue, srcRange, dstRange) {
        return srcValue / srcRange * dstRange;
    }

    var positiveCRC = crc32.crc(text) + Math.pow(2, 31);
    var hue = Math.round(toRange(positiveCRC, Math.pow(2, 32), 360));
    const value = 0.40;
    const saturation = 0.92;

    memo[text] = hsv2rgb(hue, saturation, value);
    return memo[text];
};


// GUI UTILITIES
// ----------------------------------------------------------------------

function copyDomContents(srcElement, dstElement) {
    for(var i=srcElement.childNodes.length-1; i>=0; i--) {
        var importedElement = dstElement.ownerDocument.importNode(
            srcElement.childNodes[i], true);
        dstElement.insertBefore(importedElement, dstElement.firstChild);
    } 
}

function isNearBottom(domElement, threshold) {
    return Math.abs(domElement.scrollHeight -
                    (domElement.scrollTop + domElement.clientHeight)) < (threshold || 24);
}

function smoothScroll(domElement, stepsLeft) {
    if(stepsLeft == undefined)
        stepsLeft = 4;
    else if(stepsLeft == 0)
        return;

    var targetScrollTop = domElement.scrollHeight - domElement.clientHeight;
    var deltaScrollTop = Math.abs(domElement.scrollTop - targetScrollTop);
    var nextStep = deltaScrollTop / stepsLeft;
    domElement.scrollTop += nextStep;

    window.setTimeout(
        function() { smoothScroll(domElement, stepsLeft - 1); }, 5);
}

function scrollToBottom(domElement, smooth) {
    if(smooth && scrolling)
        return;


    if(smooth == undefined)
        smooth = true;

    if(smooth)
        smoothScroll(domElement);
    else        
        domElement.scrollTop =
            domElement.scrollHeight - domElement.clientHeight;
}

function scrollingOnlyIfAtBottom(domElement, action) {
    var shouldScroll = isNearBottom(domElement);
    action();
    if(shouldScroll)
        scrollToBottom(domElement);
}

function setPref(name, value) {
    globalStorage[document.location.host].setItem(name, value);
}

function getPref(name) {
    return globalStorage[document.location.host].getItem(name).toString();
}
