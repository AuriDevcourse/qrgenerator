#!/usr/bin/env node
/*
 * serve.mjs — zero-dependency static server for local development.
 *
 * A server is required, not optional: the scan check draws the generated SVG to
 * a canvas and reads the pixels back, and on file:// the canvas is tainted, so
 * getImageData throws. Serving over http://localhost keeps the origin sane and
 * also makes it a secure context, which the clipboard API needs.
 *
 *   node serve.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname);
const PORT = Number(process.argv[2]) || 8777;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = createServer(async (req, res) => {
  try {
    // Parsed by hand rather than with URL(): a request for '//' is a valid HTTP
    // target but a protocol-relative URL, which the URL constructor rejects.
    let path = decodeURIComponent(req.url.split('?')[0]).replace(/\/{2,}/g, '/');
    // Any directory-ish path ('/', '//', '/dist/') resolves to its index.html.
    if (path.endsWith('/')) path += 'index.html';

    // Keep requests inside ROOT — normalize first, then confirm the prefix.
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let target = file;
    const info = await stat(target);
    if (info.isDirectory()) target = join(target, 'index.html');

    res.writeHead(200, {
      'Content-Type': TYPES[extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(await readFile(target));
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Quiet Zone   http://127.0.0.1:${PORT}/`);
  console.log(`Self-test    http://127.0.0.1:${PORT}/verify.html`);
});
