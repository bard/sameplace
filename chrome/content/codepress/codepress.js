/*
 * CodePress - Real Time Syntax Highlighting Editor written in JavaScript - http://codepress.org/
 * 
 * Copyright (C) 2006 Fernando M.A.d.S. <fermads@gmail.com>
 *
 * This program is free software; you can redistribute it and/or modify it under the terms of the 
 * GNU Lesser General Public License as published by the Free Software Foundation.
 * 
 * Read the full licence: http://www.opensource.org/licenses/lgpl-license.php
 */

CodePress = function(obj) {
	// XXX bard: XUL documents can contain HTML elements, but we need to provide correct namespace.
	var self = document.createElementNS('http://www.w3.org/1999/xhtml', 'iframe');
	self.textarea = obj;
	self.textarea.disabled = true;
	self.textarea.style.overflow = 'hidden';
	// XXX bard: For XUL files loaded in content and containing
	// iframes, accessing contentWindow of iframes directly does not
	// work (https://bugzilla.mozilla.org/show_bug.cgi?id=379395), so
	// we use the window.frames[] trick instead.  But for it to work,
	// the iframe must have an id.	We provide it here.
	self.setAttribute('id', 'codepress-' + obj.id);
	self.style.height = self.textarea.clientHeight +'px';
	self.style.width = self.textarea.clientWidth +'px';
	self.textarea.style.overflow = 'auto';
	self.style.border = '1px solid gray';
	self.frameBorder = 0; // remove IE internal iframe border
	self.style.visibility = 'hidden';
	self.style.position = 'absolute';
	self.options = self.textarea.className;
	
	self.initialize = function() {
		// XXX bard: trick for accessing iframes when document is
		// a XUL page loaded in content area (see above).  Previously
		// was "self.contentWindow.CodePress"
		self.editor = window.frames['codepress-' + obj.id].CodePress;
		// XXX bard: moved editor initalization from load event
		// handler in codepress.html to here, as otherwise it
		// would be executed *after* this initalization, which is
		// called from a load event handler as well.
		self.editor.initialize('new');
		self.editor.body = self.contentWindow.document.getElementsByTagName('body')[0];
		self.editor.setCode(self.textarea.value);
		self.setOptions();
		self.editor.syntaxHighlight('init');
		self.textarea.style.display = 'none';
		self.style.position = 'static';
		self.style.visibility = 'visible';
		self.style.display = 'inline';
	}
	
	// obj can by a textarea id or a string (code)
	self.edit = function(obj,language) {
		if(obj) self.textarea.value = document.getElementById(obj) ? document.getElementById(obj).value : obj;
		if(!self.textarea.disabled) return;
		self.language = language ? language : self.getLanguage();
		self.src = CodePress.path+'codepress.html?language='+self.language+'&ts='+(new Date).getTime();
		if(self.attachEvent) self.attachEvent('onload',self.initialize);
		// XXX bard: in XUL, load events don't bubble to the
		// containing iframe, but they can be captured.	 Replaced
		// "false" below with "true" to listen to event during
		// capture phase.
		else self.addEventListener('load',self.initialize, true);
	}

	self.getLanguage = function() {
		for (language in CodePress.languages) 
			if(self.options.match('\\b'+language+'\\b')) 
				return CodePress.languages[language] ? language : 'generic';
	}
	
	self.setOptions = function() {
		if(self.options.match('autocomplete-off')) self.toggleAutoComplete();
		if(self.options.match('readonly-on')) self.toggleReadOnly();
		if(self.options.match('linenumbers-off')) self.toggleLineNumbers();
	}
	
	self.getCode = function() {
		return self.textarea.disabled ? self.editor.getCode() : self.textarea.value;
	}

	self.setCode = function(code) {
		self.textarea.disabled ? self.editor.setCode(code) : self.textarea.value = code;
		// XXX bard: forcing syntax refresh after changing code content
		self.editor.syntaxHighlight('init');
	}

	self.toggleAutoComplete = function() {
		self.editor.autocomplete = (self.editor.autocomplete) ? false : true;
	}
	
	self.toggleReadOnly = function() {
		self.textarea.readOnly = (self.textarea.readOnly) ? false : true;
		if(self.style.display != 'none') // prevent exception on FF + iframe with display:none
			self.editor.readOnly(self.textarea.readOnly ? true : false);
	}
	
	self.toggleLineNumbers = function() {
		var cn = self.editor.body.className;
		self.editor.body.className = (cn==''||cn=='show-line-numbers') ? 'hide-line-numbers' : 'show-line-numbers';
	}
	
	self.toggleEditor = function() {
		if(self.textarea.disabled) {
			self.textarea.value = self.getCode();
			self.textarea.disabled = false;
			self.style.display = 'none';
			self.textarea.style.display = 'inline';
		}
		else {
			self.textarea.disabled = true;
			self.setCode(self.textarea.value);
			self.editor.syntaxHighlight('init');
			self.style.display = 'inline';
			self.textarea.style.display = 'none';
		}
	}

	self.reset = function() {
		self.contentDocument.designMode = 'off';
		self.contentDocument.designMode = 'on';
	}
    
	self.edit();
	return self;
}

CodePress.languages = {	
	csharp : 'C#', 
	css : 'CSS', 
	generic : 'Generic',
	html : 'HTML',
	java : 'Java', 
	javascript : 'JavaScript', 
	perl : 'Perl', 
	ruby : 'Ruby',	
	php : 'PHP', 
	text : 'Text', 
	sql : 'SQL',
	vbscript : 'VBScript'
}


CodePress.run = function() {
	s = document.getElementsByTagName('script');
	for(var i=0,n=s.length;i<n;i++) {
		// XXX bard: <script> elements in XUL don't have a "src"
		// property, so we get the value using the DOM attribute.
		if(s[i].getAttribute('src').match('codepress.js')) {
			CodePress.path = s[i].getAttribute('src').replace('codepress.js','');
		}
	}
	t = document.getElementsByTagName('textarea');
	for(var i=0,n=t.length;i<n;i++) {
		if(t[i].className.match('codepress')) {
			id = t[i].id;
			t[i].id = id+'_cp';
			eval(id+' = new CodePress(t[i])');
			t[i].parentNode.insertBefore(eval(id), t[i]);
		} 
	}
}

// XXX bard: we leave to user the choice as to when create the editor,
// to avoid timing problems.
// if(window.attachEvent) window.attachEvent('onload',CodePress.run);
// else window.addEventListener('DOMContentLoaded',CodePress.run,false);
