/*
 * qr-render.js — matrix -> SVG path rendering for QR codes.
 * Works in the browser (global `QRRender`) and in Node (module.exports).
 * Depends on qrcode-generator (vendor/qrcode.js) for the encoding itself.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./vendor/qrcode.js'));
  } else {
    root.QRRender = factory(root.qrcode);
  }
})(typeof self !== 'undefined' ? self : this, function (qrcode) {
  'use strict';

  // Byte-mode capacity at version 40, per EC level. Used for the "how full is it" meter.
  var MAX_BYTES = { L: 2953, M: 2331, Q: 1663, H: 1273 };


  // Built-in centre marks. Path lifted verbatim from the TechBBQ brand asset
  // public/brand/icon-gradient.svg, so it stays vector all the way to print.
  var TBBQ_MARK = 'M159.7,338.01h381.51c9.42.25,14.01,4.52,14.01,13.8,0,33.37-7.39,65.49-21.9,95.6-11.97,25.09-28.01,47.17-48.13,66.25-3.82,3.76-3.31,6.27-1.02,10.29,21.14,35.63,42.02,71.26,62.9,107.15,5.35,9.03,3.06,12.8-7.64,12.8h-71.56c-5.35,0-8.66-1.76-11.46-6.52-13.5-23.59-27.51-46.92-41-70.51-2.29-4.27-4.58-4.77-9.17-3.26-55.77,20.58-111.55,20.58-167.32,0-5.09-1.76-7.13-.5-9.68,3.76-13.75,23.59-27.51,46.92-41.26,70.51-2.55,4.27-5.35,6.02-10.19,6.02-24.45-.25-48.64,0-73.09,0-9.68,0-11.97-3.76-7.13-12.3,20.63-35.38,41.26-70.76,62.4-105.89,3.31-5.52,3.06-8.78-1.78-13.55-32.85-31.87-53.74-70.26-63.67-114.67-2.29-10.29.25-10.29-13.24-10.29h-46.35c-20.37-.25-34.38-13.05-34.89-31.87-.51-19.57,13.24-33.88,33.87-34.63,11.46-.5,22.67,0,34.13-.25h8.4c-2.04-9.79-3.82-18.57-5.35-27.6-9.42-56.96,2.04-109.91,32.85-158.34,8.91-14.05,21.14-26.35,31.32-39.65,1.53-2.01,3.06-5.77,2.04-8.03-9.42-24.34-2.55-44.41,17.06-59.97C175.23,10.79,198.41-.25,225.66,0c17.32.25,30.82,7.53,39.98,21.58,3.82,5.77,7.13,7.28,14.26,6.78,76.91-5.27,142.11,19.82,194.57,75.78,14.26,15.06,25.47,32.12,34.89,50.44,4.33,8.78,2.55,14.55-6.11,18.82-43.55,20.58-87.1,40.9-130.4,61.48-53.99,25.34-107.98,50.94-161.97,76.28-14.52,6.77-29.29,13.55-43.8,20.58-2.8,1.25-5.35,2.76-8.15,4.27.25.5.51,1.25.76,2.01Z';
  var TBBQ_VIEWBOX = '0 0 555.21 643.89';

  var MARKS = {
    'tbbq-gradient': { label: 'TechBBQ gradient', viewBox: TBBQ_VIEWBOX, d: TBBQ_MARK, fill: 'gradient' },
    'tbbq-red':      { label: 'Founder red',      viewBox: TBBQ_VIEWBOX, d: TBBQ_MARK, fill: '#ce0f2e' },
    'tbbq-white':    { label: 'White',            viewBox: TBBQ_VIEWBOX, d: TBBQ_MARK, fill: '#f2f2f2' },
    'tbbq-black':    { label: 'Black',            viewBox: TBBQ_VIEWBOX, d: TBBQ_MARK, fill: '#0d0d0d' }
  };

  function utf8len(str) {
    return new (typeof TextEncoder !== 'undefined' ? TextEncoder : require('util').TextEncoder)()
      .encode(str).length;
  }

  // ---- encode -------------------------------------------------------------

  function encode(text, ec, minVersion) {
    var qr = qrcode(minVersion || 0, ec || 'M');
    qr.addData(text);
    qr.make();
    var count = qr.getModuleCount();
    var grid = [];
    for (var r = 0; r < count; r++) {
      grid[r] = [];
      for (var c = 0; c < count; c++) grid[r][c] = qr.isDark(r, c);
    }
    return { size: count, version: (count - 17) / 4, grid: grid };
  }

  // ---- geometry helpers ---------------------------------------------------

  // Alignment-pattern centre coordinates per version (spec table 1..40).
  var ALIGN = [[], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42],
    [6,26,46], [6,28,50], [6,30,54], [6,32,58], [6,34,62], [6,26,46,66],
    [6,26,48,70], [6,26,50,74], [6,30,54,78], [6,30,56,82], [6,30,58,86],
    [6,34,62,90], [6,28,50,72,94], [6,26,50,74,98], [6,30,54,78,102],
    [6,28,54,80,106], [6,32,58,84,110], [6,30,58,86,114], [6,34,62,90,118],
    [6,26,50,74,98,122], [6,30,54,78,102,126], [6,26,52,78,104,130],
    [6,30,56,82,108,134], [6,34,60,86,112,138], [6,30,58,86,114,142],
    [6,34,62,90,118,146], [6,30,54,78,102,126,150], [6,24,50,76,102,128,154],
    [6,28,54,80,106,132,158], [6,32,58,84,110,136,162], [6,26,54,82,110,138,166],
    [6,30,58,86,114,142,170]];

  // Alignment patterns are 5x5, centred on every position pair except the
  // three that would collide with a finder pattern.
  function inAlignment(size, version, r, c) {
    var pos = ALIGN[version - 1] || [];
    for (var i = 0; i < pos.length; i++) {
      for (var j = 0; j < pos.length; j++) {
        var last = pos.length - 1;
        var corner = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
        if (corner) continue;
        if (Math.abs(r - pos[i]) <= 2 && Math.abs(c - pos[j]) <= 2) return true;
      }
    }
    return false;
  }

  // Timing patterns: the alternating run on row 6 and column 6.
  function inTiming(size, r, c) {
    return (r === 6 || c === 6);
  }

  // The three 7x7 finder patterns ("eyes"). Drawn separately so they can be styled.
  function eyeOrigins(size) {
    return [{ r: 0, c: 0 }, { r: 0, c: size - 7 }, { r: size - 7, c: 0 }];
  }

  function inEye(size, r, c) {
    return eyeOrigins(size).some(function (o) {
      return r >= o.r && r < o.r + 7 && c >= o.c && c < o.c + 7;
    });
  }

  // Modules blanked out to make room for a centre logo.
  function logoWindow(size, pct) {
    if (!pct) return null;
    var span = Math.max(1, Math.round(size * pct));
    if ((size - span) % 2 !== 0) span += 1; // keep it centred on the grid
    var start = (size - span) / 2;
    return { r0: start, c0: start, r1: start + span - 1, c1: start + span - 1 };
  }

  function inWindow(w, r, c) {
    return w && r >= w.r0 && r <= w.r1 && c >= w.c0 && c <= w.c1;
  }

  // ---- path builders (units = 1 module) -----------------------------------

  function n(v) { return Math.round(v * 1000) / 1000; }

  // Per-cell rounding that only rounds corners with no orthogonal neighbour,
  // so runs of adjacent modules merge into one smooth blob.
  function roundedCellPath(x, y, rad, up, down, left, right) {
    var tl = (!up && !left) ? rad : 0;
    var tr = (!up && !right) ? rad : 0;
    var br = (!down && !right) ? rad : 0;
    var bl = (!down && !left) ? rad : 0;
    var p = 'M' + n(x + tl) + ' ' + n(y);
    p += 'H' + n(x + 1 - tr);
    if (tr) p += 'a' + n(tr) + ' ' + n(tr) + ' 0 0 1 ' + n(tr) + ' ' + n(tr);
    p += 'V' + n(y + 1 - br);
    if (br) p += 'a' + n(br) + ' ' + n(br) + ' 0 0 1 ' + n(-br) + ' ' + n(br);
    p += 'H' + n(x + bl);
    if (bl) p += 'a' + n(bl) + ' ' + n(bl) + ' 0 0 1 ' + n(-bl) + ' ' + n(-bl);
    p += 'V' + n(y + tl);
    if (tl) p += 'a' + n(tl) + ' ' + n(tl) + ' 0 0 1 ' + n(tl) + ' ' + n(-tl);
    return p + 'Z';
  }

  function circlePath(x, y, r) {
    var cx = x + 0.5, cy = y + 0.5;
    return 'M' + n(cx - r) + ' ' + n(cy) +
      'a' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(r * 2) + ' 0' +
      'a' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(-r * 2) + ' 0Z';
  }

  // Ring = outer rounded square + inner rounded square as two subpaths.
  // The consumer paints them with fill-rule="evenodd", so the inner square
  // punches a hole regardless of winding direction.
  function ringPath(x, y, w, rad) {
    var t = 1; // ring thickness, in modules
    return roundedRect(x, y, w, w, rad) +
      roundedRect(x + t, y + t, w - 2 * t, w - 2 * t, Math.max(0, rad - t));
  }

  function roundedRect(x, y, w, h, rad) {
    var r = Math.min(rad, w / 2, h / 2);
    return 'M' + n(x + r) + ' ' + n(y) +
      'H' + n(x + w - r) + 'a' + n(r) + ' ' + n(r) + ' 0 0 1 ' + n(r) + ' ' + n(r) +
      'V' + n(y + h - r) + 'a' + n(r) + ' ' + n(r) + ' 0 0 1 ' + n(-r) + ' ' + n(r) +
      'H' + n(x + r) + 'a' + n(r) + ' ' + n(r) + ' 0 0 1 ' + n(-r) + ' ' + n(-r) +
      'V' + n(y + r) + 'a' + n(r) + ' ' + n(r) + ' 0 0 1 ' + n(r) + ' ' + n(-r) + 'Z';
  }

  /**
   * Build the drawing paths for a QR matrix.
   * Returns { data, eyes, size } — all in module units, origin at the top-left
   * of the quiet zone.
   */
  function paths(m, opts) {
    opts = opts || {};
    var style = opts.style || 'square';        // square | rounded | dots
    var eyeStyle = opts.eyeStyle || 'square';  // square | rounded | circle
    var margin = opts.margin == null ? 4 : opts.margin;
    var win = logoWindow(m.size, opts.logoPct);
    var size = m.size, g = m.grid;
    var data = [], eyes = [];

    var dark = function (r, c) {
      return r >= 0 && c >= 0 && r < size && c < size && g[r][c] && !inWindow(win, r, c);
    };

    // Finder, timing and alignment patterns must keep hard square edges: decoders
    // locate the grid by their run-length ratios, and styling them breaks scanning.
    var isFinder = function (r, c) { return inEye(size, r, c); };
    var isFunc = function (r, c) {
      return isFinder(r, c) || inTiming(size, r, c) || inAlignment(size, m.version, r, c);
    };

    var square = function (x, y) { return 'M' + n(x) + ' ' + n(y) + 'h1v1h-1Z'; };

    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (!dark(r, c)) continue;
        var x = c + margin, y = r + margin;
        if (isFinder(r, c)) {
          // Styled eyes are drawn as whole units further down.
          if (eyeStyle === 'square') data.push(square(x, y));
          continue;
        }
        if (isFunc(r, c) || style === 'square') {
          data.push(square(x, y));
        } else if (style === 'dots') {
          data.push(circlePath(x, y, 0.45));
        } else { // rounded — only round corners with no orthogonal neighbour
          data.push(roundedCellPath(x, y, 0.35,
            dark(r - 1, c), dark(r + 1, c), dark(r, c - 1), dark(r, c + 1)));
        }
      }
    }

    if (eyeStyle !== 'square') {
      // Geometry is pinned per style because the finder pattern's 1:1:3:1:1 run
      // ratio is what decoders use to lock onto the grid. A pupil that is too
      // light breaks that ratio; a pupil inscribed as a full circle (r 1.5) decoded
      // 0/8 in testing, while r 0.7-1.4 decoded 8/8. Ring radius is not sensitive.
      var ring = opts.eyeRadius != null ? opts.eyeRadius : (eyeStyle === 'circle' ? 3.5 : 2);
      var pupil = opts.pupilRadius != null ? opts.pupilRadius : (eyeStyle === 'circle' ? 1.2 : 0.7);
      eyeOrigins(size).forEach(function (o) {
        var x = o.c + margin, y = o.r + margin;
        eyes.push(ringPath(x, y, 7, ring));
        eyes.push(pupil >= 1.5
          ? circlePath(x + 2, y + 2, 1.5)
          : roundedRect(x + 2, y + 2, 3, 3, pupil));
      });
    }

    return { data: data.join(''), eyes: eyes.join(''), size: size + margin * 2 };
  }

  // Fit a mark's viewBox into the blanked centre window, preserving aspect ratio.
  var markUid = 0;

  function markMarkup(mark, win, margin) {
    var span = win.c1 - win.c0 + 1;
    var pad = 0.6;                       // keep the mark off the live modules
    var side = span - pad * 2;
    var vb = String(mark.viewBox).split(/\s+/).map(Number);
    var vbW = vb[2], vbH = vb[3];
    var scale = side / Math.max(vbW, vbH);
    var ox = win.c0 + margin + pad + (side - vbW * scale) / 2;
    var oy = win.r0 + margin + pad + (side - vbH * scale) / 2;

    var out = '';
    var fill = mark.fill;
    if (fill === 'gradient') {
      var id = 'qr-mark-' + (++markUid);
      // objectBoundingBox units, so the gradient spans the mark whatever the scale
      out += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#f58022"/>' +
        '<stop offset="1" stop-color="#ee2242"/></linearGradient></defs>';
      fill = 'url(#' + id + ')';
    }
    return out + '<g transform="translate(' + n(ox) + ' ' + n(oy) + ') scale(' + n(scale) + ')">' +
      '<path d="' + mark.d + '" fill="' + fill + '"/></g>';
  }

  // ---- SVG ----------------------------------------------------------------

  // Gradient direction in CSS terms: 0deg points up, 90deg right, 120deg is the
  // TechBBQ diagonal. Converted to objectBoundingBox coordinates.
  function gradientVector(angle) {
    var a = ((angle == null ? 120 : angle) - 90) * Math.PI / 180;
    var dx = Math.cos(a) / 2, dy = Math.sin(a) / 2;
    return { x1: n(0.5 - dx), y1: n(0.5 - dy), x2: n(0.5 + dx), y2: n(0.5 + dy) };
  }

  function gradientDef(id, grad) {
    var v = gradientVector(grad.angle);
    return '<linearGradient id="' + id + '" x1="' + v.x1 + '" y1="' + v.y1 +
      '" x2="' + v.x2 + '" y2="' + v.y2 + '">' +
      '<stop offset="0" stop-color="' + grad.from + '"/>' +
      '<stop offset="1" stop-color="' + grad.to + '"/></linearGradient>';
  }

  var FRAME = { pad: 1.6, band: 6, radius: 2.4 };

  /**
   * Outer dimensions in module units. A caption frame makes the output taller
   * than it is wide, so callers must not assume a square.
   */
  function dimensions(text, opts) {
    opts = opts || {};
    var margin = opts.margin == null ? 4 : opts.margin;
    var m = encode(text, opts.ec || 'M', opts.minVersion);
    var q = m.size + margin * 2;
    if (!opts.frame) return { vbW: q, vbH: q, qx: 0, qy: 0, ratio: 1 };
    return {
      vbW: q + FRAME.pad * 2,
      vbH: q + FRAME.pad + FRAME.band,
      qx: FRAME.pad,
      qy: FRAME.pad,
      ratio: (q + FRAME.pad + FRAME.band) / (q + FRAME.pad * 2)
    };
  }

  function svg(text, opts) {
    opts = opts || {};
    var ec = opts.ec || 'M';
    var margin = opts.margin == null ? 4 : opts.margin;
    var w = opts.px || 1024;
    var fg = opts.fg || '#000000';
    var bg = opts.bg || '#ffffff';
    var m = encode(text, ec, opts.minVersion);
    var p = paths(m, opts);
    var dim = dimensions(text, opts);
    var h = Math.round(w * dim.ratio);
    var uid = ++markUid;

    var defs = '';
    var fillFor = function (colour, grad, id) {
      if (!grad) return colour;
      defs += gradientDef(id, grad);
      return 'url(#' + id + ')';
    };
    var dataFill = fillFor(fg, opts.fgGradient, 'qr-g-' + uid);
    var eyeFill = fillFor(opts.eyeColor || fg,
      opts.eyeGradient || (opts.eyeColor ? null : opts.fgGradient), 'qr-e-' + uid);

    var out = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
      '" viewBox="0 0 ' + n(dim.vbW) + ' ' + n(dim.vbH) +
      '" shape-rendering="geometricPrecision">';

    // Frame card sits behind everything; the code keeps its own background.
    if (opts.frame) {
      var f = opts.frame;
      out += '<rect width="' + n(dim.vbW) + '" height="' + n(dim.vbH) +
        '" rx="' + n(FRAME.radius) + '" fill="' + (f.fill || '#000000') + '"/>';
    }

    if (bg !== 'transparent') {
      out += '<rect x="' + n(dim.qx) + '" y="' + n(dim.qy) + '" width="' + n(dim.vbW - dim.qx * 2) +
        '" height="' + n(dim.vbW - dim.qx * 2) + '"' +
        (opts.frame ? ' rx="' + n(FRAME.radius * 0.55) + '"' : '') +
        ' fill="' + bg + '"/>';
    }

    var body = '';
    if (p.data) body += '<path d="' + p.data + '" fill="' + dataFill + '"/>';
    if (p.eyes) body += '<path fill-rule="evenodd" d="' + p.eyes + '" fill="' + eyeFill + '"/>';
    if (opts.logoPct) {
      var win = logoWindow(m.size, opts.logoPct);
      if (opts.logoMark && MARKS[opts.logoMark]) {
        body += markMarkup(MARKS[opts.logoMark], win, margin);
      } else if (opts.logoHref) {
        var span = win.c1 - win.c0 + 1;
        var lp = 0.5;
        body += '<image href="' + opts.logoHref + '" x="' + n(win.c0 + margin + lp) +
          '" y="' + n(win.r0 + margin + lp) + '" width="' + n(span - lp * 2) +
          '" height="' + n(span - lp * 2) + '" preserveAspectRatio="xMidYMid meet"/>';
      }
    }

    if (dim.qx || dim.qy) {
      body = '<g transform="translate(' + n(dim.qx) + ' ' + n(dim.qy) + ')">' + body + '</g>';
    }

    if (defs) out += '<defs>' + defs + '</defs>';
    out += body;

    // Caption. Rendered with a generic family on purpose: an SVG rasterised
    // through an <img> is isolated and cannot load a webfont.
    if (opts.frame && opts.frame.text) {
      var cy = dim.vbH - FRAME.band / 2 + 0.15;
      var fs = Math.min(FRAME.band * 0.62, dim.vbW / (opts.frame.text.length * 0.72 + 1));
      out += '<text x="' + n(dim.vbW / 2) + '" y="' + n(cy) +
        '" text-anchor="middle" dominant-baseline="middle"' +
        ' font-family="Inter, Helvetica, Arial, sans-serif" font-weight="700"' +
        ' font-size="' + n(fs) + '" letter-spacing="' + n(fs * 0.08) + '"' +
        ' fill="' + (opts.frame.textColor || '#ffffff') + '">' +
        String(opts.frame.text).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>';
    }

    return out + '</svg>';
  }

  // ---- payload builders ---------------------------------------------------

  function esc(s) { return String(s == null ? '' : s).replace(/([\;,:"])/g, '\\$1'); }

  var payload = {
    text: function (o) { return o.text || ''; },
    url: function (o) {
      var u = (o.url || '').trim();
      if (!u) return '';
      if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
      // Percent-encode only what must be: non-ASCII characters, and a bare '%'
      // that isn't already a valid escape. Existing %XX sequences pass through,
      // so re-encoding an encoded URL is a no-op.
      return u.replace(/%(?![0-9A-Fa-f]{2})|[^\x21-\x7F]/g, function (ch) {
        return ch === '%' ? '%25' : encodeURIComponent(ch);
      });
    },
    wifi: function (o) {
      return 'WIFI:T:' + (o.auth || 'WPA') + ';S:' + esc(o.ssid) +
        (o.auth === 'nopass' ? '' : ';P:' + esc(o.password)) +
        (o.hidden ? ';H:true' : '') + ';;';
    },
    vcard: function (o) {
      var L = ['BEGIN:VCARD', 'VERSION:3.0'];
      L.push('N:' + esc(o.last) + ';' + esc(o.first) + ';;;');
      L.push('FN:' + esc([o.first, o.last].filter(Boolean).join(' ')));
      if (o.org) L.push('ORG:' + esc(o.org));
      if (o.title) L.push('TITLE:' + esc(o.title));
      if (o.phone) L.push('TEL;TYPE=CELL:' + esc(o.phone));
      if (o.email) L.push('EMAIL;TYPE=INTERNET:' + esc(o.email));
      if (o.url) L.push('URL:' + esc(payload.url({ url: o.url })));
      if (o.note) L.push('NOTE:' + esc(o.note));
      L.push('END:VCARD');
      return L.join('\n');
    },
    email: function (o) {
      var q = [];
      if (o.subject) q.push('subject=' + encodeURIComponent(o.subject));
      if (o.body) q.push('body=' + encodeURIComponent(o.body));
      return 'mailto:' + (o.to || '') + (q.length ? '?' + q.join('&') : '');
    },
    sms: function (o) {
      return 'SMSTO:' + (o.phone || '') + (o.message ? ':' + o.message : '');
    },
    phone: function (o) { return 'tel:' + (o.phone || ''); },
    geo: function (o) { return 'geo:' + (o.lat || 0) + ',' + (o.lng || 0); },
    event: function (o) {
      var z = function (d) { return (d || '').replace(/[-:]/g, '').replace(/\.\d+/, ''); };
      return ['BEGIN:VEVENT',
        'SUMMARY:' + esc(o.title),
        o.location ? 'LOCATION:' + esc(o.location) : '',
        o.start ? 'DTSTART:' + z(o.start) + '00' : '',
        o.end ? 'DTEND:' + z(o.end) + '00' : '',
        'END:VEVENT'].filter(Boolean).join('\n');
    }
  };

  // ---- inbound parsing: what did the user paste? --------------------------

  function unescapeWifi(v) {
    return String(v || '').replace(/\\([\\;,:"])/g, '$1');
  }

  function parseWifi(raw) {
    var out = { auth: 'WPA', ssid: '', password: '', hidden: false };
    // WIFI:T:WPA;S:name;P:pass;H:true;;  — fields may arrive in any order.
    String(raw).replace(/^WIFI:/i, '').split(/(?<!\\);/).forEach(function (part) {
      var m = /^([TSPH]):([\s\S]*)$/i.exec(part);
      if (!m) return;
      var key = m[1].toUpperCase(), val = unescapeWifi(m[2]);
      if (key === 'T') out.auth = val || 'WPA';
      if (key === 'S') out.ssid = val;
      if (key === 'P') out.password = val;
      if (key === 'H') out.hidden = /^true$/i.test(val);
    });
    return out;
  }

  function parseVcard(raw) {
    var out = {};
    String(raw).split(/\r?\n/).forEach(function (line) {
      var m = /^([A-Z-]+)(;[^:]*)?:([\s\S]*)$/i.exec(line.trim());
      if (!m) return;
      var tag = m[1].toUpperCase(), val = m[3].replace(/\\([;,:])/g, '$1');
      if (tag === 'N') {
        var parts = val.split(';');
        out.last = parts[0] || ''; out.first = parts[1] || '';
      }
      if (tag === 'ORG') out.org = val;
      if (tag === 'TITLE') out.title = val;
      if (tag === 'TEL') out.phone = val;
      if (tag === 'EMAIL') out.email = val;
      if (tag === 'URL') out.url = val;
    });
    return out;
  }

  var LABELS = {
    url: 'a link', text: 'plain text', wifi: 'Wi-Fi details', vcard: 'a contact card',
    email: 'an email address', sms: 'a text message', phone: 'a phone number',
    geo: 'coordinates', event: 'an event'
  };

  /**
   * Work out what a pasted string is. Returns { type, data } or null.
   * Ordered most-specific first so a vCard is never mistaken for text.
   */
  function detect(raw) {
    var v = String(raw || '').trim();
    if (!v) return null;

    if (/^BEGIN:VCARD/i.test(v)) return { type: 'vcard', data: parseVcard(v) };
    if (/^WIFI:/i.test(v)) return { type: 'wifi', data: parseWifi(v) };
    if (/^BEGIN:VEVENT/i.test(v)) return { type: 'event', data: {} };

    var m = /^mailto:([^?]+)/i.exec(v);
    if (m) return { type: 'email', data: { to: m[1] } };
    m = /^(?:tel|sms|smsto):\+?([\d\s().-]+)/i.exec(v);
    if (m) return { type: 'phone', data: { phone: v.replace(/^[a-z]+:/i, '') } };
    m = /^geo:(-?[\d.]+),(-?[\d.]+)/i.exec(v);
    if (m) return { type: 'geo', data: { lat: +m[1], lng: +m[2] } };

    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return { type: 'email', data: { to: v } };
    if (/^\+?[\d][\d\s().-]{6,}$/.test(v)) {
      return { type: 'phone', data: { phone: v.replace(/[\s().-]/g, '') } };
    }
    m = /^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(v);
    if (m) return { type: 'geo', data: { lat: +m[1], lng: +m[2] } };

    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return { type: 'url', data: { url: v } };
    if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]|$)/i.test(v) && !/\s/.test(v)) {
      return { type: 'url', data: { url: v } };
    }
    return { type: 'text', data: { text: v } };
  }

  // ---- misc ---------------------------------------------------------------

  // WCAG-style relative luminance, used for the contrast check.
  function luminance(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (x) { return x + x; }).join('');
    var v = [0, 2, 4].map(function (i) {
      var c = parseInt(h.substr(i, 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }

  // qrcode-generator writes UTF-8 bytes without an ECI designator, so strict
  // decoders may misread non-ASCII text. Callers use this to warn.
  function hasNonAscii(str) { return /[^\x00-\x7F]/.test(String(str || '')); }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  // A gradient fill is only as scannable as its weakest stop, so report that one.
  function worstContrast(fg, bg, grad) {
    if (!grad) return { ratio: contrast(fg, bg), colour: fg };
    var a = contrast(grad.from, bg), b = contrast(grad.to, bg);
    return a <= b ? { ratio: a, colour: grad.from } : { ratio: b, colour: grad.to };
  }

  // Smallest raster width that keeps each module at `perModule` px — below
  // roughly 4px/module, cameras and decoders start to struggle.
  function recommendedPx(text, opts) {
    opts = opts || {};
    var margin = opts.margin == null ? 4 : opts.margin;
    var m = encode(text, opts.ec || 'M', opts.minVersion);
    return (m.size + margin * 2) * (opts.perModule || 8);
  }

  return {
    MAX_BYTES: MAX_BYTES,
    MARKS: MARKS,
    recommendedPx: recommendedPx,
    dimensions: dimensions,
    utf8len: utf8len,
    encode: encode,
    paths: paths,
    svg: svg,
    payload: payload,
    detect: detect,
    parseWifi: parseWifi,
    parseVcard: parseVcard,
    TYPE_LABELS: LABELS,
    contrast: contrast,
    worstContrast: worstContrast,
    hasNonAscii: hasNonAscii,
    logoWindow: logoWindow
  };
});
