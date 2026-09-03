# Quiet Zone

A QR code generator that decodes its own output before handing it to you. If a
code will not scan, you find out on the page.

Runs locally. Nothing to install, no account, no network.

```
npm start          # http://127.0.0.1:8777
                   # http://127.0.0.1:8777/verify.html  (43-case decode suite)
npm run build      # bundle into dist/ as one standalone HTML file
npm run batch -- people.csv --col url --name-col name --out ./out
```

Start it twice and it says so and exits. If another program holds the port, pass
a different one: `npm start -- 8778`.

**It needs a server.** The scan check draws the SVG to a canvas and reads the
pixels back, which browsers block on `file://` URLs. `npm start` runs a Node
static server with no dependencies. Open the page as a file and it still
generates codes, but it reports the scan check as unavailable instead of
claiming a pass.

The app requests one thing over the network: the Google Fonts stylesheet. Without
it the type falls back to the system sans stack. Encoder and decoder are vendored.

---

## What it does

**Design.** The page opens focused on one field. Paste a link, an email address,
a phone number, coordinates, a `WIFI:` string or a whole vCard, and it works out
which one you gave it and fills the right fields. A Wi-Fi string arrives as
network, password and security rather than raw text.

Every colour control names what it changes: modules are "the squares that carry
the data", background is "behind the squares, including the quiet zone". Closed
groups show their current colours as swatches in the header, so you can see the
palette without opening anything. The TechBBQ mark comes in gradient, founder red,
white, black or any colour you pick.

The rest folds away: colour, shape and correction, centre mark, caption frame,
expiry.
Each preset draws itself as a thumbnail so you can pick a look by eye. Colour
comes as one-click brand pairs, print size as sticker/badge/flyer/poster/banner
rather than millimetres. Your last eight codes sit one click away. Every change
gets decoded and the verdict shown before you export.

`/` jumps to the field. `Enter` copies the code.

**Batch.** Paste a list or drop a CSV. You get one verified code per row, a ZIP
of all of them, or a print sheet. Styling comes from the Design tab.

**Camera test.** The Design tab checks the image. This checks the print: hold a
printed code to the camera and read what a scanner reads. Frames decode in the
browser and no video leaves the page.

### Getting work out

| | |
|---|---|
| Copy PNG / Copy SVG | to the clipboard (`Enter` or `Cmd/Ctrl+C` copies the PNG) |
| Save PNG / Save SVG | to a file (`Cmd/Ctrl+S` saves the PNG) |
| Print sheet | N copies at an exact mm width on A4 with cut guides. "Save as PDF" in the print dialog gives a vector file. |
| Download ZIP | every verified code from a batch run |
| Copy link | a URL that restores the whole design, so you can bookmark a style or send it on |

Saved styles and your theme choice live in `localStorage`, per browser. A shared
link carries the design and the payload, never an uploaded image.

## What a QR generator needs

Five layers. Only the first is solved for you.

**1. The encoder.** Text to a matrix of dark and light modules: Reed-Solomon
error correction, mode selection, version sizing, mask scoring. Do not write it.
`qrcode-generator` (MIT, 57 KB, in `vendor/`) picks the smallest version that
fits.

**2. Payload formats.** This is the part that goes wrong. A QR code holds a
string, and a convention the phone recognises is what makes it do something:

| Kind | Format |
|---|---|
| Link | `https://…`, ASCII only, so percent-encode |
| Wi-Fi | `WIFI:T:WPA;S:<ssid>;P:<pass>;;` with `\` before any `; , : "` in a value |
| Contact | vCard 3.0, `BEGIN:VCARD` … `END:VCARD` |
| Email | `mailto:a@b.c?subject=…&body=…` (URL-encoded) |
| SMS | `SMSTO:<number>:<message>` |
| Geo | `geo:<lat>,<lng>` |
| Event | iCalendar `BEGIN:VEVENT` with `DTSTART` as `YYYYMMDDTHHMMSS` |

Skip the escaping and a Wi-Fi password containing `;` produces a code that joins
the wrong network, with no error to tell you.

**3. Rendering.** The matrix becomes SVG or canvas. All the visual design lives
here, and so does every way to destroy scannability. See below.

**4. Guardrails.** Capacity, contrast, quiet zone, mark size, print size. Without
them a generator will hand you a broken code and say nothing.

**5. Verification.** Rasterise your own output and decode it with a second
decoder (`jsQR` here). Nothing else proves the code works.

## Rendering constraints found by testing

These came out of `verify.html` and `probe.html`, not documentation:

- **Never style the function patterns.** The three corner finders, the timing
  runs on row and column 6, and the alignment patterns stay hard squares.
  Decoders locate the grid by their run-length ratios. Rounding or dotting them
  took the dots style from 0/8 decodes to 8/8 once fixed. Style the data modules
  only.
- **A circular pupil in a round eye breaks it.** A finder centre inscribed as a
  true circle (radius 1.5 modules) decoded 0/8. Radius 0.7 to 1.4 decoded 8/8.
  The default is 1.2, pinned rather than derived.
- **Non-ASCII carries no encoding marker.** `qrcode-generator` writes UTF-8 bytes
  with no ECI header, so a strict decoder misread `æøå` as an empty string.
  Percent-encoding fixes URLs, which the app does for you. For free text it warns:
  phone cameras cope, some fixed scanners do not.
- **Low resolution looks like a rendering bug.** A 1200-character code at 400 px
  gives 2.4 px per module and fails to decode. `recommendedPx()` holds modules at
  8 px.
- **Rounded corners need to know their neighbours.** Round a corner only where no
  orthogonal neighbour sits, so runs of modules merge into one shape instead of a
  grid of lozenges.
- **A mark works by sacrifice.** It blanks real modules and error correction H
  (30%) rebuilds them. At 30% width with EC-L the code dies, which sits in the
  suite as an expected failure.
- **A gradient is only as scannable as its weakest stop.** Brand orange `#fa7000`
  is 2.84:1 on white, under the 3:1 floor, where `#ce0f2e` is 5.63:1. The
  contrast check reports the worse stop and names it rather than averaging the
  two into a passing number.

## Expiry

A QR code cannot expire. The pattern is fixed once printed and decodes to the same
string for ever, so nothing in the image stops working. The Expiry group says this
on the page rather than implying otherwise, and gives you the two things that are
real:

- **Tag the link.** Ticking "Add `?exp=` to the link" appends the date as a query
  parameter, so your own redirect or landing page can check it and stop serving
  the destination. Nothing outside your control reads it.
- **Know when to reprint.** The date shows in the readout and in the one-line
  summary as days remaining, warns inside 14 days, and turns red once passed.

For anything printed, point the code at a URL you control and redirect from there.
The destination can then move without a reprint.

## Sizing for print

The panel shows two widths next to each other, because they answer different
questions:

- **The smallest it can ever go.** Modules have to stay at 0.4 mm or more, so the
  width is `(modules + 2 × quiet zone) × 0.4 mm`. Go under it and phone cameras
  start missing the code.
- **The width for a reading distance.** A code scans from about 10 times its own
  width, so 2 m needs 20 cm across. Type a distance, or use the sticker / badge /
  flyer / poster / banner chips.

The quiet zone is 4 clear squares on every side, and it is the requirement people
skip.

## Styling

Built on the TechBBQ design system in `~/Documents/GitHub/tdesignsystem` (branch
`feat/design-system`), using the tokens in `app/globals.css` and
`public/brand/tokens.json`. Onest and Inter, dark by default with a light theme,
pill buttons, founder red. The orb backdrop is copied from the system's own CSS
and used the way it uses it, as a section backdrop on the header band. The centre
mark is the real brand asset from `public/brand/icon-gradient.svg`, inlined as
vector. `CLAUDE.md` holds the rules that matter when changing any of it.

Codes default to founder red on white, which measures 5.63:1 and puts dark
modules on a light ground, the orientation scanners expect. Light-on-dark is
available and the app flags it.

## Files

| File | |
|---|---|
| `qr-render.js` | matrix to SVG paths, payload builders, paste detection, capacity and contrast helpers. Runs in Node and the browser. |
| `app.js` · `index.html` · `styles.css` | the web app |
| `verify.html` | 43-case suite: renders, rasterises, re-decodes, reports |
| `probe.html` | the geometry sweeps the numbers above came from |
| `batch.mjs` | CSV to one SVG per row, from the command line |
| `zip.js` | store-only ZIP writer for the in-browser batch export |
| `build.mjs` | bundles everything into one standalone `dist/quiet-zone.html` |
| `serve.mjs` | static server, no dependencies |
| `vendor/qrcode.js` | the encoder (MIT, Kazuhiko Arase) |
| `vendor/jsqr.js` | the decoder behind the scan check (Apache-2.0, jsQR) |

`verify.html` and `probe.html` need a server. Blob URLs and canvas
`getImageData` do not work on the file protocol.
