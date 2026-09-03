# Quiet Zone — working notes

QR code generator that verifies its own output. Vanilla JS, no framework.

## Ground rules

- **`qr-render.js` is UMD** and must load as CommonJS in Node. Do **not** add
  `"type": "module"` to `package.json` — it breaks the renderer and `batch.mjs`.
  `build.mjs` / `batch.mjs` are `.mjs`, so they are ESM by extension already.
- **`dist/` is generated.** Edit `index.html` / `app.js` / `styles.css`, then
  `npm run build`. Never hand-edit `dist/quiet-zone.html`.
- **Verify before publishing.** `npm start`, open `/verify.html`, and require
  **0 fail**. Expected-fails (`xfail` / `risky` cases) are fine. `verify.html` and
  `probe.html` need a server — blob URLs and `getImageData` are blocked on `file://`.
- **Styling follows the TechBBQ design system** at
  `~/Documents/GitHub/tdesignsystem` (branch `feat/design-system`). Tokens:
  `app/globals.css` + `public/brand/tokens.json`. Components: `components/ui/`.
  Buttons are always pills; labels are rounded squares; status colours are for
  dots and state rules only, never decoration.

## Scannability rules — do not undo these

Each came out of the decode suite, not documentation:

- Finder, timing and alignment patterns must stay **hard squares**. Styling them
  breaks grid detection outright.
- Finder pupil radius must stay in **0.7–1.4 modules**. A true inscribed circle
  (1.5) decodes 0/8.
- Non-ASCII is written as raw UTF-8 with **no ECI header**. URLs are
  percent-encoded to dodge it; free text only gets a warning.
- Keep modules at roughly **8px** when rasterising (`recommendedPx()`), or the
  decode check measures resolution instead of correctness.

## Adding a payload type

1. Add a builder to `payload` in `qr-render.js`.
2. Add the type to `TYPES` and its fields to `FIELDS` in `app.js`.
3. Add a case to `verify.html`.
