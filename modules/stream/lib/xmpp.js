var xmpp = {
    _listeners: [],
    _out: null,
    _pending: {},
    _idCounter: 1000,

    init: function() {
        this._out = document.getElementById('xmpp-outgoing');

        window.addEventListener('message', function(event) {
            xmpp._receive(new XML(event.data));
        }, false);
    },

    on: function(condition, action) {
        this._listeners.push([condition, action]);
    },

    event: function(name) {
        return function(stanza) {
            return stanza.localName() == name;
        }
    },

    onEvent: function(action) {
        this._listeners.push(action);
    },

    send: function(stanza, handler) {
        stanza.ns_x4m_in::src = <src xmlns={ns_x4m_in} url={document.location.href}/>;
        if(stanza.name() == 'iq' && stanza.@id == undefined) {
            stanza.@id = '_' + this._idCounter;
            if(handler)
                this._pending['_' + this._idCounter] = handler;

            this._idCounter++;
        }

        this._out.textContent = stanza.toXMLString();

        var sendEvent = document.createEvent('Event');
        sendEvent.initEvent('custom/sendxmpp', true, false);
        this._out.dispatchEvent(sendEvent);
    },

    _receive: function(stanza) {
        if(stanza.name() == 'iq' &&
           stanza.@id in this._pending) {
            var handler = this._pending[stanza.@id];
            delete this._pending[stanza.@id];
            try {
                handler(stanza);
            } catch(e) {
                alert('error: ' + e + '\n' + stanza.toXMLString());
            }
        }

        // this._listeners.forEach(function([condition, action]) {
        //     if(condition(stanza))
        //         action(stanza);
        // });
        this._listeners.forEach(function(action) {
            action(stanza); // wrap in try catch
        });
    }
};
