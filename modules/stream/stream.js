var ns_vcard        = 'vcard-temp';

// STATE
// ----------------------------------------------------------------------

// Rosters.  Used for getting contact name from contact address
var rosters;

// Cache for vCards
var vcards;

// Objects that process an XMPP event into an XHTML representation
var translators = [];

// Functions to apply to text nodes in messages body, presence status
// (and possibly others) before displaying
var displayFilters = [filters.processURLs, filters.processImageBinds];

var applyFilters = compose(
    filters.processURLs,
    filters.processImageBinds
);


// Defaults
var defaultConf = {
    // For internal use of the storage system
    _id: 'conf',

    // Every ten seconds, check how many events we're displaying and
    // remove older ones so that 100 events are left
    maxEvents: 100,
    cleanupInterval: 10000,

    muted: {},

    version: '0.10'
};


XML.prettyPrinting = false;
XML.ignoreWhitespace = false;


// INITIALIZATION
// ----------------------------------------------------------------------

// Initialize components that don't need the DOM right away

storage.init({conf: defaultConf});
vcards = { __proto__: null };
rosters = new XMLList();

// Initialize DOM-dependent components when DOM is ready

$(document).ready(function() {
    // Initialize xmpp forwarding

    xmpp.init();

    xmpp.onEvent(function(stanza) {
        var event = translate(stanza);
        if(event)
            display(event);
    });

    xmpp.onEvent(function(stanza) {
        if(stanza.localName() == 'iq' &&
           stanza.@type == 'result' &&
           stanza.ns_roster::query != undefined)
            // XXX should handle type='set' too
            rosters += stanza;
    });

    // Initialize UI elements

    $('#input').editor({
        focus: true,
        onSubmit: submittedInput
    });

    $('.event').live('overflow', function() {
        $(this).addClass('toggleable');
    });

    $('.event .toggle').live('click', function(event) {
        $(this).blur();

        var container = $(this).closest('.event');
        var content = container.find('.body');

        if(container.height() < content.height()) {
            container
                .data('originalHeight', container.height())
                .css({
                    'height': container.height() + 'px',
                    'max-height': 'none'
                })
                .animate({height: content.height()}, function() {
                    $(this).addClass('expanded');
                });
        } else {
            container
                .animate({height: container.data('originalHeight')}, function() {
                    $(this).removeClass('expanded');
                })
                .data('originalHeight', null);
        }
    });

    $('.message.direction-in').live('click', function(event) {
        prepareReply($(this).find('.origin').text());
    });

    // Initialize periodic tasks

    // XXX race condition here, custom config isn't necessarily
    // available here.

    var conf = storage.load('conf');
    window.setInterval(cleanup, conf.cleanupInterval);

    //    simulate();

    // $(window).bind('custom/blur', function() {
    //     $('#stream > .event.reading-cue').removeClass('reading-cue');
    //     $('#stream > .event:last-child').addClass('reading-cue');
    // });
});


// UI REACTIONS
// ----------------------------------------------------------------------

$(document).bind('custom/store/update', function(e) storage.onUpdate(e));

function submittedInput(htmlBody) {
    var xhtmlBody = conv.htmlDOMToXHTML(htmlBody);

    // Stripping trailing <br/> if present
    var lastChildIndex = xhtmlBody.children().length()-1;
    if(xhtmlBody.*::*[lastChildIndex].localName() == 'br')
        delete xhtmlBody.*::*[lastChildIndex];
}


// HANDLERS
// ----------------------------------------------------------------------

// Drive the process of translating an XMPP stanza into an XHTML
// event.

function translate(stanza) {
    for each(var translator in translators) {
        if(translator.match(stanza))
            return translator.process(stanza);
    }
}

translators.push({
    description: 'Plain chat messages',

    match: function(stanza) {
        if(stanza.localName() != 'message')
            return false;
        if(stanza.body.text() == '' &&
           stanza.ns_xhtml_im::html == undefined)
            return false;

        return true;
    },

    process: function(stanza) {
        var content = applyFilters(stanza.body, displayFilters)
            .children()
            .toXMLString();

        var originAddress, targetAddress, account, direction;

        account   = stanza.@ns_x4m_in::account.toString();
        direction = stanza.@ns_x4m_in::direction.toString();

        var event = $('#blueprints > .event')
            .clone()
            .addClass('message')
            .addClass('direction-' + direction)
            .find('.content')
            .html(content)
            .end();

        switch(direction) {
        case 'in':
            originAddress = stanza.@from.toString().split('/')[0];
            targetAddress = account;

            event.find('.origin')
                .text(getName(originAddress))
                .after(': ')
                .attr('href', 'xmpp://' + account + '/' + stanza.@from)
                .end();

            break;
        case 'out':
            originAddress = account;
            targetAddress = stanza.@to.toString().split('/')[0];

            event.find('.target')
                .text(getName(targetAddress))
                .attr('href', 'xmpp://' + account + '/' + stanza.@to)
                .end();
            break;
        }

        return event;
    }
});

translators.push({
    description: 'Plain presence',

    match: function(stanza) {
	if(stanza.localName() != 'presence')
            return false;
        if(stanza.status.text() == '')
            return false;
        if(stanza.@ns_x4m_in::direction == 'in' &&
           // XXX maybe should use names
           JID(stanza.@from).address in storage.load('conf').muted)
            return false;
        if(stanza.@type == 'error')
            return;

        // If last presence we showed for this origin had the same
        // content, omit this.  This is needed for 1) contacts on
        // GMail, for which Google sends redundant presences and 2)
        // for when we're logged with multiple accounts and set a
        // status message, thereby sending out the same presence for
        // each.

        var origin = (stanza.@ns_x4m_in::direction == 'in' ?
                      JID(stanza.@from).address : 'me');
        if(this._alreadySeen(origin, stanza.status.text()))
            return false;

        return true;
    },

    process: function(stanza) {
        var content = applyFilters(stanza.status, displayFilters)
            .children()
            .toXMLString();

        var account = stanza.@ns_x4m_in::account;
        var direction = stanza.@ns_x4m_in::direction;

        var event = $('#blueprints > .event')
            .clone()
            .addClass('presence')
            .addClass('direction-' + direction)
            .find('.content')
            .html(content)
            .end();

        if(direction == 'in') {
            var originAddress = (stanza.@ns_x4m_in::direction == 'in' ?
                                 JID(stanza.@from).address : 'me');

            event.find('.origin')
                .attr('href', 'xmpp://' + account + '/' + stanza.@from)
                .text(getName(originAddress))
                .end();

            var me = this;
            xmpp.send(<iq type='get' to={originAddress} xmlns:x4m={ns_x4m_in}
                      x4m:account={account}>
                      <vCard xmlns={ns_vcard}/>
                      <cache-control xmlns={ns_x4m_in}/>
                      </iq>, function(stanza) {
                          var xmlPhoto = stanza..ns_vcard::PHOTO;
                          if(xmlPhoto != undefined)
                              me._updateAvatar(event, xmlPhoto);
                      });

            this._remember(originAddress, stanza.status.text());
        } else
            this._remember('me', stanza.status.text());

        return event;
    },

    _remember: function(origin, text) {
        this._lastSeen[origin] = text;
    },

    _alreadySeen: function(origin, text) {
        return (origin in this._lastSeen &&
                this._lastSeen[origin] == text);
    },

    _lastSeen: { __proto__: null },

    _updateAvatar: function(event, xmlPhoto) {
        event.find('.avatar').attr(
            'src',
            'data:' +
                xmlPhoto.ns_vcard::TYPE +
                ';base64,' +
                xmlPhoto.ns_vcard::BINVAL);
    }
});


// UI ACTION
// ----------------------------------------------------------------------

function display(event) {
    scrollIfAtBottom($('#stream')[0], function() {
        // XXX introduce event-groups
        var last = $('#stream .event:last-child');

        if(last.find('.origin').text() == event.find('.origin').text() &&
           last.hasClass('message') && event.hasClass('message') &&
           ((last.hasClass('direction-in') && event.hasClass('direction-in') ||
             (last.hasClass('direction-out') && event.hasClass('direction-out'))))
          )
            event.addClass('continuation');

        $('#stream').append(event.fadeIn());
    });
}

function prepareReply(recipient) {
    $('#input iframe')[0].contentDocument.body.textContent =
        '@' + recipient  + ': ';
    $('#input iframe')[0].contentWindow.focus();
    // XXX must find a way to move cursor to the end
}

function cleanup() {
    var events = $('#stream').children();
    var conf = storage.load('conf');
    if(events.length > conf.maxEvents)
        events.slice(0, events.length-conf.maxEvents).remove();
}

// XXX should be somehow bound to the presence translator?

function mutePresence(eventDescendant) {
    var originURI = $(eventDescendant)
        .closest('.event.presence')
        .find('.origin')
        .attr('href');

    var conf = storage.load('conf');
    conf.muted[entity(originURI).address] = true;

    $('#stream .event.presence').filter(function() {
        return $(this).find('.origin').attr('href') == originURI;
    }).fadeOut(function() $(this).remove());

    storage.save(conf);
}


// UTILITIES
// ----------------------------------------------------------------------

function getName(address) {
    var item = rosters..ns_roster::item.(@jid == address);
    if(item.length() > 0 &&
       item[0].@name.toString() !== '')
        return item[0].@name;
    else
        return address.split('@')[0];
}


// DEVELOPMENT
// ----------------------------------------------------------------------

function simulate() {
    xmpp._receive(
            <iq from="test@localhost/SamePlace" to="test@localhost/SamePlace" id="_12360120459721002" type="result"
        xmlns:x4m={ns_x4m_in} x4m:account="test@localhost" x4m:direction="in">
            <query xmlns="jabber:iq:roster">
            <item ask="subscribe" subscription="none" jid="foo@localhost"/>
            <item ask="subscribe" subscription="none" name="Fido" jid="fido@localhost"/>
            </query>
            </iq>);

    var stanzas = [];
    for(var i=0; i<4; i++) {
        stanzas.push(<presence from="fido@localhost/Test" xmlns:x4m={ns_x4m_in} x4m:direction="in" x4m:account="test@localhost">
                     <status>@jenny feeling good, and you aoeu ao98e gua8oeurcaho ercuha roche uracohercu ahorceh uracohercuhaorchrao cherucahoer ucaohrcehu ao reuaho rceh uarcoheurc bracohe urcaohercu?</status>
                     </presence>);

        stanzas.push(<message to="fido@localhost/Test" type="chat" xmlns:x4m={ns_x4m_in} x4m:direction="out" x4m:account="test@localhost">
                     <body>hello back!</body>
                     </message>);
        stanzas.push(<message to="fido@localhost/Test" type="chat" xmlns:x4m={ns_x4m_in} x4m:direction="out" x4m:account="test@localhost">
                     <body>hello back!</body>
                     </message>);
        stanzas.push(<message to="fido@localhost/Test" type="chat" xmlns:x4m={ns_x4m_in} x4m:direction="out" x4m:account="test@localhost">
                     <body>hello back!</body>
                     </message>);


        stanzas.push(<message from="fido@localhost/Test" type="chat" xmlns:x4m={ns_x4m_in} x4m:direction="in" x4m:account="test@localhost">
                     <body>hello, bard! see www.google.com</body>
                     </message>);
        stanzas.push(<message from="fido@localhost/Test" type="chat" xmlns:x4m={ns_x4m_in} x4m:direction="in" x4m:account="test@localhost">
                     <body>boom!</body>
                     </message>);

        stanzas.push(<presence from="fido@localhost/Test" xmlns:x4m={ns_x4m_in} x4m:direction="in" x4m:account="test@localhost">
                     <status>aaaah</status>
                     </presence>);

        stanzas.push(<presence xmlns:x4m={ns_x4m_in} x4m:direction="out" x4m:account="test@localhost">
                     <status>see me at http://www.sameplace.cc</status>
                     </presence>);
        stanzas.push(<presence xmlns:x4m={ns_x4m_in} x4m:direction="out" x4m:account="test@localhost">
                     <status>see me at http://www.sameplace.cc</status>
                     </presence>);



        stanzas.push(<message from="jimbo@localhost/Test" type="chat" xmlns:x4m={ns_x4m_in} x4m:direction="in" x4m:account="test@localhost">
                     <body>grrrr</body>
                     </message>);
        stanzas.push(<message from="jimbo@localhost/Test" type="chat" xmlns:x4m={ns_x4m_in} x4m:direction="in" x4m:account="test@localhost">
                     <body>grrrr</body>
                     </message>);
        stanzas.push(<message from="jimbo@localhost/Test" type="chat" xmlns:x4m={ns_x4m_in} x4m:direction="in" x4m:account="test@localhost">
                     <body>grrrr</body>
                     </message>);

        stanzas.push(<presence xmlns:x4m={ns_x4m_in} x4m:direction="out" x4m:account="test@localhost">
                     <status>see me at http://www.sameplace.cc</status>
                     </presence>);

    }

//    stanzas.sort(function() Math.random() - 0.5);

    var c = 0;
    window.setInterval(function() {
        if(c == stanzas.length)
            c = 0;

        xmpp._receive(stanzas[c++]);
    }, 1000);
}


function autoReply(stanza) {
    xmpp.send(<message to={stanza.@from} type={stanza.@type.toString() || 'normal'}
              xmlns:x4m={ns_x4m_in} x4m:account={stanza.@ns_x4m_in::account}>
              <body>autoreply</body>
              </message>);
}

