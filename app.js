/* app.js: UI for Quiet Zone. Encoding and rendering live in qr-render.js. */
(function () {
  'use strict';

  var R = window.QRRender;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  // Minimum module size that survives print, and the rule that a code scans
  // from roughly ten times its own width.
  var MM_PER_MODULE = 0.4;
  var DISTANCE_RATIO = 10;
  var STORE_KEY = 'quietzone.presets.v1';
  var THEME_KEY = 'quietzone.theme';

  // ---- payload definitions ------------------------------------------------

  var TYPES = [
    { id: 'url', label: 'Link' }, { id: 'text', label: 'Text' },
    { id: 'wifi', label: 'Wi-Fi' }, { id: 'vcard', label: 'Contact' },
    { id: 'email', label: 'Email' }, { id: 'sms', label: 'SMS' },
    { id: 'phone', label: 'Phone' }, { id: 'geo', label: 'Location' },
    { id: 'event', label: 'Event' }
  ];

  var FIELDS = {
    url: [{ k: 'url', label: 'Destination', ph: 'techbbq.org/tickets', wide: true,
            hint: 'Non-ASCII characters are percent-encoded so every scanner reads them.' }],
    text: [{ k: 'text', label: 'Text', type: 'textarea', wide: true }],
    wifi: [
      { k: 'ssid', label: 'Network name (SSID)' },
      { k: 'auth', label: 'Security', type: 'select', opts: [['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP'], ['nopass', 'Open (no password)']] },
      { k: 'password', label: 'Password' },
      { k: 'hidden', label: 'Hidden network', type: 'check' }
    ],
    vcard: [
      { k: 'first', label: 'First name' }, { k: 'last', label: 'Last name' },
      { k: 'org', label: 'Organisation' }, { k: 'title', label: 'Job title' },
      { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'email', label: 'Email', type: 'email' },
      { k: 'url', label: 'Website', wide: true }
    ],
    email: [
      { k: 'to', label: 'To', type: 'email', wide: true },
      { k: 'subject', label: 'Subject', wide: true },
      { k: 'body', label: 'Message', type: 'textarea', wide: true }
    ],
    sms: [{ k: 'phone', label: 'Number', type: 'tel' }, { k: 'message', label: 'Message' }],
    phone: [{ k: 'phone', label: 'Number', type: 'tel', wide: true }],
    geo: [{ k: 'lat', label: 'Latitude', type: 'number' }, { k: 'lng', label: 'Longitude', type: 'number' }],
    event: [
      { k: 'title', label: 'Event name', wide: true },
      { k: 'location', label: 'Location', wide: true },
      { k: 'start', label: 'Starts', type: 'datetime-local' },
      { k: 'end', label: 'Ends', type: 'datetime-local' }
    ]
  };

  // ---- state --------------------------------------------------------------

  function defaults() {
    return {
      type: 'url',
      data: {
        url: 'techbbq.org/tickets', text: '',
        ssid: 'TechBBQ Guest', password: '', auth: 'WPA', hidden: false,
        first: '', last: '', org: '', title: '', phone: '', email: '', note: '',
        to: '', subject: '', body: '', message: '',
        lat: 55.6761, lng: 12.5683, start: '', end: '', location: ''
      },
      ec: 'M', style: 'rounded', eyeStyle: 'rounded', margin: 4,
      fg: '#ce0f2e', bg: '#ffffff',
      gradOn: false, gradFrom: '#fa7000', gradTo: '#ce0f2e', gradAngle: 120,
      eyeOn: false, eyeColor: '#0d0d0d',
      logoMode: 'none', logoMark: 'tbbq-gradient', logoHref: null, logoPct: 0.2,
      frameOn: false, frameText: 'SCAN ME', frameFill: '#ce0f2e', frameTextColor: '#ffffff',
      markColor: '#10c8a7',
      logoPlate: false, logoPlateColor: '#ffffff', logoPad: 0.5,
      expiry: '', expiryInLink: false,
      utm: { source: '', medium: '', campaign: '', content: '' },
      redirectTo: '',
      distanceCm: 30
    };
  }

  var state = defaults();

  // Presets and links carry the look only. Not the payload, and not an uploaded
  // image, which would not fit in a URL.
  var STYLE_KEYS = ['ec', 'style', 'eyeStyle', 'margin', 'fg', 'bg',
    'gradOn', 'gradFrom', 'gradTo', 'gradAngle', 'eyeOn', 'eyeColor',
    'logoMode', 'logoMark', 'logoPct', 'markColor',
    'logoPlate', 'logoPlateColor', 'logoPad',
    'frameOn', 'frameText', 'frameFill', 'frameTextColor'];

  var BUILTIN_PRESETS = [
    { name: 'TechBBQ ticket', style: { fg: '#ce0f2e', bg: '#ffffff', style: 'rounded', eyeStyle: 'rounded', ec: 'H', gradOn: false, eyeOn: false, logoMode: 'mark', logoMark: 'tbbq-gradient', logoPct: 0.2, frameOn: false } },
    { name: 'Gradient poster', style: { bg: '#ffffff', style: 'rounded', eyeStyle: 'rounded', ec: 'H', gradOn: true, gradFrom: '#fa7000', gradTo: '#ce0f2e', gradAngle: 120, eyeOn: true, eyeColor: '#0d0d0d', logoMode: 'none', frameOn: true, frameText: 'SCAN ME', frameFill: '#0d0d0d', frameTextColor: '#f2f2f2' } },
    { name: 'Badge (mono)', style: { fg: '#0d0d0d', bg: '#ffffff', style: 'square', eyeStyle: 'square', ec: 'Q', gradOn: false, eyeOn: false, logoMode: 'none', frameOn: false, margin: 4 } },
    { name: 'Wi-Fi card', style: { fg: '#0d0d0d', bg: '#ffffff', style: 'dots', eyeStyle: 'circle', ec: 'M', gradOn: false, eyeOn: false, logoMode: 'none', frameOn: true, frameText: 'JOIN THE WI-FI', frameFill: '#10c8a7', frameTextColor: '#0d0d0d' } },
    { name: 'Signage', style: { fg: '#ce0f2e', bg: '#ffffff', style: 'rounded', eyeStyle: 'rounded', ec: 'H', gradOn: false, eyeOn: false, logoMode: 'mark', logoMark: 'tbbq-red', logoPct: 0.22, frameOn: true, frameText: 'GET TICKETS', frameFill: '#ce0f2e', frameTextColor: '#ffffff', margin: 4 } }
  ];

  // Chips are limited to pairs that clear the ~4:1 contrast floor. Brand teal
  // (2.13:1 on white) and ignite orange (2.84:1) are deliberately absent; the
  // gradient is offered because it is the signature look, and the app warns.
  var COLOUR_CHIPS = [
    { name: 'Founder red', fg: '#ce0f2e', bg: '#ffffff', gradOn: false },
    { name: 'Black',       fg: '#0d0d0d', bg: '#ffffff', gradOn: false },
    { name: 'Grit',        fg: '#5e101a', bg: '#ffffff', gradOn: false },
    { name: 'Ember',       fg: '#d74a01', bg: '#ffffff', gradOn: false },
    { name: 'Gradient',    bg: '#ffffff', gradOn: true, gradFrom: '#fa7000', gradTo: '#ce0f2e', gradAngle: 120 },
    { name: 'Inverted',    fg: '#f2f2f2', bg: '#0d0d0d', gradOn: false }
  ];

  // Real-world sizes, so nobody has to reason in millimetres. The distance
  // comes from the 10x-width rule.
  var PRINT_CHIPS = [
    { name: 'Sticker', mm: 25 }, { name: 'Badge', mm: 40 },
    { name: 'Flyer', mm: 60 }, { name: 'Poster', mm: 120 }, { name: 'Banner', mm: 250 }
  ];

  var RECENT_KEY = 'quietzone.recent.v1';

  // ---- persistence --------------------------------------------------------

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* private mode */ }
  }

  function savedPresets() {
    try { return JSON.parse(safeGet(STORE_KEY) || '[]'); } catch (e) { return []; }
  }
  function writePresets(list) { safeSet(STORE_KEY, JSON.stringify(list)); }

  function recents() {
    try { return JSON.parse(safeGet(RECENT_KEY) || '[]'); } catch (e) { return []; }
  }

  // Remembers what was made, most recent first, de-duplicated on the payload.
  function pushRecent() {
    var text = payload();
    if (!text) return;
    var list = recents().filter(function (r) { return r.text !== text; });
    list.unshift({
      text: text, type: state.type, data: JSON.parse(JSON.stringify(state.data)),
      style: styleOf(state), at: Date.now()
    });
    safeSet(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
    renderRecents();
  }

  function styleOf(src) {
    var out = {};
    STYLE_KEYS.forEach(function (k) { out[k] = src[k]; });
    return out;
  }

  function applyStyle(raw) {
    var style = sanitizeStyle(raw, state);
    STYLE_KEYS.forEach(function (k) {
      if (style[k] !== undefined) state[k] = style[k];
    });
    syncControls();
    render();
  }

  // ---- validating anything that arrives from a URL ------------------------
  //
  // A shared link is attacker-controlled input. Every value it carries is
  // whitelisted or coerced here before it reaches state, because state values
  // end up in markup and in SVG attributes.

  var ENUMS = {
    ec: ['L', 'M', 'Q', 'H'],
    style: ['square', 'rounded', 'dots'],
    eyeStyle: ['square', 'rounded', 'circle'],
    logoMode: ['none', 'mark', 'custom']
  };
  var COLOUR_KEYS = ['fg', 'bg', 'gradFrom', 'gradTo', 'eyeColor',
    'frameFill', 'frameTextColor', 'markColor', 'logoPlateColor'];
  var BOOL_KEYS = ['gradOn', 'eyeOn', 'frameOn', 'logoPlate'];

  // #rgb or #rrggbb only. Named colours and CSS functions are rejected: they
  // are the opening for style-attribute injection and nothing here needs them.
  function colour(v, fallback) {
    return (typeof v === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim()))
      ? v.trim().toLowerCase()
      : fallback;
  }

  function clampNum(v, lo, hi, fallback) {
    var n = Number(v);
    return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
  }

  function sanitizeStyle(raw, base) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(ENUMS).forEach(function (k) {
      if (ENUMS[k].indexOf(raw[k]) > -1) out[k] = raw[k];
    });
    COLOUR_KEYS.forEach(function (k) {
      var c = colour(raw[k], null);
      if (c) out[k] = c;
    });
    BOOL_KEYS.forEach(function (k) {
      if (typeof raw[k] === 'boolean') out[k] = raw[k];
    });
    if (raw.margin !== undefined) out.margin = Math.round(clampNum(raw.margin, 0, 8, base.margin));
    if (raw.gradAngle !== undefined) out.gradAngle = Math.round(clampNum(raw.gradAngle, 0, 359, base.gradAngle));
    if (raw.logoPct !== undefined) out.logoPct = clampNum(raw.logoPct, 0.08, 0.35, base.logoPct);
    if (raw.logoPad !== undefined) out.logoPad = clampNum(raw.logoPad, 0, 2, base.logoPad);
    if (Object.prototype.hasOwnProperty.call(R.MARKS, raw.logoMark)) out.logoMark = raw.logoMark;
    if (typeof raw.frameText === 'string') out.frameText = raw.frameText.slice(0, 40);
    return out;
  }

  // Payload fields: known keys only, and bounded in length.
  var FIELD_KEYS = (function () {
    var seen = {};
    Object.keys(FIELDS).forEach(function (t) {
      FIELDS[t].forEach(function (d) { seen[d.k] = true; });
    });
    return seen;
  })();

  function sanitizeData(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(function (k) {
      if (!FIELD_KEYS[k]) return;
      var v = raw[k];
      if (typeof v === 'boolean' || typeof v === 'number') out[k] = v;
      else if (typeof v === 'string') out[k] = v.slice(0, 2000);
    });
    return out;
  }

  // ---- shareable link -----------------------------------------------------

  function b64urlEncode(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(str) {
    var s = str.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(s)));
  }

  function shareUrl() {
    // Carry only the fields the chosen type actually uses, and only when they
    // hold something. Otherwise every empty input bloats the link.
    var used = {};
    (FIELDS[state.type] || []).forEach(function (d) {
      var v = state.data[d.k];
      if (v !== '' && v !== null && v !== undefined && v !== false) used[d.k] = v;
    });
    var payload = { s: styleOf(state), t: state.type, d: used };
    if (state.expiry) payload.x = { e: state.expiry, l: state.expiryInLink };
    return location.origin + location.pathname + '#' + b64urlEncode(JSON.stringify(payload));
  }

  function readHash() {
    if (!location.hash || location.hash.length < 2) return;
    if (location.hash.length > 8000) return;          // no oversized payloads
    try {
      var obj = JSON.parse(b64urlDecode(location.hash.slice(1)));
      if (obj.t && FIELDS[obj.t]) state.type = obj.t;

      var data = sanitizeData(obj.d);
      Object.keys(data).forEach(function (k) { state.data[k] = data[k]; });

      var style = sanitizeStyle(obj.s, state);
      STYLE_KEYS.forEach(function (k) {
        if (style[k] !== undefined) state[k] = style[k];
      });

      if (obj.x) {
        // ISO date only; anything else is dropped rather than shown back.
        state.expiry = /^\d{4}-\d{2}-\d{2}$/.test(obj.x.e) ? obj.x.e : '';
        state.expiryInLink = obj.x.l === true;
      }
    } catch (e) { /* a malformed link just falls back to defaults */ }
  }

  // ---- theme --------------------------------------------------------------

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    $('#theme-icon').textContent = t === 'dark' ? '◐' : '◑';
    $('#theme').setAttribute('aria-label',
      'Switch to ' + (t === 'dark' ? 'light' : 'dark') + ' theme');
    safeSet(THEME_KEY, t);
  }

  // ---- rendering the form -------------------------------------------------

  function renderTypes() {
    $('#types').innerHTML = TYPES.map(function (t) {
      return '<button type="button" data-type="' + t.id + '" aria-pressed="' +
        (state.type === t.id) + '">' + t.label + '</button>';
    }).join('');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

  function renderFields() {
    var defs = FIELDS[state.type];
    var wrap = $('#fields');
    wrap.className = 'fields' + (defs.length > 1 && !defs.every(function (d) { return d.wide; }) ? ' two' : '');
    wrap.innerHTML = defs.map(function (d) {
      var v = state.data[d.k], id = 'f_' + d.k, body;
      if (d.type === 'textarea') {
        body = '<textarea id="' + id + '" data-k="' + d.k + '" rows="3">' + esc(v) + '</textarea>';
      } else if (d.type === 'select') {
        body = '<select id="' + id + '" data-k="' + d.k + '">' + d.opts.map(function (o) {
          return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select>';
      } else if (d.type === 'check') {
        body = '<label class="check"><input type="checkbox" id="' + id + '" data-k="' + d.k + '"' +
          (v ? ' checked' : '') + '> Yes</label>';
      } else {
        body = '<input type="' + (d.type || 'text') + '" id="' + id + '" data-k="' + d.k +
          '" value="' + escAttr(v) + '"' + (d.ph ? ' placeholder="' + escAttr(d.ph) + '"' : '') +
          ' autocomplete="off" spellcheck="false">';
      }
      var lab = d.type === 'check' ? '<label>' + d.label + '</label>'
        : '<label for="' + id + '">' + d.label + '</label>';
      return '<div class="field"' + (d.wide ? ' style="grid-column:1/-1"' : '') + '>' +
        lab + body + (d.hint ? '<span class="hint">' + d.hint + '</span>' : '') + '</div>';
    }).join('');
  }

  // Each preset draws itself, so a look can be chosen by sight rather than by
  // clicking through and watching the preview.
  function presetThumb(style) {
    return R.svg('https://techbbq.org', Object.assign(optsFrom(fullStyle(style), null), { px: 104 }));
  }

  function renderPresetGallery() {
    var mine = savedPresets();
    // The delete control is a sibling, not a child: nesting a button inside a
    // button is invalid and breaks keyboard and screen-reader behaviour.
    var cell = function (p, id, own) {
      return '<div class="pwrap">' +
        '<button type="button" class="pcell" data-preset="' + id + '">' +
        '<span class="pthumb" aria-hidden="true">' + presetThumb(p.style) + '</span>' +
        '<span class="pname">' + esc(p.name) + '</span>' +
        '</button>' +
        (own ? '<button type="button" class="pdel" data-del="' + id.slice(1) +
          '" aria-label="Delete the ' + escAttr(p.name) + ' style">&times;</button>' : '') +
        '</div>';
    };
    $('#presetgal').innerHTML =
      BUILTIN_PRESETS.map(function (p, i) { return cell(p, 'b' + i, false); }).join('') +
      mine.map(function (p, i) { return cell(p, 'u' + i, true); }).join('');
  }

  function renderColourChips() {
    $('#colorchips').innerHTML = COLOUR_CHIPS.map(function (c, i) {
      var sw = c.gradOn
        ? 'background:linear-gradient(120deg,' + c.gradFrom + ',' + c.gradTo + ')'
        : 'background:' + c.fg;
      return '<button type="button" class="chip-btn" data-chip="' + i + '">' +
        '<span class="chip-dot" style="' + sw + ';outline:1px solid ' + c.bg + '"></span>' +
        esc(c.name) + '</button>';
    }).join('');
  }

  function renderPrintChips() {
    $('#printchips').innerHTML = PRINT_CHIPS.map(function (c, i) {
      return '<button type="button" class="chip-btn" data-print="' + i + '">' +
        esc(c.name) + ' <span class="chip-sub">' + c.mm + 'mm</span></button>';
    }).join('');
  }

  function renderRecents() {
    var list = recents();
    $('#recentblock').hidden = list.length === 0;
    $('#recents').innerHTML = list.map(function (r, i) {
      var label = r.text.replace(/^https?:\/\//, '');
      if (label.length > 30) label = label.slice(0, 29) + '…';
      return '<button type="button" data-recent="' + i + '" title="' + escAttr(r.text) + '">' +
        esc(label) + '</button>';
    }).join('');
  }

  function renderMarkVars() {
    $('#markvars').innerHTML = Object.keys(R.MARKS).map(function (k) {
      return '<button type="button" data-mark="' + k + '" aria-pressed="' +
        (state.logoMark === k) + '">' + R.MARKS[k].label + '</button>';
    }).join('');
  }

  // Types whose whole payload is one string, so the omnibox can drive them.
  var SIMPLE = { url: 'url', text: 'text' };

  function syncQuick() {
    var simple = !!SIMPLE[state.type];
    $('#quick').placeholder = simple
      ? 'Paste a link, email, phone number, Wi-Fi…'
      : 'Paste ' + (R.TYPE_LABELS[state.type] || 'a value') + ' to fill the fields below';
    if (simple) $('#quick').value = state.data[SIMPLE[state.type]] || '';
    else $('#quick').value = '';
    $('#detailblock').hidden = simple;
  }

  // Offer a switch when what was pasted clearly is not the current type.
  function offerSwitch(raw) {
    var box = $('#suggest');
    var hit = R.detect(raw);
    if (!hit || hit.type === state.type || (SIMPLE[state.type] && hit.type === 'text')) {
      box.hidden = true;
      pendingSwitch = null;
      return;
    }
    pendingSwitch = hit;
    box.hidden = false;
    box.innerHTML = '<span>That looks like <b>' + esc(R.TYPE_LABELS[hit.type] || hit.type) +
      '</b>.</span><button type="button" class="btn primary" id="dosuggest">Use it</button>' +
      '<button type="button" class="btn outline" id="nosuggest">Keep as is</button>';
  }

  var pendingSwitch = null;

  function applySwitch() {
    if (!pendingSwitch) return;
    var hit = pendingSwitch;
    state.type = hit.type;
    Object.keys(hit.data || {}).forEach(function (k) { state.data[k] = hit.data[k]; });
    pendingSwitch = null;
    $('#suggest').hidden = true;
    renderTypes(); renderFields(); syncQuick(); render();
    if (!SIMPLE[state.type]) $('#detailblock').scrollIntoView({ block: 'nearest' });
  }

  // Push state back into every control: on load, on preset apply, on link restore.
  function syncControls() {
    $$('.seg').forEach(function (seg) { markSeg(seg, state[seg.dataset.key]); });
    var pairs = [['#fg', 'fg'], ['#bg', 'bg'], ['#gradfrom', 'gradFrom'], ['#gradto', 'gradTo'],
      ['#eyecolor', 'eyeColor'], ['#framefill', 'frameFill'], ['#frametextcolor', 'frameTextColor']];
    pairs.forEach(function (p) {
      $(p[0]).value = state[p[1]];
      var out = $(p[0] + '-val') || $(p[0].replace('#', '#') + '-val');
      if (out) out.textContent = state[p[1]];
    });
    $('#fg-val').textContent = state.fg;
    $('#bg-val').textContent = state.bg;
    $('#gradfrom-val').textContent = state.gradFrom;
    $('#gradto-val').textContent = state.gradTo;
    $('#eyecolor-val').textContent = state.eyeColor;
    $('#framefill-val').textContent = state.frameFill;
    $('#frametextcolor-val').textContent = state.frameTextColor;

    $('#margin').value = state.margin;
    $('#margin-val').value = state.margin;
    $('#gradangle').value = state.gradAngle;
    $('#gradangle-val').value = state.gradAngle + '°';
    $('#logopct').value = Math.round(state.logoPct * 100);
    $('#logopct-val').value = Math.round(state.logoPct * 100) + '%';
    $('#gradon').checked = state.gradOn;
    $('#eyeon').checked = state.eyeOn;
    $('#frameon').checked = state.frameOn;
    $('#frametext').value = state.frameText;
    $('#distance').value = state.distanceCm;

    $('#gradopts').hidden = !state.gradOn;
    $('#eyeopts').hidden = !state.eyeOn;
    $('#frameopts').hidden = !state.frameOn;
    syncLogoUi();
    renderMarkVars();
    renderColourChips();
    syncQuick();
    $('#markcolor').value = state.markColor;
    $('#markcolor-val').textContent = state.markColor;
    $('#expiry').value = state.expiry;
    $('#expiryinlink').checked = state.expiryInLink;
    $('#expiryinfo').textContent = expiryLabel();
    $('#logoplate').checked = state.logoPlate;
    $('#plateopts').hidden = !state.logoPlate;
    $('#logoplatecolor').value = state.logoPlateColor;
    $('#logoplatecolor-val').value = state.logoPlateColor;
    ['source', 'medium', 'campaign', 'content'].forEach(function (k) {
      $('#utm_' + k).value = state.utm[k] || '';
    });
    $('#redirdest').value = state.redirectTo || '';
    $('#logopad').value = state.logoPad;
    $('#logopad-val').value = Number(state.logoPad).toFixed(1);
    syncSummaries();
  }

  // Swatches in the closed summaries, so the current colours are visible
  // without opening every group.
  function dot(c) {
    return '<span class="sumdot" aria-hidden="true" style="background:' + colour(c, '#000000') + '"></span>';
  }

  function syncSummaries() {
    $('#sum-colour').innerHTML = state.gradOn
      ? '<span class="sumdot" style="background:linear-gradient(120deg,' +
        colour(state.gradFrom, '#000000') + ',' + colour(state.gradTo, '#000000') + ')"></span>' + dot(state.bg)
      : dot(state.fg) + dot(state.bg);
    if (state.eyeOn) $('#sum-colour').innerHTML += dot(state.eyeColor);

    var m = R.MARKS[state.logoMark];
    $('#sum-mark').innerHTML = state.logoMode === 'none' ? ''
      : state.logoMode === 'custom' ? '<span class="sumtxt">your image</span>'
      : (m && m.fill === 'gradient'
          ? '<span class="sumdot" style="background:linear-gradient(120deg,#f58022,#ee2242)"></span>'
          : dot(m && m.fill === 'custom' ? state.markColor : (m ? m.fill : '#000')));

    $('#sum-frame').innerHTML = state.frameOn
      ? dot(state.frameFill) + dot(state.frameTextColor)
      : '';

    var n = daysUntil(state.expiry);
    $('#sum-expiry').innerHTML = n === null ? ''
      : '<span class="sumtxt' + (n < 0 ? ' bad' : '') + '">' +
        (n < 0 ? 'passed' : n + ' day' + (n === 1 ? '' : 's')) + '</span>';
  }

  // One radio holds tabindex 0 so Tab reaches the group once, then arrow keys
  // move inside it, which is what the radiogroup pattern expects.
  function markSeg(seg, value) {
    seg.querySelectorAll('button').forEach(function (b) {
      var on = b.dataset.val === value;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }

  function syncLogoUi() {
    $('#logo-opts').hidden = state.logoMode === 'none';
    $('#markrow').hidden = state.logoMode !== 'mark';
    $('#uploadrow').hidden = state.logoMode !== 'custom';
    $('#markcolorrow').hidden = !(state.logoMode === 'mark' && state.logoMark === 'tbbq-custom');
  }

  function forceEcH() {
    state.ec = 'H';
    markSeg($('.seg.ec'), 'H');
  }

  // ---- payload and options ------------------------------------------------

  function payload() {
    var out;
    try { out = R.payload[state.type](state.data) || ''; } catch (e) { return ''; }
    if (out && state.type === 'url') {
      var extra = [];
      ['source', 'medium', 'campaign', 'content'].forEach(function (k) {
        var v = (state.utm[k] || '').trim();
        if (v) extra.push('utm_' + k + '=' + encodeURIComponent(v));
      });
      // Only a link can carry a query parameter, and only your own server reads exp.
      if (state.expiryInLink && state.expiry) extra.push('exp=' + state.expiry);
      if (extra.length) out += (out.indexOf('?') === -1 ? '?' : '&') + extra.join('&');
    }
    return out;
  }

  // Whole days from today until the date, negative once it has passed.
  function daysUntil(iso) {
    if (!iso) return null;
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((d - today) / 86400000);
  }

  function expiryLabel() {
    var n = daysUntil(state.expiry);
    if (n === null) return 'No date set.';
    var when = new Date(state.expiry + 'T00:00:00')
      .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    if (n < 0) return when + '. Passed ' + (-n) + ' day' + (-n === 1 ? '' : 's') + ' ago.';
    if (n === 0) return when + '. That is today.';
    return when + '. ' + n + ' day' + (n === 1 ? '' : 's') + ' from now.';
  }

  function logoActive() {
    if (state.logoMode === 'mark') return true;
    return state.logoMode === 'custom' && !!state.logoHref;
  }

  // Render options from any style object: the live state, or a preset being
  // previewed as a thumbnail.
  function optsFrom(st, logoHref) {
    var markOn = st.logoMode === 'mark';
    var customOn = st.logoMode === 'custom' && !!logoHref;
    var on = markOn || customOn;
    return {
      ec: st.ec, style: st.style, eyeStyle: st.eyeStyle, margin: st.margin,
      fg: st.fg, bg: st.bg,
      fgGradient: st.gradOn ? { from: st.gradFrom, to: st.gradTo, angle: st.gradAngle } : null,
      eyeColor: st.eyeOn ? st.eyeColor : null,
      logoPct: on ? st.logoPct : 0,
      logoMark: markOn ? st.logoMark : null,
      markColor: st.markColor,
      logoPlate: on && st.logoPlate,
      logoPlateColor: st.logoPlateColor,
      logoPad: st.logoPad,
      logoHref: customOn ? logoHref : null,
      frame: st.frameOn
        ? { text: st.frameText, fill: st.frameFill, textColor: st.frameTextColor }
        : null
    };
  }

  function opts() { return optsFrom(state, state.logoHref); }

  // A preset only carries the keys it overrides, so fill the rest from defaults.
  function fullStyle(partial) {
    var base = styleOf(defaults());
    Object.keys(partial || {}).forEach(function (k) {
      if (partial[k] !== undefined) base[k] = partial[k];
    });
    return base;
  }

  // ---- rasterising --------------------------------------------------------

  var canvas = document.createElement('canvas');

  function rasterize(svgStr, w, h, bg) {
    return new Promise(function (res, rej) {
      var img = new Image();
      var url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
      img.onload = function () {
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = bg && bg !== 'transparent' ? bg : '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        res(ctx);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('render failed')); };
      img.src = url;
    });
  }

  // Decode a generated SVG. Resolves { ok, got, blocked }. `blocked` means the
  // pixels could not be read at all, because a file:// page taints the canvas.
  function decodeCheck(svgStr, text, o) {
    var w = Math.min(2400, Math.max(720, R.recommendedPx(text, o)));
    var h = Math.round(w * R.dimensions(text, o).ratio);
    return rasterize(svgStr, w, h, o.frame ? o.frame.fill : o.bg).then(function (ctx) {
      if (!window.jsQR) return { unavailable: true };
      var px;
      try { px = ctx.getImageData(0, 0, w, h).data; }
      catch (e) { return { blocked: true }; }
      var got = window.jsQR(px, w, h);
      return { ok: !!got && got.data === text, got: got ? got.data : null };
    });
  }

  // ---- undo and redo ------------------------------------------------------
  //
  // Snapshots hold the payload and the look. An uploaded image is left out on
  // purpose: a base64 data URI in every entry would cost megabytes, so undo
  // restores the design around an upload rather than the upload itself.

  // e.target is not always an Element: a key event dispatched at the document
  // has no closest(), which would throw inside a handler and kill it.
  function inTextField(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest('input:not([type="color"]):not([type="range"]), textarea');
  }

  function inFocusable(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest('input, textarea, select, button, a, summary, [role="button"], [contenteditable]');
  }

  var past = { stack: [], at: -1, muted: false, timer: 0 };
  var HISTORY_MAX = 60;

  function snapshot() {
    return JSON.stringify({
      t: state.type,
      d: state.data,
      s: styleOf(state),
      e: state.expiry,
      l: state.expiryInLink
    });
  }

  function markHistory() {
    var snap = snapshot();
    if (past.stack[past.at] === snap) return;
    past.stack = past.stack.slice(0, past.at + 1);
    past.stack.push(snap);
    if (past.stack.length > HISTORY_MAX) past.stack.shift();
    past.at = past.stack.length - 1;
    paintHistory();
  }

  // Called from render(), so a slider drag settles into one entry.
  function noteChange() {
    if (past.muted) return;
    clearTimeout(past.timer);
    past.timer = setTimeout(markHistory, 400);
  }

  function paintHistory() {
    $('#undo').disabled = past.at <= 0;
    $('#redo').disabled = past.at >= past.stack.length - 1;
  }

  function restore(snap) {
    var o;
    try { o = JSON.parse(snap); } catch (e) { return; }
    past.muted = true;
    if (FIELDS[o.t]) state.type = o.t;
    var data = sanitizeData(o.d);
    Object.keys(state.data).forEach(function (k) {
      if (data[k] !== undefined) state.data[k] = data[k];
    });
    var style = sanitizeStyle(o.s, state);
    STYLE_KEYS.forEach(function (k) {
      if (style[k] !== undefined) state[k] = style[k];
    });
    state.expiry = /^\d{4}-\d{2}-\d{2}$/.test(o.e) ? o.e : '';
    state.expiryInLink = o.l === true;
    renderTypes(); renderFields(); syncControls(); render();
    past.muted = false;
    paintHistory();
  }

  function undo() {
    clearTimeout(past.timer);
    markHistory();                      // capture anything still pending
    if (past.at <= 0) return;
    past.at--;
    restore(past.stack[past.at]);
  }

  function redo() {
    if (past.at >= past.stack.length - 1) return;
    past.at++;
    restore(past.stack[past.at]);
  }

  // ---- redirect page ------------------------------------------------------
  //
  // The honest version of a "dynamic" QR code without a server: the code points
  // at a page you host, and that page forwards. Edit the page, not the print.
  // It also makes the expiry date real, because the page can refuse to forward.

  function saveRedirect() {
    var dest = R.payload.url({ url: $('#redirdest').value });
    var note = $('#redirnote');
    if (!dest) {
      note.textContent = 'Give it a destination first.';
      note.classList.add('bad');
      return;
    }
    note.classList.remove('bad');
    var html = R.redirectPage(dest, state.expiry || null);
    saveBlob(new Blob([html], { type: 'text/html' }), 'redirect.html');
    note.textContent = 'Saved redirect.html. Put it at ' + (payload() || 'the address this code encodes') +
      ' and it forwards to ' + dest +
      (state.expiry ? ', until ' + state.expiry + '.' : '.');
  }

  // ---- reading an uploaded mark -------------------------------------------
  //
  // Samples the image to find the colour it is mostly made of, so the code can
  // be matched to a logo in one click, and to say whether the mark will vanish
  // into the current background.

  function inspectLogo(href) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        var n = 40;
        var cv = document.createElement('canvas');
        cv.width = cv.height = n;
        var ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, n, n);
        var px;
        try { px = ctx.getImageData(0, 0, n, n).data; }
        catch (e) { return res(null); }

        // Buckets of 32 per channel: enough to group a brand colour together
        // without merging two different ones.
        var bins = {}, lumSum = 0, seen = 0;
        for (var i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 128) continue;                 // ignore transparency
          var r = px[i], g = px[i + 1], b = px[i + 2];
          var key = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5);
          bins[key] = bins[key] || { n: 0, r: 0, g: 0, b: 0 };
          bins[key].n++; bins[key].r += r; bins[key].g += g; bins[key].b += b;
          lumSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
          seen++;
        }
        if (!seen) return res(null);

        var best = null;
        Object.keys(bins).forEach(function (k) {
          if (!best || bins[k].n > best.n) best = bins[k];
        });
        var hex = '#' + [best.r, best.g, best.b].map(function (sum) {
          return ('0' + Math.round(sum / best.n).toString(16)).slice(-2);
        }).join('');

        res({ colour: hex, luminance: lumSum / seen / 255, coverage: best.n / seen });
      };
      img.onerror = function () { res(null); };
      img.src = href;
    });
  }

  var logoInfo = null;

  function showLogoInfo() {
    var box = $('#logofound');
    if (!logoInfo) { box.hidden = true; return; }
    box.hidden = false;
    $('#logoswatch').style.background = logoInfo.colour;

    var behind = state.logoPlate ? state.logoPlateColor : state.bg;
    var visible = R.contrast(logoInfo.colour, behind);
    // What the code would measure if these modules took the logo's colour.
    var asModules = R.contrast(logoInfo.colour, state.bg);

    var text = 'Mostly ' + logoInfo.colour + '. ';
    text += visible < 1.6
      ? 'That is close to what sits behind it, so it will be hard to see. Try a plate.'
      : 'It stands out from the background.';

    var btn = $('#uselogocolour');
    if (asModules < 3) {
      // Say this before the click, not after the code stops scanning.
      text += ' Using it for the modules would give ' + asModules.toFixed(1) +
        ':1 against the background, under the 3:1 a camera needs.';
      btn.textContent = 'Match anyway';
      btn.classList.add('risky');
    } else {
      btn.textContent = 'Match the code to it';
      btn.classList.remove('risky');
    }
    $('#logofoundtext').textContent = text;
  }

  // ---- damage tolerance ---------------------------------------------------
  //
  // Paints damage onto the finished code and re-decodes, binary-searching for
  // the point where it stops reading. Two models, because they fail
  // differently: one patch is a sticker or a tear, scattered dropout is dirt
  // and print defects. Both are measured in fraction of the code's own area.

  var dmgCanvas = document.createElement('canvas');
  var NOMINAL = { L: 0.07, M: 0.15, Q: 0.25, H: 0.30 };

  // Fixed sequence, so a re-run on the same design gives the same answer.
  function seeded(seed) {
    var v = seed >>> 0;
    return function () {
      v = (v * 1664525 + 1013904223) >>> 0;
      return v / 4294967296;
    };
  }

  function damageFrame(svgStr, w, h, bg) {
    return new Promise(function (res, rej) {
      var img = new Image();
      var url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
      img.onload = function () {
        dmgCanvas.width = w; dmgCanvas.height = h;
        var ctx = dmgCanvas.getContext('2d');
        ctx.fillStyle = bg && bg !== 'transparent' ? bg : '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        res(ctx);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('render')); };
      img.src = url;
    });
  }

  // One square patch covering `frac` of the code area, kept off the three
  // finder patterns: covering a finder kills any code and measures nothing.
  function paintPatch(ctx, geo, frac) {
    var side = Math.sqrt(frac) * geo.codePx;
    var x = geo.originX + geo.codePx * 0.30 - side / 2;
    var y = geo.originY + geo.codePx * 0.58 - side / 2;
    ctx.fillStyle = '#808080';
    ctx.fillRect(x, y, side, side);
  }

  // Module-aligned dropout on data modules only. Finder, timing and alignment
  // modules are skipped: hitting one destroys grid detection at any correction
  // level, which would measure the wrong thing. The first version did hit them,
  // and reported 0% at level H while a single patch survived 21%.
  function paintScatter(ctx, geo, frac, seed) {
    var rnd = seeded(seed || 20260903);
    var pool = geo.dataModules;
    if (!pool.length) return;
    var hits = Math.min(pool.length, Math.round(geo.modules * geo.modules * frac));
    var taken = {};
    ctx.fillStyle = '#808080';
    var placed = 0, guard = 0;
    while (placed < hits && guard++ < pool.length * 8) {
      var i = Math.floor(rnd() * pool.length);
      if (taken[i]) continue;
      taken[i] = 1; placed++;
      ctx.fillRect(geo.originX + pool[i][1] * geo.modulePx,
        geo.originY + pool[i][0] * geo.modulePx, geo.modulePx, geo.modulePx);
    }
  }

  function damageTest() {
    var text = payload();
    if (!text) return Promise.resolve(null);
    var o = opts();
    if (R.utf8len(text) > R.MAX_BYTES[o.ec]) return Promise.resolve(null);

    var m = R.encode(text, o.ec);
    var dim = R.dimensions(text, o);
    var w = 660;                                  // enough to decode, quick to redraw
    var h = Math.round(w * dim.ratio);
    var svg = R.svg(text, Object.assign({}, o, { px: w }));
    var unit = w / dim.vbW;                       // px per module unit
    // Every module that carries data, so scatter can leave the function
    // patterns alone.
    var dataModules = [];
    for (var r = 0; r < m.size; r++) {
      for (var c = 0; c < m.size; c++) {
        if (!R.isFunctionModule(m.size, m.version, r, c)) dataModules.push([r, c]);
      }
    }

    var geo = {
      modules: m.size,
      modulePx: unit,
      codePx: m.size * unit,
      originX: (dim.qx + o.margin) * unit,
      originY: (dim.qy + o.margin) * unit,
      dataModules: dataModules
    };

    return damageFrame(svg, w, h, o.frame ? o.frame.fill : o.bg).then(function (ctx) {
      var pristine;
      try { pristine = ctx.getImageData(0, 0, w, h); }
      catch (e) { return { blocked: true }; }

      function reads(paint, frac, seed) {
        ctx.putImageData(pristine, 0, 0);
        paint(ctx, geo, frac, seed);
        var got = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
        return !!got && got.data === text;
      }

      // Binary search the largest fraction that still reads.
      function threshold(paint, seed) {
        if (!reads(paint, 0.02, seed)) return 0;
        var lo = 0.02, hi = 0.6;
        for (var i = 0; i < 7; i++) {
          var mid = (lo + hi) / 2;
          if (reads(paint, mid, seed)) lo = mid; else hi = mid;
        }
        return lo;
      }

      // Scatter is one random arrangement per seed, and a single sample swung
      // enough to put level Q above level H. Three seeds, median reported.
      var samples = [20260903, 761, 44017].map(function (seed) {
        return threshold(paintScatter, seed);
      }).sort(function (a, b) { return a - b; });

      var result = { patch: threshold(paintPatch), scatter: samples[1], ec: o.ec };
      ctx.putImageData(pristine, 0, 0);
      return result;
    });
  }

  function runDamage() {
    var out = $('#damageout');
    var btn = $('#damagerun');
    btn.disabled = true;
    out.innerHTML = '<p class="hint">Testing…</p>';

    damageTest().then(function (r) {
      btn.disabled = false;
      if (!r) {
        out.innerHTML = '<p class="hint">Nothing to test yet.</p>';
        return;
      }
      if (r.blocked) {
        out.innerHTML = '<p class="hint">Needs a local server: reading pixels back is blocked on file:// URLs.</p>';
        return;
      }
      var nominal = NOMINAL[r.ec];
      var row = function (label, frac, note) {
        var pct = Math.round(frac * 100);
        return '<div class="dmgrow">' +
          '<span class="dmglabel">' + label + '<span class="what">' + note + '</span></span>' +
          '<span class="dmgbar"><span style="width:' + Math.min(100, pct * 2) + '%"></span></span>' +
          '<b>' + pct + '%</b></div>';
      };
      out.innerHTML =
        row('One covered patch', r.patch, 'a sticker or a tear over the data') +
        row('Scattered dropout', r.scatter, 'dirt or missing ink, median of three') +
        '<p class="hint">Level ' + r.ec + ' is quoted at ' + Math.round(nominal * 100) +
        '% of <em>codewords</em>, which is not the same as covered area: a patch wipes ' +
        'out every codeword beneath it, and scattered loss touches more codewords for ' +
        'the same area, so it always scores lower. Both figures are what a strict ' +
        'decoder could still read here, so treat them as a floor. Finder and timing ' +
        'patterns are left alone, because covering one kills any code regardless of ' +
        'correction level.</p>';
    }).catch(function () {
      btn.disabled = false;
      out.innerHTML = '<p class="hint">The test could not run.</p>';
    });
  }

  // ---- compare every shape combination ------------------------------------
  //
  // Nine looks on the current content and colours, each decoded. Rendering is
  // gated on the group being open: nine encodes and nine decodes per keystroke
  // would be wasted work while it is closed.

  var SHAPE_LABEL = {
    square: 'Square', rounded: 'Rounded', dots: 'Dots', circle: 'Circle'
  };
  var compareRun = 0;

  function compareCombos() {
    var out = [];
    ['square', 'rounded', 'dots'].forEach(function (st) {
      ['square', 'rounded', 'circle'].forEach(function (ey) {
        out.push({ st: st, ey: ey });
      });
    });
    return out;
  }

  function renderCompare() {
    var group = $('#comparegroup');
    if (!group || !group.open) return;
    var grid = $('#comparegrid');
    var text = payload();
    var my = ++compareRun;

    if (!text) {
      grid.innerHTML = '<p class="hint">Add some content first.</p>';
      return;
    }
    if (R.utf8len(text) > R.MAX_BYTES[state.ec]) {
      grid.innerHTML = '<p class="hint">Too much data to compare at this correction level.</p>';
      return;
    }

    var combos = compareCombos();
    grid.innerHTML = combos.map(function (c, i) {
      var on = c.st === state.style && c.ey === state.eyeStyle;
      var thumb = R.svg(text, Object.assign({}, opts(), { style: c.st, eyeStyle: c.ey, px: 108 }));
      return '<button type="button" class="ccell' + (on ? ' on' : '') + '"' +
        ' data-st="' + c.st + '" data-ey="' + c.ey + '"' +
        ' aria-pressed="' + on + '">' +
        '<span class="cthumb" aria-hidden="true">' + thumb + '</span>' +
        '<span class="cname">' + SHAPE_LABEL[c.st] + ' &middot; ' + SHAPE_LABEL[c.ey] + '</span>' +
        '<span class="cverdict" data-i="' + i + '">checking</span>' +
        '</button>';
    }).join('');

    // Decode one at a time so the grid stays responsive.
    var i = 0;
    (function step() {
      if (my !== compareRun || i >= combos.length) return;
      var c = combos[i];
      var o = Object.assign({}, opts(), { style: c.st, eyeStyle: c.ey });
      decodeCheck(R.svg(text, Object.assign({}, o, { px: 1024 })), text, o)
        .then(function (res) {
          if (my !== compareRun) return;
          var el = grid.querySelector('.cverdict[data-i="' + i + '"]');
          if (el) {
            var unknown = res.blocked || res.unavailable;
            el.textContent = res.ok ? 'scans' : unknown ? 'unchecked' : 'fails';
            el.className = 'cverdict ' + (res.ok ? 'ok' : unknown ? 'unknown' : 'bad');
          }
          i++;
          setTimeout(step, 0);
        })
        .catch(function () { i++; setTimeout(step, 0); });
    })();
  }

  var compareTimer = 0;

  function noteCompare() {
    clearTimeout(compareTimer);
    compareTimer = setTimeout(renderCompare, 450);
  }

  // ---- design tab render --------------------------------------------------

  var token = 0;
  var lastSvg = '';
  var lastPngUrl = '';

  var recentTimer = 0;

  function render() {
    var text = payload();
    var my = ++token;
    clearTimeout(recentTimer);
    recentTimer = setTimeout(pushRecent, 2500);
    noteChange();
    noteCompare();
    var bytes = R.utf8len(text);
    var max = R.MAX_BYTES[state.ec];

    if (!text) {
      setVerdict('#verdict', 'warn', 'Nothing to encode', 'Type or paste something in the field above.');
      $('#raw').value = ''; setSpec(null, 0, max); setNotices([]);
      return;
    }
    if (bytes > max) {
      setVerdict('#verdict', 'crit', 'Too much data',
        bytes + ' bytes is over the ' + max + '-byte limit at error correction ' + state.ec +
        '. Shorten the content, or drop to a lower correction level.');
      $('#raw').value = text; setSpec(null, bytes, max); setNotices([]);
      return;
    }

    $('#raw').value = text;
    var o = opts();
    var m = R.encode(text, state.ec);
    lastSvg = R.svg(text, Object.assign({}, o, { px: 1024 }));
    setSpec(m, bytes, max);
    setNotices(collectNotices(m, bytes, max));
    setVerdict('#verdict', '', 'Checking…', 'Decoding the image.');

    var w = Math.min(2400, Math.max(720, R.recommendedPx(text, o)));
    var h = Math.round(w * R.dimensions(text, o).ratio);

    rasterize(lastSvg, w, h, o.frame ? o.frame.fill : o.bg).then(function (ctx) {
      if (my !== token) return;
      lastPngUrl = canvas.toDataURL('image/png');
      var img = $('#preview');
      img.src = lastPngUrl;
      img.alt = 'QR code encoding: ' + text.slice(0, 80);

      if (!window.jsQR) {
        setVerdict('#verdict', 'warn', 'Scan check unavailable',
          'The decoder did not load, so this code has not been verified.');
        return;
      }
      var px;
      try { px = ctx.getImageData(0, 0, w, h).data; }
      catch (e) {
        setVerdict('#verdict', 'warn', 'Scan check needs a local server',
          'Browsers block reading pixels back on file:// URLs. Run npm start and open http://127.0.0.1:8777. The code itself is fine.');
        return;
      }
      var got = window.jsQR(px, w, h);
      if (got && got.data === text) setVerdict('#verdict', 'ok', 'Scans correctly', got.data);
      else if (got) setVerdict('#verdict', 'crit', 'Decoded to the wrong value', got.data);
      else setVerdict('#verdict', 'crit', 'Could not be read back',
        'jsQR could not read this image. Raise the error correction level, widen the quiet zone, add contrast, or shrink the centre mark.');
    }).catch(function () {
      if (my !== token) return;
      setVerdict('#verdict', 'crit', 'Render failed', 'The browser could not draw the image.');
    });
  }

  function setVerdict(sel, stateName, headline, echo) {
    var el = $(sel);
    el.dataset.state = stateName || '';
    el.innerHTML = '<div class="headline"><span class="dot" aria-hidden="true"></span>' + esc(headline) + '</div>' +
      '<div class="echo">' + esc(echo) + '</div>';
  }

  // ---- readout ------------------------------------------------------------

  var EC_RECOVERY = { L: '7%', M: '15%', Q: '25%', H: '30%' };

  function setSpec(m, bytes, max) {
    var total = m ? m.size + state.margin * 2 : 0;
    var widthMm = total * MM_PER_MODULE;
    var exp = daysUntil(state.expiry);

    // Both numbers are widths in millimetres, sat next to each other so the
    // relationship between size and reading distance is visible.
    $('#s-print').textContent = m ? Math.ceil(widthMm) + ' mm' : '–';
    var needMm = m ? (state.distanceCm * 10) / DISTANCE_RATIO : 0;
    $('#s-need').textContent = m ? Math.ceil(needMm) + ' mm' : '–';

    $('#s-grid').textContent = m ? m.size + ' × ' + m.size + ' squares' : '–';
    $('#s-border').textContent = state.margin + ' square' + (state.margin === 1 ? '' : 's');
    $('#s-damage').textContent = EC_RECOVERY[state.ec] + ' (level ' + state.ec + ')';
    $('#s-expiry').textContent = state.expiry ? expiryLabel() : '–';
    $('#expiryinfo').textContent = expiryLabel();

    var pct = max ? Math.min(100, bytes / max * 100) : 0;
    $('#cap').dataset.level = pct > 100 ? 'crit' : pct > 85 ? 'warn' : 'ok';
    $('#cap-fill').style.width = pct.toFixed(1) + '%';
    $('#cap-lab-a').textContent = 'Room used: ' + Math.round(pct) + '%';
    $('#cap-lab-b').textContent = bytes + ' of ' + max + ' bytes';

    // The summary line reads as a sentence rather than a spec dump.
    $('#readline').innerHTML = m
      ? 'Print it <b>' + Math.ceil(widthMm) + ' mm</b> or wider · ' +
        m.size + '×' + m.size + ' squares · ' + Math.round(pct) + '% full' +
        (exp === null ? '' : ' · <b' + (exp < 0 ? ' class="bad"' : '') + '>' +
          (exp < 0 ? 'expired' : exp + ' days left') + '</b>')
      : '–';
  }

  // ---- warnings -----------------------------------------------------------

  function collectNotices(m, bytes, max) {
    var out = [];
    var grad = state.gradOn ? { from: state.gradFrom, to: state.gradTo } : null;
    var worst = R.worstContrast(state.fg, state.bg, grad);

    if (worst.ratio < 2.5) {
      out.push(['crit', 'Not enough contrast',
        (grad ? 'The weakest gradient stop (' + worst.colour + ') is ' : 'Foreground and background differ by only ') +
        worst.ratio.toFixed(1) + ':1. Cameras need at least 3:1.']);
    } else if (worst.ratio < 4) {
      out.push(['warn', 'Contrast is marginal',
        (grad ? worst.colour + ' sits at ' : '') + worst.ratio.toFixed(1) +
        ':1 against the background. Paper and poor light need more.']);
    }

    var darkest = grad
      ? Math.max(R.contrast(grad.from, '#ffffff'), R.contrast(grad.to, '#ffffff'))
      : R.contrast(state.fg, '#ffffff');
    if (darkest <= R.contrast(state.bg, '#ffffff')) {
      out.push(['warn', 'Light code on a dark ground',
        'Some older scanners only look for dark modules. Test before printing.']);
    }

    if (state.margin < 4) {
      out.push(['warn', 'Quiet zone below spec',
        'The standard asks for 4 clear modules around the code. This has ' + state.margin + '.']);
    }

    if (logoActive()) {
      if (state.ec !== 'H' && state.logoPct >= 0.18) {
        out.push(['warn', 'Raise correction for the mark',
          'The mark covers real data. At ' + Math.round(state.logoPct * 100) +
          '% width, use error correction H so the code can rebuild it.']);
      }
      if (state.logoPct > 0.3) {
        out.push(['crit', 'Mark is too large',
          'Above about 30% width the code loses more data than even level H can recover.']);
      }
    }

    if (state.frameOn && R.contrast(state.frameTextColor, state.frameFill) < 3) {
      out.push(['warn', 'Caption is hard to read',
        'The caption and frame colours sit too close together.']);
    }

    if (state.type !== 'url' && R.hasNonAscii(payload())) {
      out.push(['warn', 'Non-ASCII text may not travel',
        'The encoder writes accented and non-Latin characters as raw UTF-8 with no encoding marker. Phone cameras cope. Some fixed scanners do not.']);
    }

    var expDays = daysUntil(state.expiry);
    if (expDays !== null && expDays < 0) {
      out.push(['crit', 'The valid-until date has passed',
        'Printed copies still scan and still reach the destination. Turn the link off at your end, or reprint.']);
    } else if (expDays !== null && expDays <= 14) {
      out.push(['warn', 'Expires soon',
        expDays === 0 ? 'The date you set is today.' : expDays + ' days left. Plan the reprint.']);
    }

    if (bytes / max > 0.85) {
      out.push(['warn', 'Nearly full',
        'The code is near its byte limit, so the grid is dense. Print it larger than usual.']);
    }
    return out;
  }

  function setNotices(list) {
    $('#notices').innerHTML = list.map(function (nt) {
      return '<div class="notice ' + nt[0] + '"><span class="dot" aria-hidden="true"></span><b>' +
        esc(nt[1]) + '</b><span>' + esc(nt[2]) + '</span></div>';
    }).join('');
  }

  // ---- exports ------------------------------------------------------------

  function filename(ext) {
    return 'qr-' + state.type + '-' + new Date().toISOString().slice(0, 10) + '.' + ext;
  }

  function flash(sel, msg) {
    var b = $(sel), old = b.dataset.label || b.textContent;
    b.dataset.label = old;
    b.textContent = msg;
    setTimeout(function () { b.textContent = b.dataset.label; }, 1400);
  }

  function saveFile(href, name) {
    var a = document.createElement('a');
    a.href = href; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    saveFile(url, name);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function copyPng() {
    if (!lastPngUrl) return;
    fetch(lastPngUrl).then(function (r) { return r.blob(); }).then(function (b) {
      return navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
    }).then(function () { flash('#copy-png', 'Copied'); })
      .catch(function () { flash('#copy-png', 'Blocked by browser'); });
  }

  function copySvg() {
    if (!lastSvg) return;
    navigator.clipboard.writeText(lastSvg)
      .then(function () { flash('#copy-svg', 'Copied'); })
      .catch(function () { flash('#copy-svg', 'Blocked by browser'); });
  }

  // ---- print sheet --------------------------------------------------------

  // Rather than write a PDF by hand, hand the browser a correctly-sized print
  // document: it renders the SVG as vector and "Save as PDF" is one dialog away.
  function openPrintSheet(items) {
    var mm = Math.min(400, Math.max(5, Number($('#printmm').value) || 40));
    var note = $('#printnote');

    var win = window.open('', '_blank');
    if (!win) {
      note.textContent = 'Your browser blocked the print window. Allow pop-ups for this page, then try again.';
      note.classList.add('bad');
      return;
    }
    note.classList.remove('bad');
    note.textContent = items.length + ' code' + (items.length === 1 ? '' : 's') +
      ' at ' + mm + ' mm opened in the print view.';

    var cells = items.map(function (it) {
      return '<figure style="width:' + mm + 'mm">' + it.svg +
        (it.label ? '<figcaption>' + esc(it.label) + '</figcaption>' : '') + '</figure>';
    }).join('');

    var doc = '<!doctype html><html><head><meta charset="utf-8">' +
      '<title>Quiet Zone print sheet</title><style>' +
      '@page { size: A4; margin: 10mm }' +
      'body { margin: 0; font: 500 8pt Inter, Helvetica, Arial, sans-serif; color: #000;' +
      '  background: #fff }' +
      '.sheet { display: flex; flex-wrap: wrap; gap: 8mm; align-content: flex-start }' +
      'figure { margin: 0; break-inside: avoid; page-break-inside: avoid;' +
      '  padding: 2mm; outline: 0.2mm dashed #bbb; outline-offset: 1mm }' +
      'figure svg { display: block; width: 100%; height: auto }' +
      'figcaption { margin-top: 1.5mm; text-align: center; font-size: 7pt;' +
      '  overflow-wrap: anywhere }' +
      '.note { font-size: 8pt; color: #555; margin: 0 0 5mm }' +
      '@media print { .note { display: none } }' +
      '</style></head><body>' +
      '<p class="note">' + items.length + ' code' + (items.length === 1 ? '' : 's') +
      ' at ' + mm + ' mm. Dashed lines are cut guides. Print at 100% scale. ' +
      'A "fit to page" setting changes the physical size, and the scanning distance with it.</p>' +
      '<div class="sheet">' + cells + '</div></body></html>';

    win.document.write(doc);
    win.document.close();
    try { win.opener = null; } catch (e) { /* some browsers make it read-only */ }
    win.focus();
    // Give the document a beat to lay out before the dialog measures it.
    setTimeout(function () { win.print(); }, 400);
  }

  function printCurrent() {
    var text = payload();
    if (!text) return;
    var count = Math.min(200, Math.max(1, Number($('#printcount').value) || 12));
    var svg = R.svg(text, Object.assign({}, opts(), { px: 1024 }));
    var items = [];
    for (var i = 0; i < count; i++) items.push({ svg: svg, label: '' });
    openPrintSheet(items);
  }

  // ---- batch --------------------------------------------------------------

  var batchResults = [];

  // Batch input is parsed once into rows, then a column mapping decides what
  // gets encoded, what is shown, and what names the file. A pasted one-per-line
  // list still needs no configuration: it is simply a single-column table.

  var batchTable = { header: null, rows: [] };

  var HEADER_WORDS = /^(url|link|value|code|data|destination|target|name|label|title|email|phone|id|file|filename|ref|slug)$/i;

  // A first row is a header when it names things rather than containing them.
  function looksLikeHeader(rows) {
    if (rows.length < 2) return false;
    var first = rows[0];
    if (first.some(function (c) { return HEADER_WORDS.test(c); })) return true;
    var carries = function (row) {
      return row.some(function (c) {
        var d = R.detect(c);
        return d && d.type !== 'text';
      });
    };
    return !carries(first) && carries(rows[1]);
  }

  function readTable(raw) {
    var rows = QRCsv.parse(raw);
    if (!rows.length) return { header: null, rows: [] };
    if (looksLikeHeader(rows)) return { header: rows[0], rows: rows.slice(1) };
    return { header: null, rows: rows };
  }

  function columnNames(t) {
    var width = t.rows.reduce(function (n, r) { return Math.max(n, r.length); },
      t.header ? t.header.length : 1);
    var out = [];
    for (var i = 0; i < width; i++) {
      out.push(t.header && t.header[i] ? t.header[i] : 'Column ' + (i + 1));
    }
    return out;
  }

  // Guesses that are right most of the time: the column that parses as a link
  // gets encoded, a name-ish column becomes the label.
  function guessMapping(t) {
    var names = columnNames(t);
    var sample = t.rows[0] || [];
    var value = 0;
    for (var i = 0; i < names.length; i++) {
      var d = R.detect(sample[i]);
      if (d && d.type !== 'text') { value = i; break; }
      if (/^(url|link|value|code|data|destination|target)$/i.test(names[i])) { value = i; break; }
    }
    var label = value;
    for (var j = 0; j < names.length; j++) {
      if (j === value) continue;
      if (/^(name|label|title|id|ref|slug|file|filename)$/i.test(names[j])) { label = j; break; }
      if (label === value) label = j;
    }
    return { value: value, label: label, file: label };
  }

  function currentMapping() {
    var pick = function (sel, fallback) {
      var el = $(sel);
      return el && el.value !== '' ? +el.value : fallback;
    };
    var g = guessMapping(batchTable);
    return { value: pick('#map-value', g.value), label: pick('#map-label', g.label), file: pick('#map-file', g.file) };
  }

  function renderMapping() {
    var box = $('#colmap');
    var names = columnNames(batchTable);
    if (!batchTable.rows.length || names.length < 2) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    var g = guessMapping(batchTable);
    [['#map-value', g.value], ['#map-label', g.label], ['#map-file', g.file]].forEach(function (pair) {
      var el = $(pair[0]);
      var keep = el.value !== '' && +el.value < names.length ? +el.value : pair[1];
      el.innerHTML = names.map(function (n, i) {
        return '<option value="' + i + '"' + (i === keep ? ' selected' : '') + '>' + esc(n) + '</option>';
      }).join('');
    });
    previewMapping();
  }

  function previewMapping() {
    var rows = resolveBatch();
    var el = $('#mappreview');
    if (!rows.length) { el.textContent = ''; return; }
    var first = rows[0];
    el.textContent = rows.length + ' row' + (rows.length === 1 ? '' : 's') +
      '. First one encodes "' + first.value + '", shows as "' + (first.label || first.value) +
      '", saves as ' + slug(first.file || first.value, 1) + '.svg';
  }

  function resolveBatch() {
    var map = currentMapping();
    return batchTable.rows.map(function (r) {
      return {
        value: (r[map.value] || '').trim(),
        label: (r[map.label] || '').trim(),
        file: (r[map.file] || '').trim()
      };
    }).filter(function (x) { return x.value; });
  }

  function slug(s, i) {
    var fold = { 'æ': 'ae', 'ø': 'oe', 'å': 'aa', 'ß': 'ss' };
    return (String(s || '').trim().toLowerCase()
      .replace(/[æøåß]/g, function (c) { return fold[c]; })
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'code-' + i).slice(0, 60);
  }

  function runBatch() {
    batchTable = readTable($('#batchin').value);
    renderMapping();
    var rows = resolveBatch();
    if (!rows.length) {
      $('#batchsummary').textContent = 'Nothing to generate. Add at least one line.';
      $('#batchgrid').innerHTML = '';
      return;
    }
    if (rows.length > 300) rows = rows.slice(0, 300);

    var o = opts();
    var grid = $('#batchgrid');
    grid.innerHTML = '';
    batchResults = [];
    $('#batchzip').disabled = true;
    $('#batchprint').disabled = true;
    $('#batchsummary').textContent = 'Generating ' + rows.length + ' codes…';

    var i = 0, ok = 0, bad = 0;

    function step() {
      if (i >= rows.length) {
        $('#batchsummary').innerHTML = '<b>' + ok + ' verified</b>' +
          (bad ? ' · <span class="bad">' + bad + ' failed</span>' : '') +
          ' · ' + rows.length + ' total';
        $('#batchzip').disabled = batchResults.length === 0;
        $('#batchprint').disabled = batchResults.length === 0;
        return;
      }
      var row = rows[i];
      var text = state.type === 'url' ? R.payload.url({ url: row.value }) : row.value;
      var cell = document.createElement('div');
      cell.className = 'bcell';
      grid.appendChild(cell);

      var bytes = R.utf8len(text);
      if (bytes > R.MAX_BYTES[o.ec]) {
        bad++;
        cell.className = 'bcell bad';
        cell.innerHTML = '<div class="bthumb"></div><div class="blab"><b>Too long</b>' +
          esc(row.label || row.value) + '</div>';
        i++; return step();
      }

      var svg = R.svg(text, Object.assign({}, o, { px: 1024 }));
      decodeCheck(svg, text, o).then(function (res) {
        var good = res.ok || res.blocked || res.unavailable;
        if (res.ok) ok++; else if (!res.blocked && !res.unavailable) bad++;
        cell.className = 'bcell' + (res.ok ? '' : res.blocked || res.unavailable ? ' unknown' : ' bad');
        cell.innerHTML = '<div class="bthumb" aria-hidden="true">' +
          R.svg(text, Object.assign({}, o, { px: 120 })) + '</div>' +
          '<div class="blab"><b>' + (res.ok ? 'Verified' : res.blocked ? 'Unchecked' : 'Failed') +
          '</b>' + esc(row.label || row.value) + '</div>';
        if (good) {
          batchResults.push({
            name: slug(row.file || row.label || row.value, batchResults.length + 1) + '.svg',
            svg: svg, label: row.label || row.value
          });
        }
        i++;
        setTimeout(step, 0);   // yield so the grid paints as it goes
      });
    }
    step();
  }

  function downloadZip() {
    if (!batchResults.length) return;
    var files = batchResults.map(function (r) { return { name: r.name, data: r.svg }; });
    files.push({
      name: 'README.txt',
      data: 'Generated by Quiet Zone.\n' + files.length + ' codes, each decoded and verified ' +
        'before export.\nSVG is vector, so it scales to any print size.\n'
    });
    var bytes = QRZip.zip(files);
    saveBlob(new Blob([bytes], { type: 'application/zip' }),
      'qr-codes-' + new Date().toISOString().slice(0, 10) + '.zip');
  }

  // ---- camera test --------------------------------------------------------

  var stream = null, camRaf = 0;
  var camCanvas = document.createElement('canvas');

  function camStart() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVerdict('#camverdict', 'crit', 'No camera API',
        'This browser gives the page no camera to use.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(function (s) {
        stream = s;
        var v = $('#cam');
        v.srcObject = s;
        return v.play();
      })
      .then(function () {
        $('#camidle').hidden = true;
        $('#camstart').disabled = true;
        $('#camstop').disabled = false;
        setVerdict('#camverdict', '', 'Looking…', 'Hold a code up to the camera.');
        camLoop();
      })
      .catch(function (e) {
        var denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
        setVerdict('#camverdict', 'crit',
          denied ? 'Camera permission denied' : 'Camera unavailable',
          denied
            ? 'Allow camera access for this page, then press Start again. Access also requires localhost or HTTPS.'
            : (e && e.message) || 'The camera could not be opened.');
      });
  }

  function camLoop() {
    var v = $('#cam');
    if (!stream) return;
    if (v.readyState === v.HAVE_ENOUGH_DATA && window.jsQR) {
      var w = Math.min(640, v.videoWidth || 640);
      var h = Math.round(w * ((v.videoHeight || 480) / (v.videoWidth || 640)));
      camCanvas.width = w; camCanvas.height = h;
      var ctx = camCanvas.getContext('2d');
      ctx.drawImage(v, 0, 0, w, h);
      try {
        var got = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
        if (got) setVerdict('#camverdict', 'ok', 'Read from camera', got.data);
      } catch (e) { /* frame not ready */ }
    }
    camRaf = requestAnimationFrame(camLoop);
  }

  function camStop() {
    cancelAnimationFrame(camRaf);
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null;
    $('#cam').srcObject = null;
    $('#camidle').hidden = false;
    $('#camstart').disabled = false;
    $('#camstop').disabled = true;
    setVerdict('#camverdict', '', 'Camera off', 'Press Start camera to test a printed code.');
  }

  // ---- tabs ---------------------------------------------------------------

  function showTab(name) {
    ['design', 'batch', 'test'].forEach(function (t) {
      var btn = $('#tabbtn-' + t);
      var sel = t === name;
      btn.setAttribute('aria-selected', String(sel));
      btn.tabIndex = sel ? 0 : -1;
      $('#tab-' + t).hidden = !sel;
    });
    if (name !== 'test' && stream) camStop();
  }

  // ---- wiring -------------------------------------------------------------

  function bind() {
    // tabs, with arrow-key navigation as the ARIA pattern expects
    $('.tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]');
      if (b) showTab(b.dataset.tab);
    });
    $('.tabs').addEventListener('keydown', function (e) {
      var order = ['design', 'batch', 'test'];
      var cur = order.indexOf($('.tabs [aria-selected="true"]').dataset.tab);
      var next = e.key === 'ArrowRight' ? cur + 1 : e.key === 'ArrowLeft' ? cur - 1
        : e.key === 'Home' ? 0 : e.key === 'End' ? order.length - 1 : -1;
      if (next < 0 || next > order.length - 1) return;
      e.preventDefault();
      showTab(order[next]);
      $('#tabbtn-' + order[next]).focus();
    });

    // ---- omnibox ----
    var quick = $('#quick');
    quick.addEventListener('input', function (e) {
      var v = e.target.value;
      if (SIMPLE[state.type]) {
        state.data[SIMPLE[state.type]] = v;
        render();
      }
      offerSwitch(v);
    });
    quick.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (pendingSwitch) applySwitch(); else copyPng();
      }
      if (e.key === 'Escape') { $('#suggest').hidden = true; pendingSwitch = null; }
    });

    $('#suggest').addEventListener('click', function (e) {
      if (e.target.id === 'dosuggest') applySwitch();
      if (e.target.id === 'nosuggest') { $('#suggest').hidden = true; pendingSwitch = null; }
    });

    // Reading the clipboard needs permission and can be refused; fall back to focus.
    $('#quickpaste').addEventListener('click', function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        quick.focus(); flash('#quickpaste', 'Press Cmd+V');
        return;
      }
      navigator.clipboard.readText().then(function (t) {
        if (!t) { quick.focus(); return; }
        quick.value = t.trim();
        quick.dispatchEvent(new Event('input'));
        if (pendingSwitch) applySwitch();
      }).catch(function () { quick.focus(); flash('#quickpaste', 'Press Cmd+V'); });
    });

    // ---- one-click colour pairs ----
    $('#colorchips').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-chip]');
      if (!b) return;
      var c = COLOUR_CHIPS[+b.dataset.chip];
      ['fg', 'bg', 'gradOn', 'gradFrom', 'gradTo', 'gradAngle'].forEach(function (k) {
        if (c[k] !== undefined) state[k] = c[k];
      });
      syncControls(); render();
    });

    // ---- real-world print sizes ----
    $('#printchips').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-print]');
      if (!b) return;
      var c = PRINT_CHIPS[+b.dataset.print];
      $('#printmm').value = c.mm;
      // The 10x-width rule: a code scans from about ten times its own width,
      // so a 40 mm code reads at roughly 40 cm.
      state.distanceCm = c.mm;
      $('#distance').value = state.distanceCm;
      $$('#printchips button').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      render();
    });

    // ---- recents ----
    $('#recents').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-recent]');
      if (!b) return;
      var r = recents()[+b.dataset.recent];
      if (!r) return;
      state.type = r.type;
      Object.keys(r.data || {}).forEach(function (k) { state.data[k] = r.data[k]; });
      if (r.style) STYLE_KEYS.forEach(function (k) {
        if (r.style[k] !== undefined) state[k] = r.style[k];
      });
      renderTypes(); renderFields(); syncControls(); render();
    });

    $('#types').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-type]');
      if (!b) return;
      state.type = b.dataset.type;
      $('#suggest').hidden = true; pendingSwitch = null;
      renderTypes(); renderFields(); syncQuick(); render();
    });

    ['input', 'change'].forEach(function (ev) {
      $('#fields').addEventListener(ev, function (e) {
        var k = e.target.dataset.k;
        if (!k) return;
        state.data[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        if (SIMPLE[state.type] && k === SIMPLE[state.type]) $('#quick').value = e.target.value;
        render();
      });
    });

    // segmented controls: click plus arrow keys
    $$('.seg').forEach(function (seg) {
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-val]');
        if (b) pickSeg(seg, b);
      });
      seg.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var btns = Array.prototype.slice.call(seg.querySelectorAll('button'));
        var i = btns.indexOf(document.activeElement);
        if (i < 0) return;
        e.preventDefault();
        var b = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length];
        b.focus(); pickSeg(seg, b);
      });
    });

    function pickSeg(seg, b) {
      state[seg.dataset.key] = b.dataset.val;
      markSeg(seg, b.dataset.val);
      if (seg.dataset.key === 'logoMode') {
        syncLogoUi();
        if (state.logoMode !== 'none') forceEcH();
      }
      render();
    }

    // colours
    [['#fg', 'fg'], ['#bg', 'bg'], ['#gradfrom', 'gradFrom'], ['#gradto', 'gradTo'],
     ['#eyecolor', 'eyeColor'], ['#framefill', 'frameFill'], ['#frametextcolor', 'frameTextColor'],
     ['#markcolor', 'markColor']
    ].forEach(function (pair) {
      var picker = $(pair[0]), hex = $(pair[0] + '-val'), key = pair[1];

      picker.addEventListener('input', function (e) {
        state[key] = colour(e.target.value, state[key]);
        hex.value = state[key];
        syncSummaries(); render();
      });

      // Typing a hex is how brand values actually arrive. Anything invalid is
      // left alone until it parses, so the field never fights the typist.
      hex.addEventListener('input', function (e) {
        var v = e.target.value.trim();
        if (v && v[0] !== '#') { v = '#' + v; e.target.value = v; }
        var c = colour(v, null);
        if (!c) return;
        state[key] = c;
        picker.value = c;
        syncSummaries(); render();
      });
      hex.addEventListener('blur', function () { hex.value = state[key]; });
    });

    // toggles
    [['#gradon', 'gradOn', '#gradopts'], ['#eyeon', 'eyeOn', '#eyeopts'],
     ['#frameon', 'frameOn', '#frameopts']].forEach(function (t) {
      $(t[0]).addEventListener('change', function (e) {
        state[t[1]] = e.target.checked;
        $(t[2]).hidden = !e.target.checked;
        syncSummaries(); render();
      });
    });

    $('#frametext').addEventListener('input', function (e) {
      state.frameText = e.target.value; render();
    });
    $('#margin').addEventListener('input', function (e) {
      state.margin = +e.target.value; $('#margin-val').value = state.margin; render();
    });
    $('#gradangle').addEventListener('input', function (e) {
      state.gradAngle = +e.target.value; $('#gradangle-val').value = state.gradAngle + '°'; render();
    });
    $('#logopct').addEventListener('input', function (e) {
      state.logoPct = +e.target.value / 100;
      $('#logopct-val').value = e.target.value + '%';
      render();
    });
    $('#distance').addEventListener('input', function (e) {
      state.distanceCm = Math.max(1, +e.target.value || 1); render();
    });

    $('#markvars').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-mark]');
      if (!b) return;
      state.logoMark = b.dataset.mark;
      renderMarkVars(); syncLogoUi(); syncSummaries(); render();
    });

    ['source', 'medium', 'campaign', 'content'].forEach(function (k) {
      $('#utm_' + k).addEventListener('input', function (e) {
        state.utm[k] = e.target.value;
        render();
      });
    });
    $('#redirdest').addEventListener('input', function (e) { state.redirectTo = e.target.value; });
    $('#redirsave').addEventListener('click', saveRedirect);

    $('#uselogocolour').addEventListener('click', function () {
      if (!logoInfo) return;
      state.fg = logoInfo.colour;
      state.gradOn = false;
      syncControls(); render(); showLogoInfo();
    });

    $('#logoplate').addEventListener('change', function (e) {
      state.logoPlate = e.target.checked;
      $('#plateopts').hidden = !e.target.checked;
      showLogoInfo(); syncSummaries(); render();
    });
    $('#logoplatecolor').addEventListener('input', function (e) {
      state.logoPlateColor = colour(e.target.value, state.logoPlateColor);
      $('#logoplatecolor-val').value = state.logoPlateColor;
      showLogoInfo(); render();
    });
    $('#logoplatecolor-val').addEventListener('input', function (e) {
      var v = e.target.value.trim();
      if (v && v[0] !== '#') { v = '#' + v; e.target.value = v; }
      var c = colour(v, null);
      if (!c) return;
      state.logoPlateColor = c;
      $('#logoplatecolor').value = c;
      showLogoInfo(); render();
    });
    $('#logopad').addEventListener('input', function (e) {
      state.logoPad = +e.target.value;
      $('#logopad-val').value = state.logoPad.toFixed(1);
      render();
    });

    $('#expiry').addEventListener('input', function (e) {
      state.expiry = e.target.value;
      $('#expiryinfo').textContent = expiryLabel();
      syncSummaries(); render();
    });
    $('#expiryinlink').addEventListener('change', function (e) {
      state.expiryInLink = e.target.checked;
      syncSummaries(); render();
    });

    // centre-mark upload, click or drop
    var dz = $('#dropzone');
    dz.addEventListener('click', function () { $('#logofile').click(); });
    dz.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#logofile').click(); }
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function () { dz.classList.remove('over'); });
    });
    dz.addEventListener('drop', function (e) {
      e.preventDefault();
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readLogo(f);
    });
    $('#logofile').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) readLogo(f);
    });

    function readLogo(f) {
      if (!/^image\//.test(f.type)) {
        $('#dropmsg').textContent = 'That is not an image. Pick a PNG, JPG or SVG.';
        return;
      }
      var fr = new FileReader();
      fr.onload = function () {
        state.logoHref = fr.result;
        $('#dropmsg').textContent = f.name;
        forceEcH();
        inspectLogo(fr.result).then(function (info) {
          logoInfo = info;
          showLogoInfo();
        });
        render();
      };
      fr.readAsDataURL(f);
    }

    // presets
    $('#presetgal').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) {
        e.stopPropagation();
        var list = savedPresets();
        list.splice(+del.dataset.del, 1);
        writePresets(list); renderPresetGallery();
        return;
      }
      var b = e.target.closest('button[data-preset]');
      if (!b) return;
      var id = b.dataset.preset;
      var p = id[0] === 'b' ? BUILTIN_PRESETS[+id.slice(1)] : savedPresets()[+id.slice(1)];
      if (p) applyStyle(fullStyle(p.style));
    });
    $('#presetadd').addEventListener('click', function () {
      var name = $('#presetname').value.trim();
      if (!name) { $('#presetname').focus(); return; }
      var list = savedPresets();
      list = list.filter(function (p) { return p.name !== name; });
      list.push({ name: name, style: styleOf(state) });
      writePresets(list);
      $('#presetname').value = '';
      renderPresetGallery();
    });

    // share link
    $('#share').addEventListener('click', function () {
      var url = shareUrl();
      // Put it in the address bar first: if the clipboard is blocked, the link
      // is still there to copy by hand rather than lost entirely.
      history.replaceState(null, '', url);
      navigator.clipboard.writeText(url)
        .then(function () { flash('#share', 'Link copied'); })
        .catch(function () { flash('#share', 'Link is in the address bar'); });
    });

    $('#damagerun').addEventListener('click', runDamage);

    $('#comparegroup').addEventListener('toggle', function () {
      if ($('#comparegroup').open) renderCompare();
    });

    $('#comparegrid').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-st]');
      if (!b) return;
      state.style = b.dataset.st;
      state.eyeStyle = b.dataset.ey;
      markSeg($('.seg[data-key="style"]'), state.style);
      markSeg($('.seg[data-key="eyeStyle"]'), state.eyeStyle);
      render();
      renderCompare();
    });

    $('#undo').addEventListener('click', undo);
    $('#redo').addEventListener('click', redo);

    document.addEventListener('keydown', function (e) {
      if (!(e.metaKey || e.ctrlKey)) return;
      var k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      // Inside a text field, Cmd+Z belongs to the browser: it undoes typing.
      if (inTextField(e.target)) return;
      e.preventDefault();
      if (k === 'y' || e.shiftKey) redo(); else undo();
    });

    $('#reset').addEventListener('click', function () {
      // Keeps the theme and saved styles; clears the design, the payload and
      // any restored link.
      var fresh = defaults();
      Object.keys(fresh).forEach(function (k) { state[k] = fresh[k]; });
      state.data = fresh.data;
      history.replaceState(null, '', location.pathname);
      $('#suggest').hidden = true; pendingSwitch = null;
      $('#dropmsg').textContent = 'Drop an image here, or click to choose';
      renderTypes(); renderFields(); syncControls(); render();
      flash('#reset', 'Reset');
      $('#quick').focus();
    });

    // theme
    $('#theme').addEventListener('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    // exports
    $('#copy-png').addEventListener('click', copyPng);
    $('#copy-svg').addEventListener('click', copySvg);
    $('#dl-png').addEventListener('click', function () {
      if (lastPngUrl) saveFile(lastPngUrl, filename('png'));
    });
    $('#dl-svg').addEventListener('click', function () {
      var text = payload();
      if (!text) return;
      saveFile('data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(R.svg(text, Object.assign({}, opts(), { px: 1024 }))), filename('svg'));
    });
    $('#print-one').addEventListener('click', printCurrent);

    // batch
    $('#batchrun').addEventListener('click', runBatch);
    $('#batchzip').addEventListener('click', downloadZip);
    $('#batchprint').addEventListener('click', function () {
      if (batchResults.length) openPrintSheet(batchResults);
    });

    var cd = $('#csvdrop');
    cd.addEventListener('click', function () { $('#csvfile').click(); });
    cd.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#csvfile').click(); }
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      cd.addEventListener(ev, function (e) { e.preventDefault(); cd.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      cd.addEventListener(ev, function () { cd.classList.remove('over'); });
    });
    function readCsv(f) {
      var fr = new FileReader();
      fr.onload = function () {
        $('#batchin').value = fr.result;
        batchTable = readTable(fr.result);
        renderMapping();
        $('#csvmsg').textContent = f.name + ' · ' + batchTable.rows.length + ' rows · ' +
          columnNames(batchTable).length + ' columns';
      };
      fr.readAsText(f);
    }

    var mapTimer = 0;
    $('#batchin').addEventListener('input', function () {
      clearTimeout(mapTimer);
      mapTimer = setTimeout(function () {
        batchTable = readTable($('#batchin').value);
        renderMapping();
      }, 350);
    });

    ['#map-value', '#map-label', '#map-file'].forEach(function (sel) {
      $(sel).addEventListener('change', previewMapping);
    });
    cd.addEventListener('drop', function (e) {
      e.preventDefault();
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readCsv(f);
    });
    $('#csvfile').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) readCsv(f);
    });

    // camera
    $('#camstart').addEventListener('click', camStart);
    $('#camstop').addEventListener('click', camStop);
    window.addEventListener('pagehide', function () { if (stream) camStop(); });

    // shortcuts
    document.addEventListener('keydown', function (e) {
      // Never steal keys from something focusable. Enter on a focused button
      // must press that button rather than copy the code.
      if (inFocusable(e.target)) return;
      if (e.key === '/') {
        e.preventDefault();
        showTab('design');
        $('#quick').focus(); $('#quick').select();
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); copyPng(); return; }
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 'c') { e.preventDefault(); copyPng(); }
      if (e.key === 's') { e.preventDefault(); if (lastPngUrl) saveFile(lastPngUrl, filename('png')); }
    });
  }

  // ---- boot ---------------------------------------------------------------

  applyTheme(safeGet(THEME_KEY) || 'dark');
  readHash();
  renderTypes();
  renderFields();
  renderPresetGallery();
  renderPrintChips();
  renderRecents();
  bind();
  syncControls();
  setVerdict('#camverdict', '', 'Camera off', 'Press Start camera to test a printed code.');
  render();
  markHistory();                        // the starting point is undoable to
  if (!location.hash) $('#quick').focus();
})();
