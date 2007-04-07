var behaviour = behaviour || {};

behaviour.autoComplete = function(textbox) {
    var popup = document.createElement('popup');
    textbox.appendChild(popup);

    function showCompletions() {
        popup.showPopup(
            textbox, -1, -1, 'tooltip', 'bottomleft', 'topleft');
    }

    function hideCompletions() {
        popup.hidePopup();        
    }

    function synthKeyEvent(keycode) {
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
            keycode,               //  in unsigned long keyCodeArg,
            0);              //  in unsigned long charCodeArg);
        return event;
    }

    popup.addEventListener(
        'popupshowing', function(event) {
            while(popup.firstChild)
                popup.removeChild(popup.firstChild);

            var completeEvent = document.createEvent('Event');
            completeEvent.initEvent('complete', true, false);
            event.target.dispatchEvent(completeEvent);

            if(popup.childNodes.length == 0) {
                event.preventDefault();
                popup.hidePopup();
            } 
        }, false);

    popup.addEventListener(
        'command', function(event) {
            textbox.value = event.target.label;
            var completedEvent = document.createEvent('Event');
            completedEvent.initEvent('completed', true, false);
            event.target.dispatchEvent(completedEvent);
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
                popup.dispatchEvent(synthKeyEvent(KeyEvent.DOM_VK_DOWN));
                break;

            case KeyEvent.DOM_VK_UP:
                popup.enableKeyboardNavigator(true);
                popup.dispatchEvent(synthKeyEvent(KeyEvent.DOM_VK_UP));
                break;

            case KeyEvent.DOM_VK_TAB:
                event.preventDefault();
                popup.enableKeyboardNavigator(true);
                popup.dispatchEvent(synthKeyEvent(KeyEvent.DOM_VK_DOWN));
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
};
