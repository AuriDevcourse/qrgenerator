/*
 * csv.js: one CSV parser shared by the web app and the command line.
 * Browser global `QRCsv`, or module.exports in Node.
 *
 * Handles quoted fields, embedded commas, "" escapes and newlines inside
 * quotes. The app used to split on lines first, which broke any field
 * containing a newline.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QRCsv = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function parse(text) {
    var rows = [];
    var row = [];
    var cell = '';
    var quoted = false;
    var s = String(text == null ? '' : text);

    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (quoted) {
        if (ch === '"') {
          if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
        } else cell += ch;
        continue;
      }
      if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }

    return rows
      .map(function (r) { return r.map(function (c) { return c.trim(); }); })
      .filter(function (r) { return r.some(function (c) { return c !== ''; }); });
  }

  return { parse: parse };
});
