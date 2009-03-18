function scrollIfAtBottom(domElement, action) {
    var shouldScroll = isNearBottom(domElement);
    action();
    if(shouldScroll)
        scrollToBottom(domElement);
}

function isNearBottom(domElement, threshold) {
    return Math.abs(domElement.scrollHeight -
                    (domElement.scrollTop + domElement.clientHeight)) < (threshold || 24);
}

function scrollToBottom(domElement, smooth) {
    if(smooth === undefined)
        smooth = true;

    if(smooth)
        smoothScroll(domElement);
    else
        domElement.scrollTop =
            domElement.scrollHeight - domElement.clientHeight;
}

function smoothScroll(domElement, stepsLeft) {
    if(stepsLeft == undefined)
        stepsLeft = 4;
    else if(stepsLeft == 0)
        return;

    var targetScrollTop = domElement.scrollHeight - domElement.clientHeight;
    var deltaScrollTop = Math.abs(domElement.scrollTop - targetScrollTop);
    var nextStep = deltaScrollTop / stepsLeft;
    domElement.scrollTop += nextStep;

    window.setTimeout(
        function() { smoothScroll(domElement, stepsLeft - 1); }, 5);
}
