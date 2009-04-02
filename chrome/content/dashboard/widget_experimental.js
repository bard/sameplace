/*
 * Copyright 2009 by Massimiliano Mirra
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


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

window.addEventListener('dashboard/load', function(event) { experimental.init(); }, false)
window.addEventListener('dashboard/unload', function(event) { experimental.finish(); }, false)

var experimental = {};

experimental.init = function() {
    this._pref = Cc['@mozilla.org/preferences-service;1']
        .getService(Ci.nsIPrefService)
        .getBranch('extensions.sameplace.');

    this._prompt = Cc['@mozilla.org/embedcomp/prompt-service;1']
        .getService(Ci.nsIPromptService);

    $('#widget-experimental-open-mode').value = this._pref.getCharPref('openMode');
};

experimental.finish = function() {
};


// UI REACTIONS
// ----------------------------------------------------------------------

experimental.changedOpenMode = function(event) {
    function restart() {
        Cc['@mozilla.org/toolkit/app-startup;1']
            .getService(Ci.nsIAppStartup)
            .quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
    }

    var mode = event.target.value;
    if(mode !== this._pref.getCharPref('openMode')) {
        this._pref.setCharPref('openMode', mode);
        dashboard.notify('This setting will take effect after restart.',
                         'restart',
                         null,
                         'info_high',
                         [{label: 'Restart', accessKey: 'R', callback: restart}]);
    }
};


// UI ACTIONS
// ----------------------------------------------------------------------

experimental.createDesktopShortcut = function() {
    var fileLocator = Cc['@mozilla.org/file/directory_service;1']
        .getService(Ci.nsIProperties);

    function chromeToFileUrl(url) {
        return Cc['@mozilla.org/chrome/chrome-registry;1']
            .getService(Ci.nsIChromeRegistry)
            .convertChromeURL(
                Cc['@mozilla.org/network/io-service;1']
                    .getService(Ci.nsIIOService)
                    .newURI(url, null, null))
            .QueryInterface(Ci.nsIFileURL);
    }

    function makeShortcutCommand(targetPath, iconPath, name, arguments) {
        var cmd = '[Desktop Entry]\n';
        cmd += 'Name=' + name + '\n';
        cmd += 'Type=Application\n';
        cmd += 'Comment=Instant Messenger\n';
        cmd += 'Exec=\'' + targetPath + '\' ' + arguments.join(' ') + '\n';
        cmd += 'Icon=' + iconPath + '\n';
        return cmd;
    }

    function save(text, file) {
        if(file.exists())
            file.remove(false);
        file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0644);

        var fos = Cc["@mozilla.org/network/file-output-stream;1"].
            createInstance(Ci.nsIFileOutputStream);
        fos.init(file, 0x02 | 0x08 | 0x20, 0666, 0); // write, create, truncate
        var os = Cc['@mozilla.org/intl/converter-output-stream;1']
            .createInstance(Ci.nsIConverterOutputStream);
        os.init(fos, 'UTF-8', 0, 0x0000);
        os.writeString(text);
        os.close();
    }

    var appBinaryFile = fileLocator.get('XCurProcD', Ci.nsILocalFile);
    appBinaryFile.append('firefox');
    var shortcutFile = fileLocator.get('Desk', Ci.nsIFile);
    shortcutFile.append('SamePlace.desktop');
    var shortcutCommand = makeShortcutCommand(
        appBinaryFile.path,
        chromeToFileUrl('chrome://sameplace/skin/logo32x32.png').file.path,
        'SamePlace',
        ['-sameplace']);
    save(shortcutCommand, shortcutFile);

    this._prompt.alert(null, 'Notification', 'Shortcut saved as ' + shortcutFile.path);
};

