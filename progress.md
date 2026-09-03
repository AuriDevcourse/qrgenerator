# QR Generator — Progress

A QR code generator that decodes its own output before handing it to you. If a code
will not scan, you find out on the page.

**Last updated:** 2026-09-03 (built from nothing to 19 commits in one session; renamed
from "Quiet Zone"; live on Vercel but behind team SSO, which is the one open decision)

**Stack:** vanilla JS, zero npm dependencies, one build script · Node 25
**Path:** `~/qr-generator` · **Repo:** `AuriDevcourse/qrgenerator` (**public**)
**Run:** `npm start` → http://127.0.0.1:8777 · **Build:** `npm run build` → `dist/`
**Deploy:** Vercel `tech-bbq/qrgenerator`, ● Ready
**Suite:** `/verify.html`, 56 checks, 0 failures, 2 expected-fails

---

## Open decisions

> ⚠️ **The Vercel URL shows a Vercel login page.** Deployment Protection (Vercel
> Authentication) is on, the default for `tech-bbq` team projects, so anyone not signed
> in to that team hits a wall. Turn it off in Project Settings → Deployment Protection
> if it should be public. Not touched, because that makes the site world-reachable.

> ⚠️ **The GitHub repo is public**, unlike the other project repos. Nothing secret is in
> it and the TechBBQ assets it embeds are already public via `tdesignsystem.vercel.app`,
> but `CLAUDE.md` does name the internal design-system repo and branch.
> `gh repo edit AuriDevcourse/qrgenerator --visibility private --accept-visibility-change-consequences`

---

## What it is

Three tabs. **Design**: an autofocused omnibox. Paste a link, email, phone number,
coordinates, a `WIFI:` string or a whole vCard and it works out which and fills the
right fields. Everything else folds into closed `<details>` groups. **Batch**: paste a
list or drop a CSV, one verified code per row, ZIP or print sheet. **Camera test**:
decode a *printed* code through the webcam, because the in-page check only proves the
image is good.

The distinguishing feature: every code is rasterised and re-decoded with an independent
decoder before you see a verdict. Nothing else in the tool matters as much.

---

## 2026-09-03 — Built, then hardened, then renamed

Nineteen commits, newest first. The interesting entries are the bugs, not the features.

### Renamed to QR Generator (`d1619d1`)
Was "Quiet Zone". `serve.mjs` had been identifying its own instance by matching the
literal string `<title>Quiet Zone</title>`, so the rename would have silently broken
"already running" detection. It now checks a `<meta name="generator" content="qr-generator">`
tag, which is rename-proof and stricter: a decoy server returning only the matching title is
correctly rejected where the old check accepted it.

**The `localStorage` keys stay `quietzone.*` on purpose.** They hold saved styles,
recents and the theme. Renaming them would discard someone's work for nothing.
"quiet zone" elsewhere is the spec term for the clear border, not a leftover.

### Ten follow-up features (`ca23f0e` … `22a2a74`)
Undo/redo · compare all nine shape combinations, each decoded · damage tolerance ·
CSV column mapping · uploaded-mark treatment · campaign tags · redirect pages ·
four print layouts · brand token import · installable offline.

**"Dynamic short links" did not need a backend.** The code points at a page you host,
and that page forwards. "Save redirect page" writes a self-contained HTML file: put it
where the code points and the destination becomes editable without reprinting. With a
date set under Expiry the page refuses to forward, which is what makes an expiry
enforced rather than a note.

### Measured numbers worth keeping

**Damage tolerance**, by simulation (patch / scattered dropout, as % of code area):

| | L | M | Q | H |
|---|---|---|---|---|
| One covered patch | 2% | 11% | 18% | 21% |
| Scattered dropout | 2% | 3% | 4% | 7% |

Both monotonic, which is the sanity check. The nominal 7/15/25/30% figures count lost
*codewords*, not area, so they are not comparable.

**Contrast on white** (a camera needs ~3:1; anything below cannot carry the modules):

| founder-red | grit | garage | ember | purple | launch | ignite | spark | teal |
|---|---|---|---|---|---|---|---|---|
| 5.63 | 13.42 | 19.44 | 4.31 | 5.30 | 3.80 | **2.84** | **2.10** | **2.13** |

Ignite, spark and teal are therefore not offered as module colours. Importing
TechBBQ's own `tokens.json` flags them automatically.

### The XSS I introduced and then fixed (`fe2a6cc`)
The "Copy link" feature made the URL hash attacker-controlled, and `readHash()` copied
any string into state. State values are written into markup. A link setting `fg` to
`red"></span><img src=x onerror="...">` executed. **Confirmed firing in a browser, then
confirmed dead.** On the deployed site that meant reading the origin's `localStorage`
and rewriting the page, including swapping the QR destination while the verdict still
said "Scans correctly".

Fixed as a class, not an instance: `sanitizeStyle()`/`sanitizeData()` whitelist
everything a link carries, `qr-render.js` escapes every SVG attribute via `attr()`, the
built page pins its inline scripts by CSP hash, and seven assertions in `verify.html`
guard the escaping.

### Three bugs that only broke the *built* page
All invisible under `npm start`, which is the lesson:

1. **`zip.js` was missing from `build.mjs`'s inline list.** Loaded by `index.html`,
   never inlined, so the deployed page had no `QRZip` and Download ZIP threw.
2. **A closing script tag inside an inlined source.** A comment in `qr-render.js`
   *describing* that trap contained it. Inlined, it ended its own script element, the
   meta-refresh string in the same file parsed as real HTML, and the page navigated
   itself to `/+%20a%20+` on load with zero scripts running.
3. **CSP hashes computed on the wrong string.** Hashed the source before wrapping while
   emitting the body with surrounding newlines, so every script was refused and the page
   loaded completely inert.

`build.mjs` now fails the build on 1 and 2, both verified by planting the fault.

### Earlier the same day
- **Plain language in the readout** (`072b5d5`). Reported as unintuitive, fairly. It
  said "Symbol: version 3" and "Smallest usable print", which never says usable for what.
- **Copy rewrite** (`b7e8353`). 91 em dashes removed, the footer's font names and
  licences cut, and two stale suite counts corrected.
- **Design system** (`4f50da6`). The orb backdrop is now copied verbatim from
  `tdesignsystem/app/globals.css` and used as a section backdrop the way that repo uses
  it. My first attempt reinterpreted it, and my justification for dropping the blur was
  wrong: the hard edge I blamed on the compositor was the screenshot tool clipping at 80%.

---

## Next, if it continues

- Decide the Vercel protection and repo visibility questions above.
- A second decoder in the suite. Everything rests on jsQR, which is stricter than a
  phone camera, so passing is conservative but single-sourced. A ZXing harness was
  attempted and never wired up.
- Non-ASCII still has no ECI header, so `æøå` in free text can misread on fixed
  scanners. URLs are percent-encoded around it; text only warns.
