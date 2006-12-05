function filterXML(src, acceptElement, acceptAttribute) {
    switch(src.nodeKind()) {
    case 'text':
        return src;
        break;
    case 'element':
        if(acceptElement(src)) {
            var dst = <{src.localName()}/>;
            if(src.parent().namespace() != src.namespace())
                dst.setNamespace(src.namespace());

            for each(var attr in src.attributes())
                if(acceptAttribute(src, attr))
                    dst['@' + attr.localName()] = attr.valueOf();

            for each(var child in src.*::*) {
                var childDst = visit(
                    child, acceptElement, acceptAttribute);
                switch(typeof(childDst)) {
                case 'xml':
                    dst.appendChild(childDst);
                    break;
                case 'object':
                    for each(var item in childDst)
                        dst.appendChild(item);
                    break;
                default:
                    throw new Error('Unexpected. (' + typeof(childDst) + ')');
                }
            }
                
            return dst;
        } else {
            var children = [];
            for each(var child in src.*::*) 
                children.push(visit(child, acceptElement, acceptAttribute));
            
            return children;
        }
        break;
    default:
        throw new Error('Unexpected. (' + src.nodeKind() + ')');
    }
}

var XHTML_IM = {
    recommendedElements: [
        'a', 'body', 'br', 'img',
        'li', 'ol', 'p', 'span', 'ul'],
    
    recommendedAttributes: {
        a:    ['href', 'style', 'type'],
        body: ['style'],
        br:   [],
        img:  ['alt', 'height', 'src', 'style', 'width'],
        li:   ['style'],
        ol:   ['style'],
        p:    ['style'],
        span: ['style'],
        ul:   ['style']
    },

    sanitize: function(messageHTMLBody) {
        var _this = this;
        
        return filterXML(
            messageHTMLBody,
            function(element) {
                return (element.namespace() == ns_xhtml &&
                        _this.recommendedElements.indexOf(element.localName()) != -1);
            },
            function(element, attribute) {
                return (_this.recommendedAttributes[element.localName()].indexOf(
                            attribute.localName()) != -1);
            });
    }
};