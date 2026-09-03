# Quiet Zone — QR code generator

A QR generator that **decodes its own output** before showing you the result, so an
unscannable code fails on screen instead of on a printed banner.

Runs locally. No build step to use it, no dependencies to install, no account.

```
npm start          # http://127.0.0.1:8777  — the app
                   # http://127.0.0.1:8777/verify.html — the 37-case decode suite
npm run build      # bundle into one standalone dist/quiet-zone.html
npm run batch -- people.csv --col url --name-col name --out ./out
```

**A local server is required, not optional.** The scan check draws the generated
SVG to a canvas and reads the pixels back; on a `file://` URL the canvas is
tainted and that read is blocked. `npm start` runs a zero-dependency Node static
server (`serve.mjs`) — nothing to `npm install`. Opened as a plain file the
generator still works, but it says the scan check is unavailable rather than
pretending it verified anything.

The only network request the app makes is the Google Fonts stylesheet; without it
the type falls back to the system sans stack. Encoder and decoder are vendored.

---

## What it does

Three tabs:

**Design** — nine payload types (link, text, Wi-Fi, contact, email, SMS, phone,
location, calendar event). Module shape, corner-eye shape, error correction, quiet
zone, flat or gradient fill, a separate eye colour, a centre mark, and a caption
frame. Five brand presets to start from, plus your own saved styles. Every change
is re-decoded and the verdict shown before you export.

**Batch** — paste a list or drop a CSV, get one verified code per row, download
them all as a ZIP, or lay them out on a print sheet. Uses whatever style the Design
tab is set to.

**Camera test** — the Design tab proves the *image* decodes. This proves the
*printed* code decodes: hold a print, screen or badge to the camera and see exactly
what a scanner reads. Frames are decoded in the browser; no video leaves the page.

### Getting work out

| | |
|---|---|
| Copy PNG / Copy SVG | to the clipboard (`Cmd/Ctrl+C` copies the PNG) |
| Save PNG / Save SVG | to a file (`Cmd/Ctrl+S` saves the PNG) |
| Print sheet | N copies at an exact mm width on A4 with cut guides — "Save as PDF" in the print dialog gives a vector file |
| Download ZIP | every verified code from a batch run |
| Copy link | a URL that restores the whole design, so a style can be bookmarked or sent to someone |

Saved styles and the theme choice live in `localStorage` — per browser, never sent
anywhere. A shared link carries the design and the payload, but never an uploaded
image.

## What a QR generator actually needs

Five layers. Only the first is a solved problem you should not write yourself.

**1. The encoder** — text → a matrix of dark/light modules. This is Reed–Solomon
error correction, mode selection, version sizing and mask-pattern scoring. Do not
write it. `qrcode-generator` (MIT, 57 KB, vendored in `vendor/`) does it and
auto-picks the smallest version that fits.

**2. Payload formats** — the part people actually get wrong. A QR code holds a
string; what makes it *do* something is a convention the phone OS recognises:

| Kind | Format |
|---|---|
| Link | `https://…` — must be ASCII, so percent-encode |
| Wi-Fi | `WIFI:T:WPA;S:<ssid>;P:<pass>;;` — `\` escape any `; , : "` in the values |
| Contact | vCard 3.0, `BEGIN:VCARD` … `END:VCARD` |
| Email | `mailto:a@b.c?subject=…&body=…` (URL-encoded) |
| SMS | `SMSTO:<number>:<message>` |
| Geo | `geo:<lat>,<lng>` |
| Event | iCalendar `BEGIN:VEVENT` … with `DTSTART` as `YYYYMMDDTHHMMSS` |

The escaping is not optional — a Wi-Fi password containing `;` silently produces a
code that joins the wrong network.

**3. Rendering** — turning the matrix into SVG or canvas. Where all the visual
design lives, and where scannability gets destroyed. See the constraints below.

**4. Guardrails** — capacity, contrast, quiet zone, logo size, print size. A
generator without these will happily hand you a broken code.

**5. Verification** — rasterise your own output and decode it with an independent
decoder (`jsQR` here). This is the only step that actually proves anything, and
almost no generator does it.

## Rendering constraints, found by testing

Every one of these came out of `verify.html` / `probe.html`, not from documentation:

- **Never style the function patterns.** The three corner finders, the timing runs
  on row/column 6, and the alignment patterns must stay hard squares — decoders
  locate the grid by their run-length ratios. Rounding or dotting them took the
  dots style from 0/8 decodes to 8/8 once fixed. Style only the data modules.
- **A circular pupil in a round "eye" breaks it.** The finder centre inscribed as a
  true circle (radius 1.5 modules) decoded **0/8**. Radius 0.7–1.4 decoded **8/8**.
  The code defaults to 1.2 and pins the geometry rather than deriving it.
- **Non-ASCII has no encoding marker.** `qrcode-generator` writes UTF-8 bytes with
  no ECI header, so a strict decoder misreads `æøå` — verified: it decoded to an
  empty string. Percent-encoding fixes it for URLs (done automatically). For free
  text the app warns; phone cameras cope, fixed industrial scanners may not.
- **Resolution masquerades as a rendering bug.** A 1200-character code at 400 px is
  ~2.4 px per module and fails to decode. `recommendedPx()` keeps modules at 8 px.
- **Rounded corners must be neighbour-aware.** Round a corner only where no
  orthogonal neighbour sits, so adjacent modules merge into one smooth shape
  instead of a grid of separate lozenges.
- **Logos work by sacrifice.** A centre logo blanks real modules; error correction
  H (30%) rebuilds them. At 30% width with EC-L the code dies — that case is in the
  test suite as an *expected* failure.
- **A gradient is only as scannable as its weakest stop.** The brand orange
  `#fa7000` is 2.84:1 on white — under the 3:1 floor — while `#ce0f2e` is 5.63:1.
  The contrast check reports the worse of the two stops and names it, instead of
  averaging them into a passing number.

## Sizing for print

Two rules of thumb the app computes for you:

- Modules should be **≥ 0.4 mm** in print. Width = `(modules + 2 × quiet zone) × 0.4 mm`.
- A code scans from roughly **10× its own width**. So for 2 m, print ~20 cm wide.

The quiet zone is 4 clear modules on every side. It is in the name of this tool
because it is the single most commonly skipped requirement.

## Styling

Styled on the **TechBBQ design system** (`~/Documents/GitHub/tdesignsystem`, branch
`feat/design-system`), with tokens taken from `app/globals.css` and
`public/brand/tokens.json`:

- Onest for headings (`-0.02em` tracking), Inter for body; no third webfont — the
  numeric readouts use Inter with `tabular-nums`, and only the payload/hex fields
  use the system monospace stack.
- Dark palette: `#0d0d0d` page, `#131313` cards at 14px radius, `#f2f2f2` text,
  `#9a9a9c` muted, `#2a2a2a` hairlines. TechBBQ runs dark, so this commits to one
  theme and paints every colour explicitly rather than following the host theme.
- Buttons are **always pills**; the primary CTA is the light pill (`#f2f2f2` on
  dark). Labels are rounded squares (8px) — pills are reserved for buttons.
- Segmented controls follow `components/ui/segmented.tsx`: pill track on `#191919`,
  selected thumb is a light pill. Inputs follow `components/ui/input.tsx`: 50px
  tall, 8px radius, `#131313` fill, `#d9d9d9` @ 40% border.
- Status colours (`#00c11a` success, `#fd9d04` spark, `#ce0f2e` founder red) appear
  only as dots and state rules, per the system's "functional colours only" rule.
- The signature warm gradient carries the capacity meter, and the brand orb glow
  sits behind the page. The system blurs a flat orb; here the glow is painted as a
  radial gradient directly — same look, one less compositing layer, and no 1500px
  blur surface to render.
- The centre mark is the real brand asset: the path from
  `public/brand/icon-gradient.svg`, inlined as vector (not an embedded raster) in
  gradient, founder red, white and black.

The QR itself defaults to **founder red on white** (5.63:1). Brand-accurate *and*
correctly oriented — dark modules on a light ground is what every scanner expects.
Light-on-dark is available but the app flags it.

## Files

| File | |
|---|---|
| `qr-render.js` | matrix → SVG paths, payload builders, capacity/contrast helpers. Runs in both Node and the browser. |
| `app.js` · `index.html` · `styles.css` | the web app |
| `verify.html` | 30-case suite: renders, rasterises, re-decodes, reports |
| `probe.html` | geometry sweeps — how the numbers above were found |
| `batch.mjs` | CSV → one SVG per row, from the command line |
| `zip.js` | store-only ZIP writer for the in-browser batch export |
| `build.mjs` | bundles everything into one standalone `dist/quiet-zone.html` |
| `serve.mjs` | zero-dependency static server for local use |
| `vendor/qrcode.js` | the encoder (MIT, Kazuhiko Arase) |
| `vendor/jsqr.js` | the decoder used by the scan check (Apache-2.0, jsQR) |

`verify.html` and `probe.html` need a server, not `file://` — blob URLs and canvas
`getImageData` are blocked on the file protocol.
