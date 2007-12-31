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


Cc['@mozilla.org/moz/jssubscript-loader;1']
.getService(Ci.mozIJSSubScriptLoader)
    .loadSubScript('chrome://xmpp4moz/content/lib/module_manager.js');

var module     = new ModuleManager(['chrome://mozlab/content']);
var mozunit    = module.require('package', 'mozunit/package');
var assert     = mozunit.assertions;
var spec       = new mozunit.Specification('XML utilities');

spec.stateThat = {
    'Function can be applied to text nodes of an XML object and the resulting XML is returned': function() {
        var src = <body xmlns="urn:bar" attr="value">one <span xmlns="urn:foo">two</span> three</body>;
        
        var dst = xml.mapTextNodes(
            src, function(text) { return text.toUpperCase(); });

        assert.equals(
            <body xmlns="urn:bar" attr="value">ONE <span xmlns="urn:foo">TWO</span> THREE</body>,
            dst);
    },

    'Function applied to text nodes can return an array': function() {
        var src = <body xmlns="urn:bar" attr="value">one <span xmlns="urn:foo">two</span> three</body>;
        
        var dst = xml.mapTextNodes(
            src, function(text) { return [text, <a>{text}</a>]; });

        var expected = <body xmlns="urn:bar" attr="value">one <a>one </a><span xmlns="urn:foo">two<a>two</a></span> three<a> three</a></body>;

        repl.print(dst.toXMLString())
        repl.print(expected.toXMLString())
    }
};

spec.verify();
