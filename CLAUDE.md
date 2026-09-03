# Quiet Zone — working notes

QR code generator that verifies its own output. Vanilla JS, no framework.

## Ground rules

- **`qr-render.js` is UMD** and must load as CommonJS in Node. Do **not** add
  `"type": "module"` to `package.json` — it breaks the renderer and `batch.mjs`.
  `build.mjs` / `batch.mjs` are `.mjs`, so they are ESM by extension already.
- **`dist/` is generated.** Edit `index.html` / `app.js` / `styles.css`, then
  `npm run build`, which bundles them into one standalone `dist/quiet-zone.html`.
  Never hand-edit that file.
- **A server is required to run anything.** `npm start` (`serve.mjs`, zero deps).
  The scan check reads canvas pixels back, which `file://` forbids — the app
  degrades to "scan check unavailable" there rather than claiming a false pass.
- **Verify before committing.** Open `/verify.html` and require **0 fail**.
  Expected-fails (`xfail` / `risky` cases) are fine.
- **Encoder and decoder are vendored** in `vendor/`. Keep them local — the point
  of the project is that it works without a network.
- **Styling follows the TechBBQ design system** at
  `~/Documents/GitHub/tdesignsystem` (branch `feat/design-system`). Tokens:
  `app/globals.css` + `public/brand/tokens.json`. Components: `components/ui/`.
  Buttons are always pills; labels are rounded squares; status colours are for
  dots and state rules only, never decoration.
- **The orb backdrop is copied verbatim** from that repo's `globals.css` — exact
  gradient stops, `blur(40px)`, `mix-blend-mode: screen`, the 16s/22s drift and
  the `--subtle` variant. Do not "improve" it. The system uses it as a
  section backdrop (`position: absolute` inside a `relative overflow-hidden`
  band), not as a page-wide fixed wash, so it lives on the `.cover` header band
  with `fade={false}`.
- **Chrome colours are tokens** (`--pill-on-bg`, `--outline-line`, `--chip-bg`,
  …) so the always-dark `.cover` can re-scope them instead of every light-theme
  rule needing an exception. Add new chrome colours as tokens, and remember
  `--surface` feeds the focus ring — the cover must keep it light.

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

## Structure

`app.js` is one IIFE in sections: payload definitions, state, persistence,
share links, theme, form rendering, rasterising, the design render loop, readout,
warnings, exports, print, batch, camera, tabs, wiring, boot.

- **`state` holds everything**, and `syncControls()` pushes it back into the DOM.
  Anything that changes state from outside a control (a preset, a shared link)
  must call it rather than setting inputs by hand.
- **`STYLE_KEYS` defines what a preset and a shared link carry** — the look, never
  the payload and never an uploaded image (it would not fit in a URL). Add new
  visual options to that list or they will not persist.
- **No modal dialogs.** `alert`, `confirm` and `prompt` block the page and read as
  unfinished; print options are inline inputs for that reason.
- **The print sheet is a generated document, not a PDF writer.** The browser
  renders the SVG as vector and its own dialog saves the PDF.

## Adding a payload type

1. Add a builder to `payload` in `qr-render.js`.
2. Add the type to `TYPES` and its fields to `FIELDS` in `app.js`.
3. Add a case to `verify.html`.

## Adding a visual option

1. Add it to `opts()` and handle it in `qr-render.js`.
2. Add its key to `STYLE_KEYS` so presets and links keep it.
3. Handle it in `syncControls()`.
4. **Add a decode case to `verify.html`** — anything that changes the pixels can
   break scanning, and a gradient or frame that looks fine can still fail.
