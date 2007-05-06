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
 * Execute a process.
 *
 * A process consists of a sequence of states; transition between
 * states is described by _transitions_ and states themselves are
 * functions member of the _implementation_ object.  Additional
 * arguments will be passed to the first state.
 *
 * Example:
 *
 *    var downloadTransitions = {
 *        start:       { ok: 'requestData' },
 *        requestData: { ok: 'saveData',  error: 'alertUser' },
 *        saveData:    { ok: 'alertUser', error: 'alertUser' }
 *    }
 *
 *    var downloadImplementations = {
 *        requestData: function(next, url) {
 *           var req = new XMLHttpRequest();
 *           req.open('GET', 'http://www.mozilla.org/', true);
 *           req.onreadystatechange = function(event) {
 *               if(req.readyState == 4) {
 *                   if(req.status == 200)
 *                       next('ok', req.responseText);
 *                   else
 *                       next('error', 'Error loading page');
 *               }
 *           };
 *           req.send(null);
 *        },
 *        saveData: function(next, data) {
 *           if(lowLevelSave(data))
 *               next('ok', 'done!');
 *           else
 *               next('error', 'ops!');
 *        },
 *        alertUser: function(next, message) {
 *            window.alert(message);
 *        }
 *    }
 *
 *    process(downloadTransitions, downloadImplementations, 'http://www.google.com');
 *
 */
 
function execute(transitions, implementations) {
    var stateName;

    function driver(result) {
        // Current state has just been executed.  We should now find
        // out what state comes next (if any), and execute it.
        //
        // We are being called with result of last state (e.g. 'ok',
        // 'error', ...) plus arguments that the last state wants to
        // make available to next state (not shown in argument list,
        // we retrieve them dynamically).
        //
        // Next state is found based on name and result current state state.

        if(transitions[stateName]) {
            stateName = transitions[stateName][result];

            // We call next state passing it the driver itself (so that
            // the process can continue) and whatever data the last step
            // wanted to make available to the next one.

            implementations[stateName].apply(
                null, [driver].concat(Array.slice(arguments, 1)));
        }
    }

    // All processes must start from state 'start'.

    stateName = 'start';

    // We retrieve optional arguments passed to process() and forward
    // them to the first state.

    driver.apply(null, ['ok'].concat(Array.slice(arguments, 2)));
}

