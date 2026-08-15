# Pehchaan — Technical Requirements Document

**Version:** 1.0
**Owner:** Sourav
**Companion to:** PRD v1.0
**Target:** Shippable by 31 August 2026

---

## 1. Architectural principle

**There is no backend. Not a small one, not an optional one — none.**

This is not a performance decision or a cost decision. It is the product. The claim "your document never leaves your device" is only credible if it is structurally impossible to violate, and the way to make it structurally impossible is to have nowhere to send it. A judge, a security researcher, or a skeptical user can open the Network tab and verify the claim in five seconds.

Practical consequences that follow, and must not be negotiated away later:

- No Next.js API routes, no server actions, no middleware
- No third-party analytics, error reporting, or session recording
- No runtime CDN fetches — every asset, including the OCR engine and its language data, is bundled and served from our own origin
- No fonts from Google Fonts (self-host)

If a feature can only be built with a server, the feature is cut.

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14+, App Router, `output: 'export'` | Static export only. No server runtime exists in production |
| Hosting | Vercel (static) | Vercel serves the exported files; no serverless functions deployed |
| Styling | Tailwind CSS + shadcn/ui | shadcn components are copied into the repo, not fetched at runtime |
| OCR | Tesseract.js (WASM) | Worker, core, and `eng` traineddata all self-hosted in `/public` |
| PDF read | PDF.js | Rasterises PDF pages to canvas for uniform processing |
| PDF write | jsPDF | Wraps redacted raster output back into a PDF |
| Face detection | MediaPipe Tasks Vision (`FaceDetector`) | WASM and model files self-hosted, **not** loaded from the default CDN |
| Image handling | Native Canvas 2D API | No heavyweight image library needed |
| State | React state + Context | No Redux/Zustand; the app has one document in flight at a time |

**Explicitly rejected:** any cloud OCR (Google Vision, AWS Textract, Azure) — violates the core principle. Any LLM API call — same. `pdf-lib` annotation-based redaction — produces removable overlays, see §6.

---

## 3. Processing pipeline

```
File input
   ↓
Normalise  →  decode, EXIF-orient, strip metadata, downscale
   ↓
Rasterise  →  single canvas per page (PDF and image converge here)
   ↓
Detect     →  OCR pass (Web Worker) + face pass, in parallel
   ↓
Classify   →  regex + checksum → labelled regions with bounding boxes
   ↓
Review     →  USER edits, adds, deletes boxes  ← the pipeline pauses here, always
   ↓
Redact     →  destructive pixel overwrite on canvas
   ↓
Watermark  →  purpose text + date composited
   ↓
Export     →  re-encode to PNG/JPEG or wrap in PDF
```

The review step is mandatory and cannot be skipped or auto-advanced. Auto-export is not a feature and must never become one — see PRD §12 on false confidence.

---

## 4. Detection

### 4.1 OCR

Tesseract.js runs inside a Web Worker so the main thread stays responsive. It must be initialised with locally-hosted paths:

```js
const worker = await createWorker('eng', 1, {
  workerPath: '/tesseract/worker.min.js',
  corePath:   '/tesseract/tesseract-core.wasm.js',
  langPath:   '/tesseract/lang',   // eng.traineddata.gz lives here
});
```

Getting these paths wrong means Tesseract silently falls back to jsDelivr — which breaks the privacy claim without any visible error. **Verify with the Network tab as part of the build, not at the end.**

Word-level bounding boxes come from `recognize()` with block/paragraph/word output enabled. We need `words` with their `bbox` values; the raw text alone is useless because we must know *where* on the canvas each match sits.

### 4.2 Field classification

Run over recognised words and their neighbours:

**Aadhaar number** — 12 digits, commonly OCR'd as `1234 5678 9012`. Strip whitespace, then validate with the **Verhoeff checksum**. Aadhaar numbers carry a trailing check digit computed via the Verhoeff algorithm (multiplication table `d`, permutation table `p`, inverse table `inv`). Any 12-digit string that fails the checksum is discarded.

This matters more than it looks: bare 12-digit regex will match enrolment numbers, VID fragments, phone-number pairs, and OCR noise. The checksum removes almost all of it, and it's a strong signal in the writeup that the domain was actually understood rather than pattern-matched.

**PAN** — `[A-Z]{5}[0-9]{4}[A-Z]{1}`. The 4th character encodes holder type and the 5th is the surname initial; validating the 4th against the known set (`P`, `C`, `H`, `F`, `A`, `T`, `B`, `L`, `J`, `G`) is a cheap precision win. Watch for OCR confusing `O`/`0` and `I`/`1` — try both interpretations before rejecting.

**Date of birth** — `DD/MM/YYYY`, `DD-MM-YYYY`, and Aadhaar's `Year of Birth: YYYY`. Also match the labelled forms (`DOB`, `जन्म तिथि`).

**Address block** — hardest case. Heuristic: locate an anchor word (`Address`, `पता`, `S/O`, `D/O`, `W/O`) and take the region spanning subsequent lines until a 6-digit PIN code appears. A PIN in isolation is also a useful terminator signal.

**Photograph** — MediaPipe `FaceDetector` in `IMAGE` mode. Expand the returned bounding box by ~40% on all sides, since ID photos include shoulders and headroom that a tight face box misses.

**QR code / barcode** — Aadhaar's QR encodes the full demographic record. Detect via `BarcodeDetector` where supported; where unsupported, fall back to the layout heuristic below.

### 4.3 Layout fallback

Aadhaar and PAN have fixed proportional layouts. When OCR quality is poor, offer approximate regions based on document proportions — the Aadhaar number sits in a consistent lower-band position, the photo in a consistent left block. Present these as **suggested** boxes, visually distinct from confident detections, that the user drags into place.

This is a safety net, not the primary path. Build it only after the manual box tool works.

### 4.4 Generic detection (all other documents)

Everything that isn't Aadhaar or PAN goes through the generic path — marksheets, certificates, bills, agreements, letters. No layout assumptions, no document-type classification, no per-format special cases. Adding those is how this scope quietly doubles.

Generic passes are pattern-based only:

- Date patterns (`DD/MM/YYYY`, `DD-MM-YYYY`, labelled `DOB` forms)
- Roll, registration, and account numbers via label anchors (`Roll No`, `Reg No`, `A/C No`, `Enrolment`)
- Address blocks via the PIN-code terminator heuristic (§4.2)
- Photographs via face detection
- Any 12-digit Verhoeff-valid string, since Aadhaar numbers appear on many non-Aadhaar documents — bills, forms, applications. This is a high-value catch

Everything else is the manual box tool, and the UI should say so plainly rather than implying detection was exhaustive.

**Deferred:** passport MRZ parsing. The two machine-readable lines are a rigid ICAO-specified format with their own check digits — easy to parse accurately once OCR works, and a clean structured win. Build it only if ahead of schedule.

**Rejected:** driving licences. State-issued with 30+ RTO layout variants; worst effort-to-payoff ratio of any candidate.

---

## 5. Manual box tool

**Build this first.** Before OCR, before detection, before anything clever. It is the component that guarantees a working demo regardless of how OCR behaves on the day.

Requirements:
- Draw a box by dragging on the canvas overlay
- Select, move, resize (8 handles), delete (click + Delete key)
- Each box carries a label — either auto-assigned from detection or user-picked from a dropdown
- Boxes render as an overlay layer above the document canvas, in canvas coordinates, so they survive zoom and window resize
- Touch support: this will be demoed and used on phones

Store as plain objects: `{ id, x, y, w, h, label, source: 'auto' | 'manual', style: 'block' | 'blur' }`. Coordinates in source-image pixel space, not screen space — convert on render.

---

## 6. Destructive redaction

**The single most important implementation detail in this document.**

The common failure — in commercial tools, not just student projects — is drawing a black rectangle as a PDF annotation or overlay object. The underlying text or image is still present in the file, and anyone can delete the rectangle or select the text underneath. Real documents have leaked exactly this way.

Pehchaan overwrites pixels:

1. Draw the source image to an offscreen canvas at full resolution
2. For each region, `ctx.fillRect()` with opaque black (or apply a heavy blur by drawing a downscaled-then-upscaled crop back over the region)
3. `canvas.toBlob()` / `toDataURL()` to re-encode

The re-encode is what destroys the data. The output image contains no layer, no object, no recoverable original — the pixels are gone.

For PDF export, jsPDF embeds the **redacted raster**. We deliberately do not preserve the original PDF's text layer, because preserving it would preserve the very text we redacted. Losing text selectability is the correct trade.

**Verification requirement:** part of the demo is opening the exported file in an editor and showing nothing can be lifted. Test this yourself before recording.

---

## 7. Privacy implementation

| Requirement | Implementation |
|---|---|
| Zero network at runtime | All assets bundled or in `/public`. Verify with a Network-tab check after every dependency added |
| No CDN fetches | Tesseract paths overridden (§4.1); MediaPipe WASM self-hosted; fonts self-hosted; shadcn components vendored |
| EXIF stripping | Canvas re-encode drops all metadata by default. Read orientation *before* stripping so the image renders the right way up |
| No storage | No `localStorage`, no `IndexedDB`, no cookies. Document exists in memory only; a refresh wipes it |
| Offline capable | Service worker precaches the app shell + WASM. Works with wifi off — the strongest possible proof |
| Visible proof | On-screen indicator showing network requests made since load, via `PerformanceObserver` on resource entries |

The visible indicator is worth building even though it's P1. "Network requests since load: 0" sitting in the corner of the UI converts an abstract claim into something the user sees without being technical.

---

## 8. Performance

| Concern | Approach |
|---|---|
| Tesseract first-load (~2–5 MB, slow init) | Pre-warm the worker on page mount, before the user picks a file. Show a real progress state — silence reads as broken |
| Large phone photos (12MP+) | Downscale to ~2000px on the long edge before OCR. Keep the full-resolution original for the final redaction so output quality is preserved |
| Main-thread freeze | OCR in a Web Worker. Face detection is fast enough inline |
| Multi-page PDFs | Process pages lazily, on demand. Do not OCR page 40 before the user opens it |

**Targets:** interactive within 3s of load. OCR result within 10s for a typical phone photo. Export in under 2s.

---

## 9. Project structure

```
/app
  page.tsx                  single-screen app
  layout.tsx
/components
  DropZone.tsx
  DocumentCanvas.tsx        renders source + overlay
  BoxOverlay.tsx            draw / move / resize / delete
  DetectionPanel.tsx        list of found fields, toggles
  WatermarkControls.tsx
  ExportBar.tsx
  PrivacyIndicator.tsx
  ui/                       shadcn components (vendored)
/lib
  ocr/worker.ts             Tesseract lifecycle
  ocr/verhoeff.ts           Aadhaar checksum
  detect/aadhaar.ts
  detect/pan.ts
  detect/generic.ts         DOB, address, roll numbers
  detect/face.ts            MediaPipe wrapper
  redact/apply.ts           destructive pixel overwrite
  redact/watermark.ts
  export/toImage.ts
  export/toPdf.ts
  image/normalise.ts        EXIF orientation, downscale, strip
/public
  tesseract/                worker, core wasm, lang data
  mediapipe/                wasm + face detection model
```

---

## 10. Error handling

Every failure must leave the user able to finish manually. No dead ends.

| Failure | Response |
|---|---|
| OCR finds no text | Blocking banner: nothing detected, check manually. Manual tool stays fully available |
| OCR finds text but no known fields | Same blocking banner (PRD §12) |
| Face detection fails | Silent — user draws the box |
| PDF is encrypted | Clear message: password-protected PDFs unsupported |
| File too large / unsupported type | Reject at drop with a specific reason, not a generic error |
| Tesseract fails to initialise | Degrade to fully-manual mode with a notice. The app must still work |

That last row matters: if the OCR engine dies, Pehchaan becomes a manual redaction tool — still useful, still demoable, still not broken.

---

## 11. Testing

**Test corpus:** build a set of fabricated documents — clean scan, phone photo at an angle, low light, crumpled, partially shadowed, and a genuinely poor sample. Use fabricated data only; never a real ID, since this is going in a public repo and a public demo video.

**Correctness checks**
- Verhoeff: known-valid and known-invalid 12-digit strings
- PAN regex: valid formats, plus `O`/`0` and `I`/`1` OCR confusions
- Redaction: export, re-import, sample pixel values inside a redacted region — must be uniform, not original data
- Privacy: full flow with the Network tab open; zero requests after load. Then repeat with wifi off

**Manual pass before submission**
- Full flow on an actual phone, not just a resized desktop window
- Exported PDF opened in a PDF editor — confirm nothing recoverable
- Hard refresh mid-flow — confirm nothing persisted

---

## 12. Build order

Sequenced so that a working demo exists early and each step adds to something already functional.

1. Canvas + file input + image normalisation
2. **Manual box tool** — draw, move, resize, delete
3. Destructive redaction + image export
4. Watermark
5. PDF input (PDF.js) + PDF export (jsPDF)
6. Tesseract worker, self-hosted, network-verified
7. Aadhaar detection + Verhoeff
8. PAN, DOB, address detection
9. Face detection
10. Blocking warning on empty detection
11. Purpose presets
12. Privacy indicator, service worker, offline
13. Polish, mobile pass, demo recording

**Steps 1–4 alone are a demoable product.** If everything after step 6 fails, you still have something to submit. That is the point of this ordering.

---

## 13. Constraints and known limits

- **English OCR only.** Aadhaar cards are bilingual; Hindi/regional text will not be recognised. Numbers are language-independent, so the highest-value target is unaffected. Document this as a known limitation rather than hiding it.
- **Browser support:** Chrome and Edge primary. Safari's `BarcodeDetector` is absent — QR detection degrades to the layout fallback.
- **Very low-quality photos will fail detection.** By design, this is survivable via manual mode.
- **No document authenticity verification.** Pehchaan redacts; it does not validate that a document is real.
- **Structured detection covers Aadhaar and PAN only.** Every other document works through generic pattern detection plus manual boxing. This is a deliberate depth-over-breadth choice, not an unfinished feature — the UI should present generic mode as intended behaviour.
