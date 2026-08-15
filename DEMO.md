# Demo recording plan

The submission is judged on a video. This is the shot list, the setup that keeps
it from failing live, and the two proofs that have to appear on screen rather
than be claimed in narration (PRD §10).

## Before recording

**Build and serve the production output, never `next dev`.** Dev serves PDF.js
and Tesseract unminified; page rasterisation and OCR are several times slower and
the pauses read as a broken app.

```
npm run build
npx serve out          # or: cd out && python -m http.server 4173
```

**Warm the caches once, then reload.** Open the app, run one document through it,
and reload the page. That fills the service worker cache with the OCR engine and
the WASM, which is what makes the offline shot work. Do this before recording,
not during.

**Fabricated documents only.** Never a real ID — this goes in a public repo and a
public video. Fabricated Aadhaar numbers must still pass the Verhoeff check or
detection will label them as suggestions and the demo will look weaker than the
product is. `2345 6789 0124` and `3456 7890 1238` are valid and fake.

**Window at 1280×800 or a real phone.** A 1536px window makes the canvas small in
frame. If recording the phone case, use an actual phone (TRD §11) — a resized
desktop window does not exercise touch, and touch is where redaction tools fail.

**Check before rolling:** the wordmark bar animation plays on load (hard reload,
not a soft one), the privacy badge reads `0 sent off this device`, and the
DevTools Network tab is open and cleared.

## The 90-second run

| Time | On screen | What is said |
|---|---|---|
| 0:00–0:12 | Landing. Wordmark bar slides off the word. | The problem: people hand over full Aadhaar copies to landlords, hotels, SIM counters, and have no way to limit what they share. |
| 0:12–0:22 | Drop a fabricated Aadhaar photo. Progress text: *Reading the document…*, then *Looking for sensitive fields…* | Nothing is uploaded. The OCR engine is running in the browser. |
| 0:22–0:38 | Boxes appear labelled. Point at the Aadhaar number box. | The number is validated with the Verhoeff checksum, not just pattern-matched — that is why it is not boxing every twelve digits on the page. |
| 0:38–0:50 | Draw one box by hand over something detection missed. Delete a box. | Detection is a starting point. Nothing is auto-approved; the review step cannot be skipped. |
| 0:50–1:04 | Step 3. Click **Hotel check-in**. The reveal line changes; the preview updates. | Different recipients need different fields. A front desk needs the face and the name. It does not need your address or your date of birth. |
| 1:04–1:16 | Step 4. Save. Open the saved file. Try to select the redacted text. | The pixels are gone, not covered. There is no layer to remove and no text underneath to copy. |
| 1:16–1:30 | **The two proofs.** See below. | — |

## The two proofs — do not narrate these, show them

**1. Nothing was sent.** DevTools Network tab, open since load, filtered to
third-party. It is empty. Then point at the badge in the corner: `0 sent off this
device`. Say plainly that the app's own assets come from the app's own origin,
and that the number counts requests to anywhere else — the honest version is more
convincing than an implausible zero.

**2. It works with the network off.** Kill the server (or switch off wifi),
reload the page, and run a document through end to end. This is the strongest
single moment in the video: an app that finds an Aadhaar number with the network
physically unavailable is not sending it anywhere, and no explanation is needed.

## Recording the redaction is irreversible

If there is time for a third proof, open the exported PDF in a PDF editor and
show that the redacted region has no text object under it and no removable
annotation — only flattened pixels. This is the difference between Pehchaan and
the black rectangle people draw in a PDF viewer, and it is the objection a
technical judge will raise.

## Known limits to state, not hide

Say these on camera or in the description. They read as judgement, and a judge
who finds them unaided reads them as a gap.

- English OCR only. Aadhaar cards are bilingual; the Hindi text is not read.
  Numbers are language-independent, so the highest-value target is unaffected.
- Structured detection covers Aadhaar and PAN. Everything else goes through
  generic patterns plus the manual tool, which is a depth-over-breadth choice.
- Very low-quality photos will fail detection, and the app says so loudly rather
  than exporting a document it silently did nothing to.

## If something fails live

Every failure path keeps the manual tool available, so the demo can continue.
If OCR does not start, the app says so and boxing by hand still works — show that
instead of restarting. A recovered failure demonstrates the error handling; a
restart demonstrates nothing.
