/*
 * zip.js: minimal store-only (uncompressed) ZIP writer.
 * Runs in the browser (global `QRZip`) and in Node (module.exports).
 *
 * Store rather than deflate on purpose: no compressor to ship, and the payload
 * is a handful of small SVG files where the saving would be irrelevant.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QRZip = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    return new Uint8Array(Buffer.from(str, 'utf8'));
  }

  // DOS date/time, as the format requires.
  function dosTime(d) {
    return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  }
  function dosDate(d) {
    return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  }

  function Writer(size) {
    this.b = new Uint8Array(size);
    this.i = 0;
  }
  Writer.prototype.u16 = function (v) {
    this.b[this.i++] = v & 0xff; this.b[this.i++] = (v >>> 8) & 0xff;
  };
  Writer.prototype.u32 = function (v) {
    this.b[this.i++] = v & 0xff; this.b[this.i++] = (v >>> 8) & 0xff;
    this.b[this.i++] = (v >>> 16) & 0xff; this.b[this.i++] = (v >>> 24) & 0xff;
  };
  Writer.prototype.bytes = function (a) {
    this.b.set(a, this.i); this.i += a.length;
  };

  /**
   * Build a ZIP from [{name, data}] where data is a string or Uint8Array.
   * Returns a Uint8Array.
   */
  function zip(files) {
    var now = new Date();
    var entries = files.map(function (f) {
      var data = typeof f.data === 'string' ? utf8(f.data) : f.data;
      return { name: utf8(f.name), data: data, crc: crc32(data) };
    });

    var LOCAL = 30, CENTRAL = 46, END = 22;
    var size = END;
    entries.forEach(function (e) {
      size += LOCAL + e.name.length + e.data.length + CENTRAL + e.name.length;
    });

    var w = new Writer(size);
    var time = dosTime(now), date = dosDate(now);

    entries.forEach(function (e) {
      e.offset = w.i;
      w.u32(0x04034b50);        // local file header
      w.u16(20);                // version needed
      w.u16(0x0800);            // flags: UTF-8 names
      w.u16(0);                 // method: store
      w.u16(time); w.u16(date);
      w.u32(e.crc);
      w.u32(e.data.length);     // compressed size
      w.u32(e.data.length);     // uncompressed size
      w.u16(e.name.length);
      w.u16(0);                 // extra length
      w.bytes(e.name);
      w.bytes(e.data);
    });

    var dirStart = w.i;
    entries.forEach(function (e) {
      w.u32(0x02014b50);        // central directory header
      w.u16(20);                // version made by
      w.u16(20);                // version needed
      w.u16(0x0800);
      w.u16(0);
      w.u16(time); w.u16(date);
      w.u32(e.crc);
      w.u32(e.data.length);
      w.u32(e.data.length);
      w.u16(e.name.length);
      w.u16(0); w.u16(0);       // extra, comment
      w.u16(0);                 // disk number
      w.u16(0);                 // internal attrs
      w.u32(0);                 // external attrs
      w.u32(e.offset);
      w.bytes(e.name);
    });

    // Measure the central directory before writing the trailer, not during it.
    var dirSize = w.i - dirStart;

    w.u32(0x06054b50);          // end of central directory
    w.u16(0); w.u16(0);
    w.u16(entries.length); w.u16(entries.length);
    w.u32(dirSize);
    w.u32(dirStart);
    w.u16(0);

    return w.b;
  }

  return { zip: zip, crc32: crc32 };
});
