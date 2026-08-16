# Devfolio submission copy

Everything the form asks for, written out. Paste and adjust.
CodeStorm 2026: FutureForge. Deadline 31 August 2026.

---

## Links

| Field | Value |
|---|---|
| Live | https://usepehchaan.vercel.app |
| Repository | https://github.com/iamsouravkumar/pehchaan |
| Demo video | *not recorded yet, see DEMO.md* |

## Tagline

Share your document. Not your identity.

## Short description

Pehchaan redacts Indian ID documents in the browser and proves nothing was
uploaded. It finds the Aadhaar number, VID, PAN, date of birth, address,
photograph and QR code, hides what a recipient does not need, and stamps the
copy with what it is for. There is no backend to send a document to.

## The problem

Handing over a photocopy of an ID is routine in India: a landlord, a hotel front
desk, a SIM counter, an admissions office. Each takes a full copy of a document
carrying far more than they need. An Aadhaar number is a lifetime identifier
that cannot be rotated after it leaks.

The usual defence is a pen scribble across a photocopy, which is inconsistent,
illegible, and useless against anything already printed. The online
alternatives are worse: every browser redaction tool asks you to upload the
document you are trying to protect.

## What it does

1. **Add** a photo or PDF. Nothing is uploaded.
2. **Review** what was found. Detected fields arrive as labelled boxes; solid
   where verified, dashed where guessed. Draw, resize, relabel or delete any of
   them. This step cannot be skipped or auto-advanced.
3. **Add a purpose.** Pick the recipient and only what they legitimately need
   stays visible. The copy is stamped "For Bank KYC only · 16 Aug 2026". The
   date is generated, never typed, because a back-dated stamp is worthless.
4. **Save** an image or PDF with the hidden regions destroyed in the pixels.

## Why it cannot leak your document

- **No backend exists.** Not a backend that stores nothing: a static export,
  with no server component at all.
- **Zero third-party requests at runtime.** The OCR engine, its WASM cores, the
  language data, the face model, the PDF renderer and the fonts are all served
  from our own origin. A build step rewrites any CDN URL a dependency ships
  with, then fails the build if one survives.
- **A visible counter** in the header shows requests to any other origin. It
  reads zero, and you can watch it while you work.
- **It works offline.** Load it once, disconnect, redact a document. That is the
  proof that needs no explanation.
- **No storage.** No localStorage, no IndexedDB, no cookies. The document lives
  in memory and a refresh wipes it.
- **Redaction is destructive.** Pixels are overwritten and re-encoded, not
  covered by a layer that can be dragged away. The exported PDF carries no text
  layer and no fonts.

## How it is built

Next.js static export, React, Tailwind. Tesseract.js (WASM) for text,
MediaPipe BlazeFace for photographs, PDF.js for PDF pages, a hand-written PDF
writer for export. Every asset vendored and self-hosted.

Detection worth naming:

- **Verhoeff checksum** on the Aadhaar number, with a deliberate deviation: a
  failed checksum becomes a *suggestion*, not a rejection, because the usual
  cause is OCR misreading one digit, which is exactly when the box is needed.
- **The QR is located, never decoded.** An Aadhaar QR holds the whole
  demographic record; decoding it would mean this tool reading the data it
  exists to protect. It is found geometrically by its three finder patterns,
  with square-corner and diagonal tests to reject printed texture.
- **The page is prepared before it is read**: enlarged if small,
  contrast-stretched either way, because a laminated card under a ceiling light
  is grey on grey.
- **Photographs are searched at several scales**, since the face model reduces
  its input to 128px square and what matters is the fraction of the frame a
  face fills.

## What it handles

Aadhaar (number, VID, date of birth, address, photo, QR), PAN (number, date of
birth, photo), and marksheets and other documents through labelled fields: roll,
registration, enrolment, seat, index, PRN and hall-ticket numbers, plus
candidate and parent names. Anything else, you box yourself in two seconds.

## Honest limits

- English OCR only; the Hindi half of an Aadhaar card is not read. Numbers are
  language-independent, so the highest-value target is unaffected.
- Marksheet coverage is only as good as its labels.
- A QR needs all three corner patterns; a crop through the symbol cannot be
  located.
- No authenticity checking. This redacts documents, it does not verify them.

## Test data

Every document used in development, in testing and in the demo is fabricated.
No real ID appears in the repository, its history, or the video.

## Before submitting

- [ ] Record the demo video (DEMO.md has the shot list). Do the offline take.
- [ ] Run the phone pass (PHONE-PASS.md).
- [ ] Paste the live link into a chat to check the preview card renders.
- [ ] Fill the Devfolio form with the copy above.
