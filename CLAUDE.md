# Quiet Zone: working notes

QR code generator that verifies its own output. Vanilla JS, no framework.

## Ground rules

- **`qr-render.js` is UMD** and must load as CommonJS in Node. Do **not** add
  `"type": "module"` to `package.json`; it breaks the renderer and `batch.mjs`.
  `build.mjs` and `batch.mjs` are `.mjs`, so they are ESM by extension already.
- **`dist/` is generated.** Edit `index.html`, `app.js` and `styles.css`, then
  `npm run build`. It writes the same self-contained page twice:
  `dist/index.html`, which Vercel serves as the site root, and
  `dist/quiet-zone.html` for handing someone a single file. Never hand-edit
  either. `vercel.json` points `outputDirectory` at `dist`.
- **A server is required to run anything.** `npm start` (`serve.mjs`, no deps).
  The scan check reads canvas pixels back, which `file://` forbids, so the app
  reports "scan check unavailable" there rather than claiming a pass.
- **Verify before committing.** Open `/verify.html` and require **0 fail**.
  Expected-fails (`xfail` and `risky` cases) are fine. The suite has 43 cases.
- **Encoder and decoder are vendored** in `vendor/`. Keep them local. The project
  exists to work without a network.
- **Styling follows the TechBBQ design system** at
  `~/Documents/GitHub/tdesignsystem` (branch `feat/design-system`). Tokens:
  `app/globals.css` + `public/brand/tokens.json`. Components: `components/ui/`.
  Buttons are always pills; labels are rounded squares; status colours are for
  dots and state rules only, never decoration.
- **The orb backdrop is copied verbatim** from that repo's `globals.css`: exact
  gradient stops, `blur(40px)`, `mix-blend-mode: screen`, the 16s/22s drift and
  the `--subtle` variant. Do not "improve" it. The system uses it as a section
  backdrop (`position: absolute` inside a `relative overflow-hidden` band) rather
  than a page-wide fixed wash, so it lives on the `.cover` header band with
  `fade={false}`.
- **Chrome colours are tokens** (`--pill-on-bg`, `--outline-line`, `--chip-bg`
  and so on) so the always-dark `.cover` can re-scope them instead of every
  light-theme rule needing an exception. Add new chrome colours as tokens.
  `--surface` feeds the focus ring, so the cover must keep it light.

## Scannability rules, do not undo these

Each came out of the decode suite, not documentation:

- Finder, timing and alignment patterns must stay **hard squares**. Styling them
  breaks grid detection.
- Finder pupil radius must stay in **0.7–1.4 modules**. A true inscribed circle
  (1.5) decodes 0/8.
- Non-ASCII is written as raw UTF-8 with **no ECI header**. URLs are
  percent-encoded to dodge it; free text only gets a warning.
- Keep modules at **8px** when rasterising (`recommendedPx()`), or the decode
  check measures resolution instead of correctness.

## Structure

`app.js` is one IIFE in sections: payload definitions, state, persistence,
share links, theme, form rendering, rasterising, the design render loop, readout,
warnings, exports, print, batch, camera, tabs, wiring, boot.

- **`state` holds everything**, and `syncControls()` pushes it back into the DOM.
  Anything that changes state from outside a control (a preset, a shared link)
  calls it rather than setting inputs by hand.
- **`STYLE_KEYS` defines what a preset and a shared link carry:** the look, never
  the payload and never an uploaded image, which would not fit in a URL. Add new
  visual options to that list or they will not persist.
- **No modal dialogs.** `alert`, `confirm` and `prompt` block the page and read as
  unfinished. Print options are inline inputs for that reason.
- **The print sheet is a generated document rather than a PDF writer.** The
  browser renders the SVG as vector and its own dialog saves the PDF.

## The fast path is the point

The Design tab is ordered by how often something is needed, not by how the code
is built. Keep it that way:

- **The omnibox comes first and is autofocused.** `R.detect()` in `qr-render.js`
  works out what was pasted. `SIMPLE` in `app.js` lists the types whose whole
  payload is one string, so the omnibox drives them directly. Everything else
  gets the detail grid, prefilled by the parsers.
- **Styling lives in closed `<details>` groups.** Native disclosure, so keyboard
  and screen readers work without extra code. Keep the fast path at one field:
  do not promote an option out of the groups without a reason.
- **Never steal keys from something focusable.** The global shortcut handler bails
  on `input, textarea, select, button, a, summary, [role=button]`. Without that,
  Enter on a focused button copies the code instead of pressing the button.
- **Colour chips must clear the contrast floor.** Brand teal is 2.13:1 on white
  and ignite orange 2.84:1, so neither gets a chip. Check with
  `R.contrast(colour, '#ffffff')` before adding one.

## Expiry is honest, keep it that way

A static QR code cannot expire, and the UI says so in the group itself. The date
does two real things: it appends `?exp=` to a link payload when asked, and it
drives the reprint reminder in the readout. Do not reword the callout into
something that implies the code stops working, and do not add an "expired" state
that blocks generation. Expiry lives in `state.expiry` / `state.expiryInLink`,
travels in a shared link under `x`, and stays out of `STYLE_KEYS` because it is
content rather than look.

## Adding a payload type

1. Add a builder to `payload` in `qr-render.js`.
2. Add a branch to `R.detect()` so pasting one is recognised, plus a label in
   `LABELS`, and a parser if the format is structured.
3. Add the type to `TYPES` and its fields to `FIELDS` in `app.js`.
4. Add cases to `verify.html`: one for the payload, one for the detection.

## Adding a visual option

1. Add it to `opts()` and handle it in `qr-render.js`.
2. Add its key to `STYLE_KEYS` so presets and links keep it.
3. Handle it in `syncControls()`.
4. **Add a decode case to `verify.html`.** Anything that changes the pixels can
   break scanning, and a gradient or frame that looks fine can still fail.
