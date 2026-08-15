# Pehchaan

**Share your document. Not your identity.**

Hide the parts they don't need — the Aadhaar number, the address, the photo —
and stamp what the copy is for. Runs entirely in your browser. Your document
never leaves your device.

---

## The problem

Handing over a photocopy of an ID is routine in India. A landlord, a hotel front
desk, a SIM counter, an admissions office — each one takes a full copy of a
document that carries far more than they need. The common defence is a pen
scribble across a photocopy: inconsistent, illegible, and useless against
anything already printed.

The online alternatives are worse. Every "redaction tool" that works in a
browser asks you to upload the document you are trying to protect.

## What this does

1. **Add** a photo or PDF of the document. Nothing is uploaded.
2. **Review** what was found. Detected fields arrive as labelled boxes; draw,
   resize or delete any of them. This step cannot be skipped.
3. **Add a purpose** — "For Bank KYC only · 15 Aug 2026" — stamped across the
   copy so it can't be quietly reused. The date is generated, never typed.
4. **Save** an image or PDF, with the hidden regions destroyed in the pixels.

## Why it can't leak your document

There is no backend. Not "a backend that doesn't store anything" — no server
component exists at all. The app is a static export: HTML, JavaScript, and WASM.

- **Zero third-party requests at runtime.** The OCR engine, its WASM cores, the
  language data, the face model, the PDF renderer and the fonts are all served
  from this app's own origin. A build step (`scripts/scrub-cdn.mjs`) rewrites any
  CDN URL a dependency ships with, then **fails the build** if one survives.
- **A visible counter.** The header shows how many requests went to any other
  origin since the page loaded. If it ever reads above zero, you see it.
- **It works offline.** Load it once, then turn off the network and it still
  reads documents and redacts them. That is the proof that needs no explanation.
- **No storage.** No `localStorage`, no `IndexedDB`, no cookies. The document
  lives in memory and a refresh wipes it. (A service worker caches *the app* so
  it works offline. It never touches your document.)
- **Redaction is destructive.** Pixels are overwritten and the image is
  re-encoded — not a black rectangle layered on top that can be dragged away.
  The exported PDF contains no text layer and no fonts, so there is nothing
  underneath to recover.

## What it detects

| Field | How |
|---|---|
| Aadhaar number | 12 digits, validated with the Verhoeff checksum |
| PAN | Format-locked `AAAAA9999A`, with per-position OCR correction |
| Date of birth | `DD/MM/YYYY` and labelled year-of-birth forms |
| Address | Anchor word to PIN-code terminator |
| Roll / account / phone numbers | Label anchors |
| Photograph | MediaPipe BlazeFace, expanded to cover head and shoulders |
| QR code | `BarcodeDetector` where available, otherwise located geometrically |

Two decisions worth naming:

**A failed checksum is a suggestion, not a rejection.** The usual reason a real
Aadhaar number fails Verhoeff is that OCR misread one digit — exactly when you
still need the box. It appears dashed and enabled. A false positive costs one
click; a miss costs an identity.

**The QR is located, never decoded.** An Aadhaar QR holds the whole demographic
record. Decoding it would mean this tool reading the data it exists to protect,
so it finds the symbol by its three finder patterns and covers it.

Detection is a starting point and the interface says so. If nothing is found, a
blocking banner says that plainly rather than letting you export a document you
believe was cleaned.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

`predev` and `prebuild` vendor the OCR, WASM and PDF assets from `node_modules`
into `public/` — those directories are generated, not committed, so a dependency
bump can't leave a stale copy behind.

```bash
npm run build        # static export to out/, then the CDN scrub + assertion
npm test             # 84 tests, node:test, no framework
```

To exercise offline mode, serve the build (`cd out && python -m http.server
4173`) and load it over `localhost` — a service worker needs a secure context,
which a plain-http LAN address is not.

## Layout

```
app/            wizard host, one route
components/     canvas, box overlay, panels, controls
lib/
  ocr/          Tesseract lifecycle, Verhoeff
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

Stated rather than hidden — each is a deliberate trade.

- **English OCR only.** Aadhaar cards are bilingual and the Hindi text is not
  read. Numbers are language-independent, so the highest-value target is
  unaffected.
- **Structured detection covers Aadhaar and PAN.** Everything else runs through
  generic patterns plus the manual tool. Depth over breadth.
- **Very low-quality photos will fail detection**, and the app says so loudly
  instead of exporting a document it did nothing to.
- **No authenticity checking.** Pehchaan redacts documents; it does not verify
  that one is genuine.
- **Light theme only.** Dark mode is authored as tokens but not built.

## Test data

Every document used in development and in the demo is fabricated. No real ID
appears in this repository, its history, or the demo video.

---

Built for CodeStorm 2026: FutureForge. Design and product notes are in `docs/`;
`DEMO.md` and `PHONE-PASS.md` cover recording and device testing.
