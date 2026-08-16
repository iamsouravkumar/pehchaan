# Pehchaan

**Share your document. Not your identity.**

Hide the parts they don't need: the Aadhaar number, the address, the photo. Then
stamp what the copy is for. Runs entirely in your browser. Your document never
leaves your device.

**Live: [usepehchaan.vercel.app](https://usepehchaan.vercel.app)**

---

## The problem

Handing over a photocopy of an ID is routine in India. A landlord, a hotel front
desk, a SIM counter, an admissions office: each one takes a full copy of a
document that carries far more than they need. The common defence is a pen
scribble across a photocopy, which is inconsistent, illegible, and useless
against anything already printed.

The online alternatives are worse. Every "redaction tool" that works in a
browser asks you to upload the document you are trying to protect.

## Using it

Open [usepehchaan.vercel.app](https://usepehchaan.vercel.app) and press **Open
Pehchaan**. Nothing to install, no account, no sign-in. Four steps.

### 1. Add your document

Drop in a photo or a PDF, or click to choose one. JPG, PNG, WEBP and PDF up to
25 MB. A phone photo is fine; the page is straightened by its EXIF orientation
and everything else in the file, GPS included, is discarded as it is drawn.

Nothing is uploaded. The badge in the corner counts requests leaving your
device, and it stays at zero.

### 2. Review what is hidden

The document is read on your device and the sensitive fields come back as
labelled boxes.

- **Solid boxes** were found and verified: an Aadhaar number whose checksum
  passes, a PAN in the right format, a face.
- **Dashed boxes** are guesses. Check them.
- **Every box is yours to change.** Drag it, resize it from any corner, switch
  its label, or delete it with the ✕.
- **Draw your own** with **+ Draw a box**, then drag across anything the reader
  missed. This is expected, not a fallback.
- **Block or blur** per box. Blur is disabled for numbers, because a blurred
  fixed-pitch digit can be guessed back.
- **Zoom** to 1×, 2× or 3× when a field is too small to box accurately on a
  phone.
- **Multi-page PDFs** get a page bar; boxes belong to the page you drew them on.

If nothing is found, the step blocks with a warning and you have to confirm you
have checked the page yourself. It will not quietly let you export an untouched
document.

### 3. Add a purpose

Pick who the copy is for. Each preset un-hides only what that recipient
legitimately needs, and says so in a line under the chips:

| Preset | Stays visible |
|---|---|
| Bank KYC | Name, photo, date of birth, address, PAN |
| Rental agreement | Name, photo, address |
| College admission | Name, photo, date of birth, roll number |
| SIM verification | Name, photo, address |
| Hotel check-in | Name, photo |

No preset ever reveals the Aadhaar number or the VID. Presets only un-hide, and
nothing un-hides a field on its own, so a preset can never expose something you
had already covered.

The purpose is stamped diagonally across the copy: *For Bank KYC only · 16 Aug
2026*. Today's date is generated and cannot be edited, since a back-dated stamp
would be worth nothing. Edit the text freely, or turn the stamp off.

### 4. Save

Choose image or PDF and save. What you saw on the preview is what lands in the
file: the same operation at full resolution.

The hidden parts are gone from the pixels. Not covered by a layer that can be
dragged away, not an annotation a PDF reader can hide. The exported PDF carries
no text layer and no fonts, so there is nothing underneath to recover.

### Offline

Load the site once, turn off your network, and it still works: reading,
detecting, redacting and saving. That is the proof that needs no explanation.

## Why it can't leak your document

There is no backend. Not "a backend that doesn't store anything": no server
component exists at all. The app is a static export of HTML, JavaScript and
WASM.

- **Zero third-party requests at runtime.** The OCR engine, its WASM cores, the
  language data, the face model, the PDF renderer and the fonts are all served
  from this app's own origin. A build step (`scripts/scrub-cdn.mjs`) rewrites any
  CDN URL a dependency ships with, then **fails the build** if one survives.
- **A visible counter.** The header shows how many requests went to any other
  origin since the page loaded. If it ever reads above zero, you see it.
- **No storage.** No `localStorage`, no `IndexedDB`, no cookies. The document
  lives in memory and a refresh wipes it. (A service worker caches *the app* so
  it works offline. It never touches your document.)
- **Redaction is destructive.** Pixels are overwritten and the image is
  re-encoded.

## What it detects

| Field | How |
|---|---|
| Aadhaar number | 12 digits, validated with the Verhoeff checksum |
| VID | The 16-digit virtual ID printed under it on newer cards |
| PAN | Format-locked `AAAAA9999A`, with per-position OCR correction |
| Date of birth | `DD/MM/YYYY` and labelled year-of-birth forms |
| Address | Anchor word to PIN-code terminator |
| Name | Labelled person names: candidate, student, father, mother, guardian |
| Roll / registration / account / phone numbers | Label anchors, beside or below |
| Photograph | MediaPipe BlazeFace over a pyramid of windows |
| QR code | `BarcodeDetector` where available, otherwise located geometrically |

Documents are rarely photographed well, so the page is prepared before it is
read: enlarged if it is small, and contrast-stretched either way. A laminated
card under a ceiling light is grey on grey, and without that step the reader
returns letters where the digits are.

Four decisions worth naming:

**A failed checksum is a suggestion, not a rejection.** The usual reason a real
Aadhaar number fails Verhoeff is that OCR misread one digit, which is exactly
when you still need the box. It appears dashed and enabled. A false positive
costs one click; a miss costs an identity.

**The QR is located, never decoded.** An Aadhaar QR holds the whole demographic
record. Decoding it would mean this tool reading the data it exists to protect,
so it finds the symbol by its three finder patterns and covers it.

**A photograph is searched for at several scales.** The face model reduces
whatever it is given to 128 pixels square, so what matters is the fraction of
the frame a face fills, not how many pixels it has. An Aadhaar photo resolves
against half-page windows; a PAN photo needs quarter-page ones.

**Marksheets have no format.** Every board prints its own, so nothing there can
be verified the way a checksum verifies a number. Detection is anchored on
labels instead, including the table layouts that put the heading in one cell and
the value in the cell below it.

Detection is a starting point and the interface says so. Review is mandatory and
can never be auto-advanced.

## Running it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

`predev` and `prebuild` vendor the OCR, WASM and PDF assets from `node_modules`
into `public/`. Those directories are generated, not committed, so a dependency
bump can't leave a stale copy behind.

```bash
npm run build        # static export to out/, then the CDN scrub + assertion
npm test             # 106 tests, node:test, no framework
```

To exercise offline mode, serve the build (`cd out && python -m http.server
4173`) and load it over `localhost`. A service worker needs a secure context,
which a plain-http LAN address is not.

## Layout

```
app/            landing page (/) and the wizard (/tool)
components/     canvas, box overlay, panels, controls
lib/
  ocr/          Tesseract lifecycle, image preparation, Verhoeff
  detect/       aadhaar, pan, generic, face, qr, qrLocate
  redact/       destructive pixel overwrite, purpose stamp
  export/       image and hand-written PDF writer
  image/        EXIF orientation, downscale, metadata strip
scripts/        asset vendoring, CDN scrub
docs/           PRD, TRD, DESIGN, LANDING
```

Tests live beside what they test. `lib/` files import each other with explicit
`.ts` so `node --test` runs them directly, with no build step and no test runner
dependency.

## Known limits

Stated rather than hidden. Each is a deliberate trade.

- **English OCR only.** Aadhaar cards are bilingual and the Hindi text is not
  read. Numbers are language-independent, so the highest-value target is
  unaffected.
- **Marksheet coverage is as good as its labels.** A field whose label this
  doesn't know is not found, and you box it yourself. Marks and subject names
  are left alone deliberately: hiding them makes the document useless.
- **A QR needs all three of its corner patterns.** A crop that cuts through the
  symbol cannot be located, and a card photographed at close to 45° is at the
  edge of what the geometry tolerates.
- **Very low-quality photos will fail detection**, and the app says so loudly
  instead of exporting a document it did nothing to.
- **No authenticity checking.** Pehchaan redacts documents; it does not verify
  that one is genuine.
- **Light theme only.** Dark mode is authored as tokens but not built.

## Test data

Every document used in development and in the demo is fabricated. No real ID
appears in this repository, its history, or the demo video.

## Licence

MIT, see [LICENSE](LICENSE).

The vendored face-detection model in `vendor/` is Google's BlazeFace, published
under Apache-2.0 as part of MediaPipe. Tesseract, PDF.js and the IBM Plex and
Newsreader typefaces carry their own licences, all permissive.

---

Built for CodeStorm 2026: FutureForge. Design and product notes are in `docs/`;
`DEMO.md` and `PHONE-PASS.md` cover recording and device testing.
