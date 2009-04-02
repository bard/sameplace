

if(typeof(JSON) == 'undefined') {
    var JSON = {
        parse: function(string) {
            return $.evalJSON(string);
        },

        stringify: function(object) {
            return $.toJSON(object);
        }
    }
}


// Storage wrapper.  Uses custom events and DOM areas in the current
// implementation and requires cooperation from chrome.  Wouldn't be
// needed if DOM storage worked for file:// URIs.

var storage = {
    data: {},

    init: function(defaults) {
        if(defaults)
            $.extend(this.data, defaults)
    },

    onUpdate: function(event) {
        var _id = event.target.id.match(/^storage-(.+)$/)[1];
        this.data[_id] = JSON.parse(event.target.textContent);
    },

    load: function(_id) {
        return this.data[_id];
    },

    save: function(object) {
        if(!('_id' in object))
            throw new Error('Object needs an "_id" property.');

        var storageNode =
            $('#storage-' + object._id)[0] ||
            $('#storage').append('<div id="storage-' + object._id + '"/>');

        storageNode.textContent = JSON.stringify(object);

        var storeEvent = document.createEvent('Event');
        storeEvent.initEvent('custom/store/save', true, false);
        storageNode.dispatchEvent(storeEvent);

        return object;
    }
};
