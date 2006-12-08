// INITIALIZATION
// ----------------------------------------------------------------------

function Input(iframe) {
    _this = this;
    this._iframe = iframe;

    iframe.contentDocument.open();
    iframe.contentDocument.write(
        '<html xmlns="http://www.w3.org/1999/xhtml">' +
        '<head><title></title></head>' +
        '<body style="margin: 0; font-family: sans-serif; font-size: 10pt;">' +
        '</body></html>');
    iframe.contentDocument.close();
    iframe.contentDocument.designMode = 'on';

    iframe.contentWindow.addEventListener(
        'keypress', function(event) { _this.pressedKey(event); }, false);
    iframe.addEventListener(
        'load', function(event) { event.currentTarget && _this.onLoad(); }, true);    
}


// CALLBACKS
// ----------------------------------------------------------------------

Input.prototype.onLoad = function() {};

Input.prototype.onAcceptContent = function(content) {};


// PUBLIC FUNCTIONALITY
// ----------------------------------------------------------------------

Input.prototype.focus = function() {
    this._iframe.contentWindow.focus();
};

Input.prototype.reset = function() {
    var document = this._iframe.contentDocument;
    
    window.setTimeout(
        function() {
            document.body.innerHTML = '';
            document.designMode = 'off';
            document.designMode = 'on';
        }, 0);
};

Input.prototype.execCommand = function(command, argument) {
    this._iframe.contentDocument.execCommand(
        command, false, argument);
};

// INTERNALS
// ----------------------------------------------------------------------

Input.prototype.pressedKey = function(event) {
    if(event.keyCode == KeyEvent.DOM_VK_RETURN) {
        var document = event.currentTarget.document;
        var content = document.body.innerHTML;
        
        event.preventDefault();
        if(content == '<br>')
            return;

        this.onAcceptContent(content);
        this.reset();

    } else if(event.charCode == 'h'.charCodeAt(0) && event.ctrlKey == true) {
        event.preventDefault();
    }
};

