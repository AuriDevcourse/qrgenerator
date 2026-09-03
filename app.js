/* app.js — UI for Quiet Zone. Encoding and rendering live in qr-render.js. */
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
      { k: 'auth', label: 'Security', type: 'select', opts: [['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP'], ['nopass', 'Open — no password']] },
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
      distanceCm: 30
    };
  }

  var state = defaults();

  // Only the look travels in a preset or a link — never the payload, and never
  // an uploaded image (it would not fit in a URL).
  var STYLE_KEYS = ['ec', 'style', 'eyeStyle', 'margin', 'fg', 'bg',
    'gradOn', 'gradFrom', 'gradTo', 'gradAngle', 'eyeOn', 'eyeColor',
    'logoMode', 'logoMark', 'logoPct',
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

  function applyStyle(style) {
    STYLE_KEYS.forEach(function (k) {
      if (style[k] !== undefined) state[k] = style[k];
    });
    syncControls();
    render();
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
    // hold something — otherwise every empty input bloats the link.
    var used = {};
    (FIELDS[state.type] || []).forEach(function (d) {
      var v = state.data[d.k];
      if (v !== '' && v !== null && v !== undefined && v !== false) used[d.k] = v;
    });
    var payload = { s: styleOf(state), t: state.type, d: used };
    return location.origin + location.pathname + '#' + b64urlEncode(JSON.stringify(payload));
  }

  function readHash() {
    if (!location.hash || location.hash.length < 2) return;
    try {
      var obj = JSON.parse(b64urlDecode(location.hash.slice(1)));
      if (obj.t && FIELDS[obj.t]) state.type = obj.t;
      if (obj.d) Object.keys(obj.d).forEach(function (k) { state.data[k] = obj.d[k]; });
      if (obj.s) STYLE_KEYS.forEach(function (k) {
        if (obj.s[k] !== undefined) state[k] = obj.s[k];
      });
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
        '<span class="pthumb">' + presetThumb(p.style) + '</span>' +
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

  // Push state back into every control — used on load, on preset apply, on link restore.
  function syncControls() {
    $$('.seg').forEach(function (seg) {
      var key = seg.dataset.key;
      seg.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(state[key] === b.dataset.val));
      });
    });
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
  }

  function syncLogoUi() {
    $('#logo-opts').hidden = state.logoMode === 'none';
    $('#markvars').hidden = state.logoMode !== 'mark';
    $('#uploadrow').hidden = state.logoMode !== 'custom';
  }

  function forceEcH() {
    state.ec = 'H';
    $$('.seg.ec button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.val === 'H'));
    });
  }

  // ---- payload and options ------------------------------------------------

  function payload() {
    try { return R.payload[state.type](state.data) || ''; } catch (e) { return ''; }
  }

  function logoActive() {
    if (state.logoMode === 'mark') return true;
    return state.logoMode === 'custom' && !!state.logoHref;
  }

  // Render options from any style object — the live state, or a preset being
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

  // Decode a generated SVG. Resolves { ok, got, blocked } — `blocked` means the
  // pixels could not be read at all (a file:// page taints the canvas).
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
    var bytes = R.utf8len(text);
    var max = R.MAX_BYTES[state.ec];

    if (!text) {
      setVerdict('#verdict', 'warn', 'Nothing to encode', 'Fill in the field above and the code appears here.');
      $('#raw').value = ''; setSpec(null, 0, max); setNotices([]);
      return;
    }
    if (bytes > max) {
      setVerdict('#verdict', 'crit', 'Too much data',
        bytes + ' bytes exceeds the ' + max + '-byte ceiling at error correction ' + state.ec +
        '. Shorten the content or drop to a lower correction level.');
      $('#raw').value = text; setSpec(null, bytes, max); setNotices([]);
      return;
    }

    $('#raw').value = text;
    var o = opts();
    var m = R.encode(text, state.ec);
    lastSvg = R.svg(text, Object.assign({}, o, { px: 1024 }));
    setSpec(m, bytes, max);
    setNotices(collectNotices(m, bytes, max));
    setVerdict('#verdict', '', 'Checking…', 'Re-reading the generated image.');

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
          'Run "npm start" and open http://127.0.0.1:8777 — reading the image back is blocked on file:// URLs. The code itself is fine.');
        return;
      }
      var got = window.jsQR(px, w, h);
      if (got && got.data === text) setVerdict('#verdict', 'ok', 'Scans correctly', got.data);
      else if (got) setVerdict('#verdict', 'crit', 'Decoded to the wrong value', got.data);
      else setVerdict('#verdict', 'crit', 'Could not be read back',
        'A decoder failed on this image. Raise the error correction level, widen the quiet zone, increase contrast, or shrink the centre mark.');
    }).catch(function () {
      if (my !== token) return;
      setVerdict('#verdict', 'crit', 'Render failed', 'The image could not be drawn.');
    });
  }

  function setVerdict(sel, stateName, headline, echo) {
    var el = $(sel);
    el.dataset.state = stateName || '';
    el.innerHTML = '<div class="headline"><span class="dot"></span>' + esc(headline) + '</div>' +
      '<div class="echo">' + esc(echo) + '</div>';
  }

  // ---- readout ------------------------------------------------------------

  function setSpec(m, bytes, max) {
    var total = m ? m.size + state.margin * 2 : 0;
    var widthMm = total * MM_PER_MODULE;
    $('#s-version').textContent = m ? 'version ' + m.version : '—';
    $('#s-modules').textContent = m ? m.size + ' × ' + m.size : '—';
    $('#s-quiet').textContent = state.margin + ' module' + (state.margin === 1 ? '' : 's');
    $('#s-print').textContent = m ? widthMm.toFixed(1) + ' mm' : '—';
    $('#s-reach').textContent = m ? '≈ ' + (widthMm * DISTANCE_RATIO / 10).toFixed(0) + ' cm' : '—';

    var needMm = m ? (state.distanceCm * 10) / DISTANCE_RATIO : 0;
    $('#s-need').textContent = m
      ? needMm.toFixed(0) + ' mm · ' + Math.round(needMm / 25.4 * 300) + ' px @300dpi'
      : '—';

    // One line carries what matters at a glance; the rest is behind a toggle.
    $('#readline').innerHTML = m
      ? '<b>v' + m.version + '</b> · ' + m.size + '×' + m.size + ' · min <b>' +
        widthMm.toFixed(0) + ' mm</b> · ' + bytes + '/' + max + ' bytes · EC ' + state.ec
      : '&mdash;';

    var pct = max ? Math.min(100, bytes / max * 100) : 0;
    $('#cap').dataset.level = pct > 100 ? 'crit' : pct > 85 ? 'warn' : 'ok';
    $('#cap-fill').style.width = pct.toFixed(1) + '%';
    $('#cap-lab-a').textContent = bytes + ' / ' + max + ' bytes';
    $('#cap-lab-b').textContent = 'EC ' + state.ec;
  }

  // ---- warnings -----------------------------------------------------------

  function collectNotices(m, bytes, max) {
    var out = [];
    var grad = state.gradOn ? { from: state.gradFrom, to: state.gradTo } : null;
    var worst = R.worstContrast(state.fg, state.bg, grad);

    if (worst.ratio < 2.5) {
      out.push(['crit', 'Not enough contrast',
        (grad ? 'The weakest gradient stop (' + worst.colour + ') is ' : 'Foreground and background differ by only ') +
        worst.ratio.toFixed(1) + ':1 against the background. Cameras need roughly 3:1 or more.']);
    } else if (worst.ratio < 4) {
      out.push(['warn', 'Contrast is marginal',
        (grad ? worst.colour + ' sits at ' : '') + worst.ratio.toFixed(1) +
        ':1 — fine on screen, unreliable on paper or under poor light.']);
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
        'The standard asks for 4 clear modules around the code; this has ' + state.margin + '.']);
    }

    if (logoActive()) {
      if (state.ec !== 'H' && state.logoPct >= 0.18) {
        out.push(['warn', 'Raise correction for the mark',
          'The mark covers real data. At ' + Math.round(state.logoPct * 100) +
          '% width, use error correction H so the code can rebuild what is hidden.']);
      }
      if (state.logoPct > 0.3) {
        out.push(['crit', 'Mark is too large',
          'Above about 30% width the code loses more data than even level H can recover.']);
      }
    }

    if (state.frameOn && R.contrast(state.frameTextColor, state.frameFill) < 3) {
      out.push(['warn', 'Caption is hard to read',
        'The caption and frame colours are too close together.']);
    }

    if (state.type !== 'url' && R.hasNonAscii(payload())) {
      out.push(['warn', 'Non-ASCII text may not travel',
        'Accented and non-Latin characters are written as raw UTF-8 without an encoding marker. Phone cameras handle it; some fixed scanners do not.']);
    }

    if (bytes / max > 0.85) {
      out.push(['warn', 'Nearly full',
        'This is close to the capacity ceiling, so the code is dense and needs to be printed larger.']);
    }
    return out;
  }

  function setNotices(list) {
    $('#notices').innerHTML = list.map(function (nt) {
      return '<div class="notice ' + nt[0] + '"><span class="dot"></span><b>' +
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
      ' at ' + mm + ' mm sent to the print view.';

    var cells = items.map(function (it) {
      return '<figure style="width:' + mm + 'mm">' + it.svg +
        (it.label ? '<figcaption>' + esc(it.label) + '</figcaption>' : '') + '</figure>';
    }).join('');

    var doc = '<!doctype html><html><head><meta charset="utf-8">' +
      '<title>Quiet Zone — print sheet</title><style>' +
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
      ' at ' + mm + ' mm. Dashed lines are cut guides. Print at 100% scale — ' +
      'any "fit to page" setting will change the physical size and the scanning distance with it.</p>' +
      '<div class="sheet">' + cells + '</div></body></html>';

    win.document.write(doc);
    win.document.close();
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

  // Accepts "value" or "value, label" per line. A pasted or dropped CSV is the
  // same shape, so one parser covers both; a header row is detected and dropped.
  function parseBatch(raw) {
    var lines = String(raw).split(/\r?\n/).map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length > 0; });
    var rows = lines.map(function (line) {
      var parts = [];
      var cell = '', quoted = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (quoted) {
          if (ch === '"') { if (line[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
          else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { parts.push(cell); cell = ''; }
        else cell += ch;
      }
      parts.push(cell);
      return { value: (parts[0] || '').trim(), label: (parts[1] || '').trim() };
    });
    if (rows.length > 1 && /^(url|link|value|code|data)$/i.test(rows[0].value)) rows.shift();
    return rows.filter(function (r) { return r.value; });
  }

  function slug(s, i) {
    var fold = { 'æ': 'ae', 'ø': 'oe', 'å': 'aa', 'ß': 'ss' };
    return (String(s || '').trim().toLowerCase()
      .replace(/[æøåß]/g, function (c) { return fold[c]; })
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'code-' + i).slice(0, 60);
  }

  function runBatch() {
    var rows = parseBatch($('#batchin').value);
    if (!rows.length) {
      $('#batchsummary').textContent = 'Nothing to generate — add at least one line.';
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
        cell.innerHTML = '<div class="bthumb">' +
          R.svg(text, Object.assign({}, o, { px: 120 })) + '</div>' +
          '<div class="blab"><b>' + (res.ok ? 'Verified' : res.blocked ? 'Unchecked' : 'Failed') +
          '</b>' + esc(row.label || row.value) + '</div>';
        if (good) {
          batchResults.push({
            name: slug(row.label || row.value, batchResults.length + 1) + '.svg',
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
        'before export.\nSVG is vector — scale it freely for print.\n'
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
        'This browser does not expose a camera to the page.');
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
      seg.querySelectorAll('button').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      if (seg.dataset.key === 'logoMode') {
        syncLogoUi();
        if (state.logoMode !== 'none') forceEcH();
      }
      render();
    }

    // colours
    [['#fg', 'fg'], ['#bg', 'bg'], ['#gradfrom', 'gradFrom'], ['#gradto', 'gradTo'],
     ['#eyecolor', 'eyeColor'], ['#framefill', 'frameFill'], ['#frametextcolor', 'frameTextColor']
    ].forEach(function (p) {
      $(p[0]).addEventListener('input', function (e) {
        state[p[1]] = e.target.value;
        $(p[0] + '-val').textContent = e.target.value;
        render();
      });
    });

    // toggles
    [['#gradon', 'gradOn', '#gradopts'], ['#eyeon', 'eyeOn', '#eyeopts'],
     ['#frameon', 'frameOn', '#frameopts']].forEach(function (t) {
      $(t[0]).addEventListener('change', function (e) {
        state[t[1]] = e.target.checked;
        $(t[2]).hidden = !e.target.checked;
        render();
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
      renderMarkVars(); render();
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
        $('#dropmsg').textContent = 'That is not an image — pick a PNG, JPG or SVG.';
        return;
      }
      var fr = new FileReader();
      fr.onload = function () {
        state.logoHref = fr.result;
        $('#dropmsg').textContent = f.name;
        forceEcH(); render();
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
        $('#csvmsg').textContent = f.name + ' — ' + parseBatch(fr.result).length + ' rows';
      };
      fr.readAsText(f);
    }
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
      // Never steal keys from something focusable — Enter on a focused button
      // must press that button, not copy the code.
      if (e.target.closest('input, textarea, select, button, a, summary, [role="button"], [contenteditable]')) return;
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
  if (!location.hash) $('#quick').focus();
})();
