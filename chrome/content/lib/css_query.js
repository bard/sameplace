function $(query) {
    var search = arguments.callee.implementation.search;
    
    var result;
    if(typeof(query) == 'string')
        result = search(query);
    else if(query instanceof Element)
        result = search(query, '');
    else
        throw new Error('Invalid query. (' + query + ')');

    function wrap(context) {
        var wrapper = {
            $: function(subQuery) {
                return wrap(search(result, subQuery));
            },
            
            get _() {
                return context[0];
            },

            get _all() {
                return context;
            }
        }

        return wrapper;
    }

    return wrap(result);
}
$.implementation = {};

Components
.classes['@mozilla.org/moz/jssubscript-loader;1']
.getService(Components.interfaces.mozIJSSubScriptLoader)
.loadSubScript('chrome://sameplace/content/lib/css_query_impl.js', $.implementation);

