var tracker = {
    _offsetScrX: -1,
    _offsetScrY: -1,
    _trackerBkg: false,

    onBkgDown: function(event) {
        if(event.target.getAttribute('dragwindow') != 'true')
            return;

        this._offsetScrX = document.documentElement.boxObject.screenX - event.screenX;
        this._offsetScrY = document.documentElement.boxObject.screenY - event.screenY;
        this._trackerBkg = true;
        document.addEventListener(
            'mousemove', this.onBkgMove, true);
    },

    onBkgMove: function(theEvent) {
        if(tracker._trackerBkg) {
            document.defaultView.moveTo(
                tracker._offsetScrX + theEvent.screenX,
                tracker._offsetScrY + theEvent.screenY);
            if(tracker.onMove)
                tracker.onMove();
        }
    },

    onBkgUp: function() {
        if(this._trackerBkg) {
            this._trackerBkg = false;
            document.removeEventListener(
                'mousemove', this.onBkgMove, true);
        }
    }
};
