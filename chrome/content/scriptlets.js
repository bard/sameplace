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

function init(pathParts, prefBranch) {
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

    while(entries.hasMoreElements())
        action(this.get(entries.getNext().QueryInterface(Ci.nsIFile)));
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

        get code() {
            if(!this._code) {
                try {
                    var code = {};
                    load(file, code);
                    this._code = code;
                } catch(e) {
                    Components.utils.reportError(
                        'Error while loading scriptlet: ' + e.name + '\n' +
                        e.stack.replace(/^/mg, '    ') + '\n');
                }
            }
            return this._code;
        },

        get info() {
            try {
                return this.code.info;
            } catch(e) {
                return {
                    name: file.path,
                    version: 'unknown',
                    description: 'Error while loading (check system console).'
                }
            }
        },

        uninstall: function() {
            file.remove(false);
        },

        reload: function() {
            var wasEnabled = this.enabled;
            if(this.enabled)
                this.disable();

            this.unload();

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
                dump('Error while initializing scriptlet: ' + e.name + '\n' +
                     e.stack.replace(/^/mg, '    ') + '\n');
                this.disable();
            }
        },

        disable: function() {
            if(!this.enabled)
                return;

            try {
                this.stop();
            } catch(e) {
                dump('Error while initializing scriptlet: ' + e.name + '\n' +
                     e.stack.replace(/^/mg, '    ') + '\n');
            } finally {
                this.unload();
                setDisabled(this.fileName);
            }
        }
    };
    wrappers[file.leafName] = wrapper;

    return wrapper;
}
