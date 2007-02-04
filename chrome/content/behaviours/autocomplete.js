function AutoComplete(textbox, popup, completeFun, acceptFun) {
    this._textbox = textbox;
    this._popup = popup;

    function showCompletions() {
        popup.showPopup(
            textbox, -1, -1, 'tooltip', 'bottomleft', 'topleft');
    }

    function hideCompletions() {
        popup.hidePopup();        
    }

    function synthDownEvent() {
        var event = document.createEvent('KeyEvents');
        event.initKeyEvent(
            'keypress',        //  in DOMString typeArg,
            false,             //  in boolean canBubbleArg,
            false,             //  in boolean cancelableArg,
            null,             //  in nsIDOMAbstractView viewArg,  Specifies UIEvent.view. This value may be null.
            false,            //  in boolean ctrlKeyArg,
            false,            //  in boolean altKeyArg,
            false,            //  in boolean shiftKeyArg,
            false,            //  in boolean metaKeyArg,
            KeyEvent.DOM_VK_DOWN,               //  in unsigned long keyCodeArg,
            0);              //  in unsigned long charCodeArg);
        return event;
    }

    popup.addEventListener(
        'popupshowing', function(event) {
            while(popup.firstChild)
                popup.removeChild(popup.firstChild);

            var completions = completeFun(textbox.value);
            if(completions.length == 0) {
                event.preventDefault();
                popup.hidePopup();
            } else
                for each(var completion in completeFun(textbox.value)) {
                    var xulCompletion = document.createElement('menuitem');
                    xulCompletion.setAttribute('label', completion[0]);
                    xulCompletion.setAttribute('value', completion[1]);
                    popup.appendChild(xulCompletion);
                }

        }, false);

    popup.addEventListener(
        'command', function(event) {
            textbox.value = event.target.label;
            acceptFun(event.target.value);
        }, false);

    popup.addEventListener(
        'popupshown', function(event) {
            
        }, false);

    textbox.addEventListener(
        'keypress', function(event) {
            switch(event.keyCode) {
            case KeyEvent.DOM_VK_ESCAPE:
                popup.hidePopup();
                break;

            case KeyEvent.DOM_VK_RETURN:
                break;

            case KeyEvent.DOM_VK_DOWN:
                popup.enableKeyboardNavigator(true);
                popup.dispatchEvent(synthDownEvent());
                
                break;

            case KeyEvent.DOM_VK_TAB:
                event.preventDefault();
                popup.enableKeyboardNavigator(true);
                popup.dispatchEvent(synthDownEvent());
                break;

            default:
            }
        }, false);

    textbox.addEventListener(
        'input', function(event) {
            if(textbox.value == '')
                hideCompletions();
            else
                showCompletions();
        }, false);

    textbox.addEventListener(
        'blur', function(event) {
            hideCompletions();
        }, true);
}

AutoComplete.prototype = {
    focus: function() {
        this._textbox.focus();
    },

    blur: function() {
        this._textbox.blur();
    }
};
