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


// UTILITIES (GENERIC)
// ----------------------------------------------------------------------
// Application-independent functions not dealing with user interface.

function isChromeUrl(string) {
    return /^chrome:\/\//.test(string);
}

function chromeToFileUrl(url) {
    if(hostAppIsMail())
        return url;
    else
        return Cc["@mozilla.org/chrome/chrome-registry;1"]
            .getService(Ci.nsIChromeRegistry)
            .convertChromeURL(
                Cc["@mozilla.org/network/io-service;1"]
                .getService(Ci.nsIIOService)
                .newURI(url, null, null)).spec;
}

function hostAppIsMail() {
    return (Cc['@mozilla.org/xre/app-info;1']
            .getService(Ci.nsIXULAppInfo)
            .ID == '{3550f703-e582-4d05-9a08-453d09bdfdc6}');
}

function hostAppIsBrowser() {
    return (Cc['@mozilla.org/xre/app-info;1']
            .getService(Ci.nsIXULAppInfo)
            .ID == '{ec8030f7-c20a-464f-9b0e-13a3a9e97384}');
}

function load(url, context) {
    Cc['@mozilla.org/moz/jssubscript-loader;1']
        .getService(Ci.mozIJSSubScriptLoader)
        .loadSubScript(url, context);
}
