var xml = {};

/**
 * For each text node in srcNode XML object, applies processFn.
 * Returns a copy of srcNode with text nodes replaced by results of
 * processFn.
 *
 */

xml.mapTextNodes = function(srcNode, processFn) {
    var mapTextNodes = arguments.callee;
    var dstNode;
    
    switch(srcNode.nodeKind()) {
    case 'text':
        dstNode = processFn(srcNode);
        break;
    case 'element':
        dstNode = <{srcNode.localName()}/>;
        
        for each(var srcAttr in srcNode.@*::*)
            dstNode['@' + srcAttr.localName()] = srcAttr.valueOf();

        for each(var srcChild in srcNode.*::*) {
            var dstChild = mapTextNodes(srcChild, processFn);
            switch(typeof(dstChild)) {
            case 'xml':
            case 'string':
                dstNode.appendChild(dstChild);
                break;
            case 'object':
                for each(var dstChildPart in dstChild) {
                    dstNode.appendChild(dstChildPart);
                }
                break;
            default:
                throw new Error('Unexpected. (' + typeof(dstChild) + ')');
            }
        }

        // It is important that namespace is set *after* children have
        // been added!
        
        dstNode.setNamespace(srcNode.namespace());

        break;
    default:
        throw new Error('Unexpected.');
        break;
    }
    return dstNode;
};
