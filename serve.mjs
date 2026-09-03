#!/usr/bin/env node
/*
 * serve.mjs: zero-dependency static server for local development.
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
import { extname, join, normalize, resolve, sep } from 'node:path';

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

    // Keep requests inside ROOT: normalize first, then confirm the prefix.
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let target = file;
    const info = await stat(target);
    if (info.isDirectory()) target = join(target, 'index.html');

    res.writeHead(200, {
      'Content-Type': TYPES[extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(await readFile(target));
  } catch {
    res.writeHead(404).end('Not found');
  }
});

// Is the thing already on this port our own server? Then starting again is a
// no-op worth saying plainly, rather than an unhandled EADDRINUSE stack trace.
async function alreadyOurs(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/index.html`, {
      signal: AbortSignal.timeout(1500)
    });
    return res.ok && (await res.text()).includes('<title>Quiet Zone</title>');
  } catch {
    return false;
  }
}

server.on('error', async (err) => {
  if (err.code !== 'EADDRINUSE') throw err;

  if (await alreadyOurs(PORT)) {
    console.log(`Quiet Zone is already running. Nothing to do.\n`);
    console.log(`  App        http://127.0.0.1:${PORT}/`);
    console.log(`  Self-test  http://127.0.0.1:${PORT}/verify.html\n`);
    process.exit(0);
  }

  console.error(`Port ${PORT} is in use by something else.\n`);
  console.error(`Start on a different port with:\n  npm start -- ${PORT + 1}\n`);
  console.error(`Or find what is holding it:\n  lsof -nP -iTCP:${PORT} -sTCP:LISTEN`);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Quiet Zone   http://127.0.0.1:${PORT}/`);
  console.log(`Self-test    http://127.0.0.1:${PORT}/verify.html`);
});
