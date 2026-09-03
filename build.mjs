#!/usr/bin/env node
/*
 * build.mjs — bundle the app into one standalone HTML file.
 *
 * Everything is inlined: stylesheet, encoder, renderer, decoder and app code.
 * The result has no network dependency except the Google Fonts stylesheet, and
 * falls back to system sans if that is unavailable.
 *
 * Note the output still wants to be served over http:// rather than opened as a
 * file — the scan check reads pixels back off a canvas, which file:// forbids.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

const html = read('./index.html');
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

// Keep the head's meta and font link; the local stylesheet gets inlined instead.
const headKept = head
  .replace(/\s*<link rel="stylesheet" href="\.\/styles\.css">/, '')
  .trim();

// Drop the dev <script src> tags — the real sources are inlined below.
const bodyContent = body.replace(/\s*<script src="[^"]*"><\/script>/g, '').trim();

const out = `<!doctype html>
<html lang="en">
<head>
${headKept}
<style>
${read('./styles.css')}
</style>
</head>
<body>
${bodyContent}
<script>
${read('./vendor/qrcode.js')}
</script>
<script>
${read('./qr-render.js')}
</script>
<script>
${read('./vendor/jsqr.js')}
</script>
<script>
${read('./app.js')}
</script>
</body>
</html>
`;

mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/quiet-zone.html', import.meta.url), out);
console.log(`dist/quiet-zone.html  ${(out.length / 1024).toFixed(0)} KB  (self-contained)`);
