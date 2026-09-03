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

// Inline scripts are pinned by hash, so the built page runs its own four
// bundles and nothing else. An injected <script> or an inline handler is
// refused by the browser even if some value slipped past validation.
const scripts = [
  read('./vendor/qrcode.js'),
  read('./qr-render.js'),
  read('./vendor/jsqr.js'),
  read('./app.js'),
];
// The hash must cover the element's exact text content, whitespace included,
// so the bodies are built first and both the hash and the tag use them verbatim.
const bodies = scripts.map((src) => `\n${src}\n`);
const sha = (body) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;

// style-src keeps 'unsafe-inline': the page sets style attributes from script
// (meter width, swatch colours). Those values are validated colours, and a
// meta CSP cannot carry frame-ancestors, so Vercel adds that as a header.
const csp = [
  "default-src 'none'",
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
for (const name of ['index.html', 'quiet-zone.html']) {
  writeFileSync(new URL(`./dist/${name}`, import.meta.url), out);
}
console.log(`dist/index.html + dist/quiet-zone.html  ${(out.length / 1024).toFixed(0)} KB  (self-contained)`);
