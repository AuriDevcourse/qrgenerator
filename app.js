/* app.js — UI for the QR generator. Encoding/rendering lives in qr-render.js. */
(function () {
  'use strict';

  var R = window.QRRender;
  var $ = function (s) { return document.querySelector(s); };

  // Minimum module size that stays readable to a phone camera in print, and the
  // rule of thumb that a code scans from about 10x its own width.
  var MM_PER_MODULE = 0.4;
  var DISTANCE_RATIO = 10;

  // ---- payload field definitions -----------------------------------------

  var TYPES = [
    { id: 'url',   label: 'Link' },
    { id: 'text',  label: 'Text' },
    { id: 'wifi',  label: 'Wi-Fi' },
    { id: 'vcard', label: 'Contact' },
    { id: 'email', label: 'Email' },
    { id: 'sms',   label: 'SMS' },
    { id: 'phone', label: 'Phone' },
    { id: 'geo',   label: 'Location' },
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

  // Opens in a usable state rather than an empty shell.
  var state = {
    type: 'url',
    data: {
      url: 'techbbq.org/tickets',
      text: '',
      ssid: 'TechBBQ Guest', password: '', auth: 'WPA', hidden: false,
      first: '', last: '', org: '', title: '', phone: '', email: '', note: '',
      to: '', subject: '', body: '', message: '',
      lat: 55.6761, lng: 12.5683,
      start: '', end: '', location: ''
    },
    ec: 'M',
    style: 'rounded',
    eyeStyle: 'rounded',
    margin: 4,
    fg: '#ce0f2e',
    bg: '#ffffff',
    logoMode: 'none',      // none | mark | custom
    logoMark: 'tbbq-gradient',
    logoHref: null,        // data URI for an uploaded image
    logoPct: 0.2,
    distanceCm: 30
  };

  function renderMarkVars() {
    $('#markvars').innerHTML = Object.keys(R.MARKS).map(function (k) {
      return '<button type="button" data-mark="' + k + '" aria-pressed="' +
        (state.logoMark === k) + '">' + R.MARKS[k].label + '</button>';
    }).join('');
  }

  // Show only the controls the chosen mode actually uses.
  function syncLogoUi() {
    var on = state.logoMode !== 'none';
    $('#logo-opts').hidden = !on;
    $('#markvars').hidden = state.logoMode !== 'mark';
    $('#uploadrow').hidden = state.logoMode !== 'custom';
  }

  // A covered centre needs the strongest correction level to survive.
  function forceEcH() {
    state.ec = 'H';
    document.querySelectorAll('.seg.ec button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.val === 'H'));
    });
  }

  // ---- form rendering -----------------------------------------------------

  function renderTypes() {
    $('#types').innerHTML = TYPES.map(function (t) {
      return '<button type="button" data-type="' + t.id + '" aria-pressed="' +
        (state.type === t.id) + '">' + t.label + '</button>';
    }).join('');
  }

  function renderFields() {
    var defs = FIELDS[state.type];
    var wrap = $('#fields');
    wrap.className = 'fields' + (defs.length > 1 && !defs.every(function (d) { return d.wide; }) ? ' two' : '');
    wrap.innerHTML = defs.map(function (d) {
      var v = state.data[d.k];
      var id = 'f_' + d.k;
      var body;
      if (d.type === 'textarea') {
        body = '<textarea id="' + id + '" data-k="' + d.k + '" rows="3">' +
          String(v == null ? '' : v).replace(/</g, '&lt;') + '</textarea>';
      } else if (d.type === 'select') {
        body = '<select id="' + id + '" data-k="' + d.k + '">' + d.opts.map(function (o) {
          return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select>';
      } else if (d.type === 'check') {
        body = '<label style="display:flex;gap:7px;align-items:center;font-size:13px;color:var(--ink-soft)">' +
          '<input type="checkbox" id="' + id + '" data-k="' + d.k + '"' + (v ? ' checked' : '') +
          ' style="accent-color:var(--accent)"> Yes</label>';
      } else {
        body = '<input type="' + (d.type || 'text') + '" id="' + id + '" data-k="' + d.k +
          '" value="' + String(v == null ? '' : v).replace(/"/g, '&quot;') + '"' +
          (d.ph ? ' placeholder="' + d.ph + '"' : '') + ' autocomplete="off" spellcheck="false">';
      }
      var lab = d.type === 'check' ? '<label>' + d.label + '</label>' :
        '<label for="' + id + '">' + d.label + '</label>';
      return '<div class="field"' + (d.wide ? ' style="grid-column:1/-1"' : '') + '>' +
        lab + body + (d.hint ? '<span class="hint">' + d.hint + '</span>' : '') + '</div>';
    }).join('');
  }

  // ---- payload ------------------------------------------------------------

  function payload() {
    try { return R.payload[state.type](state.data) || ''; }
    catch (e) { return ''; }
  }

  // ---- rasterising --------------------------------------------------------

  var canvas = document.createElement('canvas');

  function rasterize(svgStr, px) {
    return new Promise(function (res, rej) {
      var img = new Image();
      var url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
      img.onload = function () {
        canvas.width = canvas.height = px;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = state.bg === 'transparent' ? '#ffffff' : state.bg;
        ctx.fillRect(0, 0, px, px);
        ctx.drawImage(img, 0, 0, px, px);
        URL.revokeObjectURL(url);
        res(ctx);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('render failed')); };
      img.src = url;
    });
  }

  // ---- main render --------------------------------------------------------

  var token = 0;
  var lastSvg = '';
  var lastPngUrl = '';

  function logoActive() {
    if (state.logoMode === 'mark') return true;
    return state.logoMode === 'custom' && !!state.logoHref;
  }

  function opts() {
    var on = logoActive();
    return {
      ec: state.ec, style: state.style, eyeStyle: state.eyeStyle, margin: state.margin,
      fg: state.fg, bg: state.bg,
      logoPct: on ? state.logoPct : 0,
      logoMark: on && state.logoMode === 'mark' ? state.logoMark : null,
      logoHref: on && state.logoMode === 'custom' ? state.logoHref : null
    };
  }

  function render() {
    var text = payload();
    var my = ++token;
    var bytes = R.utf8len(text);
    var max = R.MAX_BYTES[state.ec];

    if (!text) {
      setVerdict('warn', 'Nothing to encode', 'Fill in the field above and the code appears here.');
      $('#raw').value = '';
      setSpec(null, 0, max);
      setNotices([]);
      return;
    }
    if (bytes > max) {
      setVerdict('crit', 'Too much data',
        bytes + ' bytes exceeds the ' + max + '-byte ceiling at error correction ' + state.ec +
        '. Shorten the content or drop to a lower correction level.');
      $('#raw').value = text;
      setSpec(null, bytes, max);
      setNotices([]);
      return;
    }

    $('#raw').value = text;

    var o = opts();
    var m = R.encode(text, state.ec);
    var svg = R.svg(text, Object.assign({}, o, { px: 1024 }));
    lastSvg = svg;
    setSpec(m, bytes, max);
    setNotices(collectNotices(m, bytes, max));

    // Raster big enough that the decode check is a fair test, not a resolution test.
    var px = Math.min(2400, Math.max(720, R.recommendedPx(text, o)));
    setVerdict('idle', 'Checking…', 'Re-reading the generated image.');

    rasterize(svg, px).then(function (ctx) {
      if (my !== token) return;
      lastPngUrl = canvas.toDataURL('image/png');
      $('#preview').src = lastPngUrl;
      $('#preview').alt = 'QR code encoding: ' + text.slice(0, 80);

      if (!window.jsQR) {
        setVerdict('warn', 'Scan check unavailable',
          'The decoder did not load, so this code has not been verified.');
        return;
      }

      var pixels;
      try {
        pixels = ctx.getImageData(0, 0, px, px).data;
      } catch (e) {
        // Opened over file:// — the canvas is tainted, so the pixels cannot be read back.
        setVerdict('warn', 'Scan check needs a local server',
          'Run "npm start" and open http://127.0.0.1:8777 — reading the image back is blocked on file:// URLs. The code itself is fine.');
        return;
      }

      var got = window.jsQR(pixels, px, px);
      if (got && got.data === text) {
        setVerdict('ok', 'Scans correctly', got.data);
      } else if (got) {
        setVerdict('crit', 'Decoded to the wrong value', got.data);
      } else {
        setVerdict('crit', 'Could not be read back',
          'A decoder failed on this image. Raise the error correction level, widen the quiet zone, increase contrast, or shrink the logo.');
      }
    }).catch(function () {
      if (my !== token) return;
      setVerdict('crit', 'Render failed', 'The image could not be drawn.');
    });
  }

  function setVerdict(stateName, headline, echo) {
    var el = $('#verdict');
    el.dataset.state = stateName === 'idle' ? '' : stateName;
    el.innerHTML = '<div class="headline"><span class="dot"></span>' + esc(headline) + '</div>' +
      '<div class="echo">' + esc(echo) + '</div>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- spec readout -------------------------------------------------------

  function setSpec(m, bytes, max) {
    var modulesTotal = m ? m.size + state.margin * 2 : 0;
    var widthMm = modulesTotal * MM_PER_MODULE;
    var reach = widthMm * DISTANCE_RATIO / 10; // cm

    $('#s-version').textContent = m ? 'version ' + m.version : '—';
    $('#s-modules').textContent = m ? m.size + ' × ' + m.size : '—';
    $('#s-quiet').textContent = state.margin + ' module' + (state.margin === 1 ? '' : 's');
    $('#s-print').textContent = m ? widthMm.toFixed(1) + ' mm' : '—';
    $('#s-reach').textContent = m ? '≈ ' + reach.toFixed(0) + ' cm' : '—';

    // Size needed to be read from the distance the user actually cares about.
    var needMm = m ? (state.distanceCm * 10) / DISTANCE_RATIO : 0;
    var needPx = Math.round(needMm / 25.4 * 300);
    $('#s-need').textContent = m ? needMm.toFixed(0) + ' mm · ' + needPx + ' px @300dpi' : '—';

    var pct = max ? Math.min(100, bytes / max * 100) : 0;
    var cap = $('#cap');
    cap.dataset.level = pct > 100 ? 'crit' : pct > 85 ? 'warn' : 'ok';
    $('#cap-fill').style.width = pct.toFixed(1) + '%';
    $('#cap-lab-a').textContent = bytes + ' / ' + max + ' bytes';
    $('#cap-lab-b').textContent = 'EC ' + state.ec;
  }

  // ---- warnings -----------------------------------------------------------

  function collectNotices(m, bytes, max) {
    var out = [];
    var ratio = R.contrast(state.fg, state.bg);

    if (ratio < 2.5) {
      out.push(['crit', 'Not enough contrast',
        'Foreground and background differ by only ' + ratio.toFixed(1) + ':1. Cameras need roughly 3:1 or more.']);
    } else if (ratio < 4) {
      out.push(['warn', 'Contrast is marginal',
        ratio.toFixed(1) + ':1 — fine on screen, unreliable on paper or under poor light.']);
    }

    // Dark modules on a light ground is the normal orientation; flag the inverse.
    if (R.contrast(state.fg, '#ffffff') <= R.contrast(state.bg, '#ffffff')) {
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
    $('#notices').innerHTML = list.map(function (n) {
      return '<div class="notice ' + n[0] + '"><span class="dot"></span><b>' +
        esc(n[1]) + '</b><span>' + esc(n[2]) + '</span></div>';
    }).join('');
  }

  // ---- exports ------------------------------------------------------------

  function filename(ext) {
    return 'qr-' + state.type + '-' + new Date().toISOString().slice(0, 10) + '.' + ext;
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

  function saveFile(href, name) {
    var a = document.createElement('a');
    a.href = href; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  function savePng() {
    if (!lastPngUrl) return;
    saveFile(lastPngUrl, filename('png'));
  }

  function saveSvg() {
    var text = payload();
    if (!text) return;
    var svg = R.svg(text, Object.assign({}, opts(), { px: 1024 }));
    saveFile('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), filename('svg'));
  }

  function flash(sel, msg) {
    var b = $(sel), old = b.textContent;
    b.textContent = msg;
    setTimeout(function () { b.textContent = old; }, 1400);
  }

  // ---- wiring -------------------------------------------------------------

  function bind() {
    $('#types').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-type]');
      if (!b) return;
      state.type = b.dataset.type;
      renderTypes(); renderFields(); render();
    });

    $('#fields').addEventListener('input', function (e) {
      var k = e.target.dataset.k;
      if (!k) return;
      state.data[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      render();
    });
    $('#fields').addEventListener('change', function (e) {
      var k = e.target.dataset.k;
      if (!k) return;
      state.data[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      render();
    });

    document.querySelectorAll('.seg').forEach(function (seg) {
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-val]');
        if (!b) return;
        state[seg.dataset.key] = b.dataset.val;
        seg.querySelectorAll('button').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        if (seg.dataset.key === 'logoMode') {
          syncLogoUi();
          if (state.logoMode !== 'none') forceEcH();
        }
        render();
      });
    });

    $('#fg').addEventListener('input', function (e) {
      state.fg = e.target.value; $('#fg-val').textContent = state.fg; render();
    });
    $('#bg').addEventListener('input', function (e) {
      state.bg = e.target.value; $('#bg-val').textContent = state.bg; render();
    });

    $('#margin').addEventListener('input', function (e) {
      state.margin = +e.target.value; $('#margin-val').value = state.margin; render();
    });
    $('#logopct').addEventListener('input', function (e) {
      state.logoPct = +e.target.value / 100;
      $('#logopct-val').value = e.target.value + '%';
      render();
    });

    $('#markvars').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-mark]');
      if (!b) return;
      state.logoMark = b.dataset.mark;
      renderMarkVars();
      render();
    });
    $('#distance').addEventListener('input', function (e) {
      state.distanceCm = Math.max(1, +e.target.value || 1);
      render();
    });

    $('#logofile').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () { state.logoHref = fr.result; forceEcH(); render(); };
      fr.readAsDataURL(f);
    });

    $('#copy-png').addEventListener('click', copyPng);
    $('#copy-svg').addEventListener('click', copySvg);
    $('#dl-png').addEventListener('click', savePng);
    $('#dl-svg').addEventListener('click', saveSvg);
  }

  renderTypes();
  renderFields();
  renderMarkVars();
  syncLogoUi();
  bind();
  render();
})();
