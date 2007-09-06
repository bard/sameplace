function shallowClone(object) {
    var clone = {};
    for(var name in object)
        clone[name] = object[name];
    return clone;
}

if(!('@mozilla.org/appshell/component/browser-status-filter;1' in Components.classes)) {
    // Thunderbird 2.0 lacks browser-status-filter but <tabbrowser/> needs it.
    // Trick Thunderbird into believing that it has such component.
    var Components = shallowClone(Components);
    Components.classes = shallowClone(Components.classes);
    Components.classes['@mozilla.org/appshell/component/browser-status-filter;1'] = {
        createInstance: function() {
            return {
                addProgressListener: function() {},
        
                removeProgressListener: function() {},
                
                onLocationChange: function() {},
                
                onProgressChange: function() {},
                
                onSecurityChange: function() {},
                
                onStateChange: function() {},
                
                onStatusChange: function() {},

                QueryInterface: function() {
                    return this;
                }
            }
        }
    };
}
