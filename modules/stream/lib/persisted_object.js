function PersistedObject(name, autosave) {
    this._name = name;
    this._data = $.evalJSON(PersistedObject._storage[name]);

    function makeGetter(obj, n) {
        obj.__defineGetter__(n, function() {
            return obj._data[n];
        });
    }

    function makeSetter(obj, n) {
        obj.__defineSetter__(
            n, (autosave ?
                function(val) {
                    obj._data[n] = val;
                    this.save();
                    return val;
                }
                :
                function(val) {
                    return obj._data[n] = val;
                }));
    }

    for(var n in this._data) {
        makeGetter(this, n);
        makeSetter(this, n);
    }
}

PersistedObject._storage = globalStorage[document.location.host];

PersistedObject.create = function(name, defaults, autosave) {
    if(name in this._storage) {
        var obj = this._storage[name];
        if('version' in defaults) {
            throw new Error('Versioning not supported yet.');
        } else {
            throw new Error('Object "' + name + '" exists already.');
        }
    }

    this._storage[name] = $.toJSON(defaults);
    return new PersistedObject(name, autosave);
};

PersistedObject.get = function(name, autosave) {
    if(PersistedObject.exists(name))
        return new PersistedObject(name, autosave);
    else
        return null;
};

PersistedObject.exists = function(name) {
    return (name in this._storage);
};

PersistedObject.prototype.save = function() {
    return PersistedObject._storage[this._name] = $.toJSON(this._data);
};

PersistedObject.prototype.destroy = function() {
    delete PersistedObject._storage[this._name];
};
