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


/**
 * Stateless wrapper to access SamePlace scriptlets.
 *
 * Scriptlets are kept under <profiledir>/sameplace/scriptlets and
 * information about enabled/disabled scriptlets is kept in the
 * preference system in the "extensions.sameplace.scriptlets.enabled"
 * field.
 *
 */


// DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;


// STATE
// ----------------------------------------------------------------------

var wrappers = {};
var dir;
var pref;
var sampleURL;


// INITIALIZATION
// ----------------------------------------------------------------------

/**
 * Provide an interface to a scriptlet directory.
 *
 * Directory is specified by the array _pathParts_; metadata about
 * enabled/disabled scriptlets is kept in a preference branch and is
 * specified by the string _branchName_.
 *
 * To get <profiledir>/myext/scriptlets and manage it through the
 * "extension.myext." branch, use:
 *
 *   scriptlets.init(['myext', 'scriptlets'], 'extensions.myext.');
 *
 */

function init(pathParts, prefBranch, url) {
    dir = Cc['@mozilla.org/file/directory_service;1']
        .getService(Ci.nsIProperties)
        .get('ProfD', Ci.nsIFile);
    for each(var part in pathParts) {
        dir.append(part);
        if(!dir.exists())
            dir.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
    }

    pref = Cc["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefService)
        .getBranch(prefBranch);

    sampleURL = url;
}


// ACTIONS
// ----------------------------------------------------------------------

function isEnabled(fileName) {
    var currentlyEnabled = eval(pref.getCharPref('scriptlets.enabled'));
    return currentlyEnabled.indexOf(fileName) != -1;
}

function setEnabled(fileName) {
    var currentlyEnabled = eval(pref.getCharPref('scriptlets.enabled'));
    if(currentlyEnabled.indexOf(fileName) == -1) {
        currentlyEnabled.push(fileName);
        pref.setCharPref('scriptlets.enabled', currentlyEnabled.toSource());
    }
}

function setDisabled(fileName) {
    var currentlyEnabled = eval(pref.getCharPref('scriptlets.enabled'));
    var index = currentlyEnabled.indexOf(fileName);
    if(index != -1) {
        currentlyEnabled.splice(index, 1);
        pref.setCharPref('scriptlets.enabled', currentlyEnabled.toSource());
    }
}

/**
 * Mass-start all scriptlets that are configured as "enabled".
 *
 */

function start() {
    forEach(
        function(scriptlet) {
            if(scriptlet.enabled)
                scriptlet.start();
        });
}

/**
 * Mass-stop all scriptlets that are configured as "enabled".
 *
 */

function stop() {
    forEach(
        function(scriptlet) {
            if(scriptlet.enabled)
                scriptlet.stop();
        });
}

function forEach(action) {
    var list = [];
    var entries = dir.directoryEntries;

    while(entries.hasMoreElements()) {
        var entry = entries.getNext().QueryInterface(Ci.nsIFile); 
        if(entry.leafName.match(/\.js$/))
            action(this.get(entry));
    }
}

function create(name, url) {
    var file;
    file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
    file.initWithFile(dir);
    file.append(name);

    if(file.exists())
        throw new Error('File already exists.');

    var outStream = Cc['@mozilla.org/network/file-output-stream;1']
        .createInstance(Ci.nsIFileOutputStream);
    outStream.init(file, 0x02 | 0x08 | 0x20, 0, 0);
    if(url) {
        var initialContent = readURL(url);
        outStream.write(initialContent, initialContent.length);
    } else {
        outStream.write('\n', 1);
    }
    outStream.close();

    return get(file);
}

function get(fileThing) {
    var file;
    if(typeof(fileThing) == 'string') {
        file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
        file.initWithFile(dir);
        file.append(fileThing);
    }
    else if(fileThing instanceof Ci.nsILocalFile)
        file = fileThing;
    else
        throw new Error('Invalid argument. (' + fileThing + ')');
        
    if(wrappers[file.leafName])
        return wrappers[file.leafName];

    var wrapper = {
        get enabled() {
            return isEnabled(this.fileName);
        },

        get fileName() {
            return file.leafName;
        },

        load: function() {
            var code = {};
            load(file, code);
            this._code = code;
        },

        get code() {
            if(!this._code)
                this.load();
            return this._code;
        },

        get source() {
            var data = [];
            var fstream = Cc['@mozilla.org/network/file-input-stream;1']
            .createInstance(Ci.nsIFileInputStream);
            var sstream = Cc['@mozilla.org/scriptableinputstream;1']
            .createInstance(Ci.nsIScriptableInputStream);
            fstream.init(file, -1, 0, 0);
            sstream.init(fstream);

            var str = sstream.read(4096);
            while(str.length > 0) {
                data.push(str);
                str = sstream.read(4096);
            }

            sstream.close();
            fstream.close();
            return data.join();
        },

        save: function(source) {
            var outStream = Cc['@mozilla.org/network/file-output-stream;1']
            .createInstance(Ci.nsIFileOutputStream);
            outStream.init(file, 0x02 | 0x08 | 0x20, 0, 0);
            outStream.write(source, source.length);
            outStream.close();
        },

        get info() {
            return this.code.info;
        },

        uninstall: function() {
            file.remove(false);
        },

        reload: function() {
            var wasEnabled = this.enabled;
            if(wasEnabled)
                this.disable();

            this.unload();
            this.load();

            if(wasEnabled)
                this.enable();
        },

        unload: function() {
            this._code = null;
        },

        start: function() {
            this.code.init();
        },

        stop: function() {
            this.code.finish();
        },

        enable: function() {
            if(this.enabled)
                return;

            try {
                this.start();
                setEnabled(this.fileName);
            } catch(e) {
                this.disable();
                throw e;
            }
        },

        disable: function() {
            if(!this.enabled)
                return;

            try {
                setDisabled(this.fileName);
                this.stop();
                this.unload();
            } catch(e) {
                this.unload();
                throw e;
            }
        }
    };
    wrappers[file.leafName] = wrapper;

    return wrapper;
}


// UTILITIES
// ----------------------------------------------------------------------

function readURL(url){
    var srvIO = Cc['@mozilla.org/network/io-service;1']
        .getService(Ci.nsIIOService);
    var scriptableStream = Cc['@mozilla.org/scriptableinputstream;1']
        .getService(Ci.nsIScriptableInputStream);

    var channel = srvIO.newChannel(url, null, null);
    var input = channel.open();
    scriptableStream.init(input);
    var str = scriptableStream.read(input.available());
    scriptableStream.close();
    input.close();
    return str;
}

function load(fileIndicator, context) {
    function fileToURL(file) {
        return Cc['@mozilla.org/network/io-service;1']
            .getService(Ci.nsIIOService)
            .getProtocolHandler('file')
            .QueryInterface(Ci.nsIFileProtocolHandler)
            .getURLSpecFromFile(file);
    }

    var url;
    if(fileIndicator instanceof Ci.nsIFile)
        url = fileToURL(fileIndicator);
    else if(typeof(fileIndicator) == 'string')
        if(fileIndicator.match(/^(file|chrome):\/\//))
            url = fileIndicator;
        else {
            var file = Cc['@mozilla.org/file/local;1']
                .createInstance(Ci.nsILocalFile);
            file.initWithPath(fileIndicator);
            url = fileToURL(file);
        }
    else
        throw new Error('Unexpected. (' + fileIndicator + ')');

    Cc['@mozilla.org/moz/jssubscript-loader;1']
        .getService(Ci.mozIJSSubScriptLoader)
        .loadSubScript(url, context);
}
