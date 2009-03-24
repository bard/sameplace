window.addEventListener('DOMContentLoaded', function() {
    document.getElementById('completions')._openAutocompletePopup = function(aInput, aElement) {
        if(!this.mPopupOpen) {
            this.mInput = aInput;
            document.popupNode = null;
            if(aElement.getAttribute('sizetopopup') == "always" ||
               aElement.getAttribute('sizetopopup') == "pref") {
                var rect = aElement.getBoundingClientRect();
                var width = rect.right - rect.left;
                this.setAttribute("width", width > 100 ? width : 100);
            }
            this._invalidate();

            var nsIPopupBO = Components.interfaces.nsIPopupBoxObject;
            this.popupBoxObject.setConsumeRollupEvent(
                this.mInput.consumeRollupEvent ?
                    nsIPopupBO.ROLLUP_CONSUME :
                    nsIPopupBO.ROLLUP_NO_CONSUME);
            this.openPopup(aElement, "after_start", 0, 0, false, false);
        }
    }
}, false);
