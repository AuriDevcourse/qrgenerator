# QR Generator: working notes

QR code generator that verifies its own output. Vanilla JS, no framework.

## The name

Called **QR Generator**. It was "Quiet Zone" until 2026-09-03, which is why:

- **The `localStorage` keys are still `quietzone.*`.** They hold saved styles,
  recents and the theme. Renaming them would discard someone's work for a
  cosmetic gain, so they stay.
- **`serve.mjs` no longer keys its already-running check off the page title.**
  It looks for `<meta name="generator" content="qr-generator">` instead, so a
  future rename cannot silently break it. Keep that tag in `index.html`.
- "quiet zone" still appears throughout as the spec term for the clear border.
  That is the real concept, not a leftover.

## Ground rules

- **`qr-render.js` is UMD** and must load as CommonJS in Node. Do **not** add
  `"type": "module"` to `package.json`; it breaks the renderer and `batch.mjs`.
  `build.mjs` and `batch.mjs` are `.mjs`, so they are ESM by extension already.
- **`dist/` is generated.** Edit `index.html`, `app.js` and `styles.css`, then
  `npm run build`. It writes the same self-contained page twice:
  `dist/index.html`, which Vercel serves as the site root, and
  `dist/qr-generator.html` for handing someone a single file. Never hand-edit
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

## A shared link is untrusted input

`readHash()` parses an attacker-controlled URL. Every value it carries goes
through `sanitizeStyle()` / `sanitizeData()` first: enums are whitelisted,
numbers clamped, colours matched against `#rgb` or `#rrggbb`, strings capped.
This is not decoration. Before it existed, a crafted "Copy link" URL put
`red"></span><img src=x onerror=...>` into `state.fg`, which `dot()` wrote
straight into `innerHTML`, and it executed.

- **Never write a state value into markup without validating it.** `colour()`
  is the gate for anything that reaches a `style` attribute.
- **`qr-render.js` escapes every interpolated attribute** through `attr()`.
  Keep it that way even though callers validate too; it is the second layer.
- **`localStorage` presets go through the same gate**, because an injection
  could have written them.
- **The built page pins its four inline scripts by CSP hash.** `build.mjs`
  hashes the exact element body, whitespace included. Hash the string you emit,
  not the source before wrapping, or every script is refused.
- Seven assertions in `verify.html` cover the escaping. They are not decode
  tests; do not delete them when trimming cases.

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

## Plain language in the readout

The readout used to be written in spec vocabulary: "Symbol: version 3", "Module
grid", "Smallest usable print". A user told me it was unintuitive and they were
right. It now says what things are ("29 × 29 squares", "Clear border", "Survives
damage to") and the two print widths sit side by side with a sentence each, so
the link between size and reading distance is visible. Do not put the jargon
back. `verify.html` and the code comments keep the spec terms; the UI does not.

One accuracy note: the capacity label says **bytes**, not characters. Danish
`æ` costs two, so "characters" would be wrong.

## Never spell out a closing script tag in a source that gets inlined

`build.mjs` refuses any file in `INLINED` containing one, because the built page
wraps each bundle in a `<script>` element and that tag ends it. Everything after
becomes markup. It has bitten three times:

1. `redirectPage()` emitting a hostile destination through `JSON.stringify`.
2. A comment in `verify.html`, which hung the suite at "running...".
3. A comment in `qr-render.js` describing bug 1, which broke the built page
   entirely: the meta-refresh string in the same file then parsed as real HTML
   and navigated the app away on load.

Number 3 only appeared in `dist`, never in the dev page, because the dev page
loads the file with `src`. Test the built output, not only `npm start`.

## Generating HTML is where the injections live

`R.redirectPage()` writes a page from a user-supplied destination, so it is in
`qr-render.js` rather than `app.js` purely to be unit-testable, and three
assertions in `verify.html` cover it.

- **`JSON.stringify` is not enough for a string inside a `<script>`.** It leaves
  a literal closing script tag intact, which ends the element and turns the rest
  into markup. `jsString()` escapes `<`, `>` and `&` as unicode. My first version
  shipped two script elements for a hostile destination.
- **The same trap bit the test file.** A comment in `verify.html` containing that
  closing tag terminated the inline script and hung the whole suite at
  "running...". No inline script block may contain the sequence, comments
  included.
- The destination reaches an href, a JS string and visible text. Each gets its
  own encoding; do not reuse one for all three.

## Uploaded marks

`inspectLogo()` samples the image at 40x40, buckets colours 32 per channel and
returns the biggest bucket plus mean luminance. Transparent pixels are skipped,
or a PNG with a clear background reports as mid-grey.

- **A plate only does something in a colour other than the background.** The
  window modules are already blanked, so a plate in the background colour is
  invisible. It exists for dark artwork on a dark ground.
- **Warn before the click, not after.** Matching the code to a logo colour can
  drop it under 3:1. The panel states the ratio and the button becomes "Match
  anyway"; it used to apply the colour and let the verdict fail afterwards.

## The build guard exists for a reason

`build.mjs` compares the `<script src="./...">` tags in `index.html` against its
own `INLINED` list and fails the build on a mismatch. `zip.js` was in the dev
page but missing from that list, so the built page had no `QRZip` and Download
ZIP threw on the deployed site while working locally. Add a script to both, or
the build stops.

## Damage tolerance, and two ways it went wrong

Paints damage onto the rendered code and binary-searches the largest fraction
that still decodes. Both mistakes are worth remembering, because both produced
confident numbers that were wrong:

- **Scatter must skip function modules.** The first version picked random
  modules across the whole grid. Finder, timing and alignment patterns are 24%
  of a version-3 symbol, so a 2% scatter nearly always destroyed one, and the
  result measured grid detection rather than error recovery. It reported 0% at
  level H while a single patch survived 21%. `R.isFunctionModule()` exists for
  this; use it.
- **One seed is one sample.** With a single fixed seed, scatter came out
  non-monotonic across levels (Q above H). It is the median of three seeds now.
  A sweep of L/M/Q/H should be monotonic in both models; if it is not, the
  method is broken, not the codes.
- The patch is placed off the finders deliberately. Covering one kills any code
  at any level and measures nothing.

## Compare grid

Nine shape combinations, each decoded through the same `decodeCheck()` the main
preview uses. Rendering is gated on the `<details>` being open and debounced from
`render()`: nine encodes and nine decodes per keystroke would be wasted work while
it is closed. Decodes run one at a time so the grid stays responsive, and a run
token drops results from a superseded run.

## Undo history

Snapshots hold the payload and the look, pushed from `render()` behind a 400 ms
debounce so a slider drag settles into one entry. `restore()` sets `past.muted`
so replaying a snapshot does not record itself.

- **An uploaded image is deliberately not in a snapshot.** A base64 data URI in
  sixty entries costs megabytes, so undo restores the design around an upload,
  not the upload.
- **Snapshots go back through `sanitizeStyle()`/`sanitizeData()`.** They are the
  same shape as a shared link and get the same gate.
- **`Cmd+Z` inside a text field belongs to the browser.** `inTextField()` bails
  so typing undo still works. Both global key handlers use `inTextField()` /
  `inFocusable()`, which check that `closest` exists first: a key event
  dispatched at the document has no `closest` and threw before that guard.

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
