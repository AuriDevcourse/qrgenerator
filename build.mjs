#!/usr/bin/env node
/*
 * build.mjs: bundle the app into one standalone HTML file.
 *
 * Everything is inlined: stylesheet, encoder, renderer, decoder and app code.
 * The result has no network dependency except the Google Fonts stylesheet, and
 * falls back to system sans if that is unavailable.
 *
 * Note the output still wants to be served over http:// rather than opened as a
 * file, because the scan check reads pixels back off a canvas, which file:// forbids.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

const html = read('./index.html');
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

// Keep the head's meta and font link; the local stylesheet gets inlined instead.
const headKept = head
  .replace(/\s*<link rel="stylesheet" href="\.\/styles\.css">/, '')
  .trim();

// Drop the dev <script src> tags. The real sources are inlined below.
const bodyContent = body.replace(/\s*<script src="[^"]*"><\/script>/g, '').trim();

// The dev page and this list have to agree. zip.js was once in index.html but
// missing here, so the built page had no QRZip and Download ZIP threw.
const LOCAL = [...body.matchAll(/<script src="\.\/([^"]+)"><\/script>/g)].map((m) => m[1]);

// Inline scripts are pinned by hash, so the built page runs its own four
// bundles and nothing else. An injected <script> or an inline handler is
// refused by the browser even if some value slipped past validation.
const INLINED = [
  'vendor/qrcode.js',
  'qr-render.js',
  'csv.js',
  'zip.js',
  'vendor/jsqr.js',
  'app.js',
];
const scripts = INLINED.map((f) => read('./' + f));
// The hash must cover the element's exact text content, whitespace included,
// so the bodies are built first and both the hash and the tag use them verbatim.
const bodies = scripts.map((src) => `\n${src}\n`);
const sha = (body) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;

// An inlined bundle containing a closing script tag ends its own element and
// the rest of the page becomes markup. It broke the build once from a comment
// in qr-render.js, and again from one in verify.html.
const selfClosing = INLINED.filter((f) => read('./' + f).includes('</scr' + 'ipt'));
if (selfClosing.length) {
  console.error(`build failed: ${selfClosing.join(', ')} contains a closing script tag, ` +
    `which would terminate its own element once inlined. Split or reword it.`);
  process.exit(1);
}

const missing = LOCAL.filter((f) => !INLINED.includes(f));
if (missing.length) {
  console.error(`build failed: index.html loads ${missing.join(', ')}, which this build does not inline.`);
  process.exit(1);
}

// style-src keeps 'unsafe-inline': the page sets style attributes from script
// (meter width, swatch colours). Those values are validated colours, and a
// meta CSP cannot carry frame-ancestors, so Vercel adds that as a header.
const csp = [
  "default-src 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
  `script-src ${bodies.map(sha).join(' ')}`,
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const out = `<!doctype html>
<html lang="en">
<head>
<meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0d0d0d">
${headKept}
<style>
${read('./styles.css')}
</style>
</head>
<body>
${bodyContent}
${bodies.map((body) => `<script>${body}</script>`).join('\n')}
</body>
</html>
`;

mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });

// index.html so dist/ is a servable site root (Vercel points at it), and a named
// copy for handing someone a single file.
for (const name of ['index.html', 'qr-generator.html']) {
  writeFileSync(new URL(`./dist/${name}`, import.meta.url), out);
}
// ---- installable, and works with no network -------------------------------
// The whole app is one document, so the shell is a single cache entry. Network
// first for the page keeps a redeploy from being pinned to an old version.
const markPath = read('./qr-render.js').match(/var TBBQ_MARK = '([^']+)'/)[1];
writeFileSync(new URL('./dist/icon.svg', import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 555.21 643.89">` +
  `<rect width="555.21" height="643.89" fill="#0d0d0d"/>` +
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">` +
  `<stop offset="0" stop-color="#f58022"/><stop offset="1" stop-color="#ee2242"/>` +
  `</linearGradient></defs><path fill="url(#g)" d="${markPath}"/></svg>\n`);

writeFileSync(new URL('./dist/manifest.webmanifest', import.meta.url), JSON.stringify({
  name: 'QR Generator',
  short_name: 'QR Generator',
  description: 'A QR code generator that decodes its own output.',
  start_url: '.',
  scope: '.',
  display: 'standalone',
  background_color: '#0d0d0d',
  theme_color: '#0d0d0d',
  icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
}, null, 2) + '\n');

writeFileSync(new URL('./dist/sw.js', import.meta.url), `/* QR Generator offline shell */
const CACHE = 'qr-generator-v${Date.now().toString(36)}';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Network first, cache as the fallback: a redeploy should win, but the app
  // still opens with no connection at all.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.ok && new URL(e.request.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
`);

console.log(`dist/index.html + dist/qr-generator.html  ${(out.length / 1024).toFixed(0)} KB  (self-contained)`);
console.log('dist/manifest.webmanifest + dist/sw.js + dist/icon.svg  (installable, offline)');
