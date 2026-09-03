/* build.mjs — inline every local asset into one artifact-ready HTML fragment.
 * The Artifact host supplies <!doctype>, <html>, <head> and <body>, so this
 * emits page content only. jsQR stays on jsDelivr, which the host CSP allows. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const read = f => readFileSync(new URL(f, import.meta.url), 'utf8');

const html = read('./index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

// Strip the dev <script src> tags; the real code is inlined below.
const content = body.replace(/\s*<script src="[^"]*"><\/script>/g, '');

const out = `<title>Quiet Zone</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
${read('./styles.css')}
</style>
${content}
<script>
${read('./vendor/qrcode.js')}
</script>
<script>
${read('./qr-render.js')}
</script>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"></script>
<script>
${read('./app.js')}
</script>
`;

mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/quiet-zone.html', import.meta.url), out);
console.log('dist/quiet-zone.html', (out.length / 1024).toFixed(0) + ' KB');
