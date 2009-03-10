(function($) {
    var editorSrc =
        '<html xmlns="http://www.w3.org/1999/xhtml">' +
        '  <head>' +
        '  <title></title>' +
        '  <style type="text/css">' +
        '    body { margin: 0; font-family: sans-serif; font-size: 10pt; }' +
        '  </style>' +
        '  <script type="text/javascript">' +
        '    window.addEventListener("load", function() { /*document.designMode = "on";*/ }, false);' +
        '  </script>' +
        '  </head>' +
        '  <body></body>' +
        '</html>';

    $.fn.editor = function(userOpts) {
        var defaults = {
            focus: false,
            onSubmit: null
        };

        var opts = jQuery.extend(defaults, userOpts);

        return this.each(function() {
            var frame = document.createElement('iframe');
            this.appendChild(frame)

            if(opts.focus === true)
                $(frame).load(function(event) {
                    setTimeout(function() { event.target.contentWindow.focus(); });
                });

            if(typeof(opts.onSubmit) == 'function')
                frame.contentWindow.addEventListener('keypress', function(event) {
                    if(event.keyCode == KeyEvent.DOM_VK_RETURN) {
                        event.preventDefault();
                        var doc = event.currentTarget.document;
                        if($.trim(doc.body.textContent) == '')
                            return;

                        opts.onSubmit(doc.body);
                        doc.body.innerHTML = '';
                    }
                }, false);

            var doc = frame.contentDocument;
            doc.designMode = 'on';
            doc.open();
            doc.write(editorSrc);
            doc.close();
        });
    };
})(jQuery);

