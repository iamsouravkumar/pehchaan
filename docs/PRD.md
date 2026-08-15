# Pehchaan — Product Requirements Document

**Version:** 1.0
**Owner:** Sourav
**Status:** Draft, locked for build
**Submission deadline:** 31 August 2026 (CodeStorm 2026: FutureForge)

---

## 1. Summary

Pehchaan is a browser-based tool that redacts sensitive fields from Indian identity documents before you hand them to a third party — and proves it never uploaded anything.

You drop in a photo or scan of an Aadhaar card, PAN card, or marksheet. Pehchaan finds the sensitive fields, lets you correct what it missed, permanently masks them into the image pixels, and stamps a purpose watermark ("For HDFC KYC only — 14 Aug 2026"). All processing happens inside the browser tab. There is no server, no upload, no account.

**One-line positioning:** The document you hand over should say only what the person needs to know.

---

## 2. Problem

Indians hand over ID photocopies constantly — for SIM cards, rentals, hotel check-ins, bank KYC, college admissions, gas connections, courier pickups. Each copy carries the full document: Aadhaar number, date of birth, home address, photograph, parent's name.

Three things go wrong:

1. **Over-disclosure.** A hotel needs to confirm you exist. It does not need your Aadhaar number. But the only artifact available is the whole card, so the whole card gets handed over.
2. **Uncontrolled reuse.** Once a photocopy is in a drawer, there is no way to limit what it is used for. The common workaround — scrawling "for X purpose only" across the copy by hand — is a real, widespread habit that people already perform, badly and inconsistently.
3. **No safe tool exists.** The people most exposed to this are least equipped to fix it. Editing an image to black out a number requires software they don't have and skills they don't have. And any online tool that could do it requires uploading the exact document they're trying to protect.

That last point is the crux. **Every existing solution asks you to upload your Aadhaar to a stranger's server to make your Aadhaar safer.**

---

## 3. Who this is for

**Primary — the everyday document-hander-over.** Students submitting admission paperwork, tenants signing rental agreements, anyone doing bank or telecom KYC. Not technical. Uses a phone. Will not install anything. Will not create an account. Needs the whole thing to take under a minute.

**Secondary — the small intake desk.** A rental broker, a hostel warden, a small clinic receptionist who collects ID copies and would rather not be holding a stack of complete Aadhaar numbers they're now liable for.

**Explicitly not for (v1):** enterprise compliance teams, bulk processing pipelines, legal e-discovery.

---

## 4. Goals

**Product goals**
- A non-technical person completes a redaction in under 60 seconds without instructions.
- The privacy claim is structurally true, not a promise — verifiable by opening DevTools.
- Redaction is destructive: masked pixels cannot be recovered by any PDF or image editor.
- The tool degrades gracefully. Automatic detection failing must never mean the user can't finish.

**Hackathon goals**
- A demo that lands in 60 seconds, with a provable moment (empty Network tab, unrecoverable mask).
- A submission that a non-technical judge immediately understands and personally wants.
- Ship finished rather than impressive-but-broken.

## 5. Non-goals

Deliberately out of scope. Each of these either weakens the privacy claim or eats the timeline:

- User accounts, login, saved history
- Any server-side processing or backend of any kind
- Native mobile app
- Batch or multi-document processing
- Non-Indian document types
- Verifying that a document is genuine
- Anything that phones home, including analytics

---

## 6. Scope: documents supported

**Pehchaan accepts any document.** The manual box tool works on anything you can render to a canvas, so there is no such thing as an unsupported file. What varies is how much the tool figures out for you.

**Structured detection — Aadhaar and PAN.** These two have fixed, nationally consistent layouts, so the tool knows exactly what to look for and where.

| Document | Fields detected |
|---|---|
| Aadhaar card | 12-digit Aadhaar number (checksum-validated), DOB / year of birth, address block, photograph, QR code |
| PAN card | 10-character PAN, DOB, father's name, photograph, signature |

**Generic detection — everything else.** Marksheets, certificates, utility bills, offer letters, rental agreements, bank statements. No layout assumptions. The tool runs pattern-based passes that work regardless of document type — dates of birth, PIN-anchored address blocks, roll and registration numbers, photographs — and the user boxes anything else.

**Positioning:** works on any document, exceptional on the ones Indians hand over most.

### Why not add driving licence and passport

**Driving licence — rejected.** Indian DLs are issued state-by-state with 30+ RTO formats, differing layouts and field positions. The effort-to-payoff ratio is the worst of any candidate document.

**Passport — deferred, not rejected.** The MRZ (the two machine-readable lines) is a rigidly specified format with its own check digits, making it genuinely straightforward to parse once OCR is working. But domestically, passports are photocopied rarely compared to Aadhaar. Treat this as a stretch item if the build runs ahead, never as committed scope.

### The reasoning behind narrow structured detection

Auto-detection quality is the product's credibility. A tool that nails Aadhaar every time and offers clean manual boxing for everything else reads as confident. A tool that half-detects six document types reads as unfinished. Spreading detection effort thin degrades the cases that actually matter, and the highest-frequency real-world case — someone photocopying an Aadhaar card — is the one that must never fail.

---

## 7. Requirements

### P0 — Must ship. Without these there is no product.

**Input**
- Accept image (JPG, PNG, WEBP) and PDF, via drag-drop or file picker
- Handle phone-camera photos: rotated, angled, imperfectly lit
- Multi-page PDF: process page by page

**Detection**
- Auto-detect Aadhaar numbers, validated by Verhoeff checksum to eliminate false positives
- Auto-detect PAN format
- Auto-detect dates of birth, address blocks, and photographs
- Present every detection as a visible, editable box before anything is applied

**Manual correction — critical**
- Draw a new box over anything detection missed
- Delete or resize any box, including false positives
- This must exist even if detection works perfectly, because sometimes it won't

**Redaction**
- Masked regions are destroyed in the pixel data, not covered by a removable overlay
- Toggle mask style: solid block or blur

**Purpose watermark**
- Free-text purpose line, plus auto-inserted current date
- Rendered across the document, legible but not obscuring
- Optional — some users just want fields masked

**Output**
- Download as image or PDF
- Output must be visibly, obviously redacted

**Privacy**
- Zero network requests after initial page load
- All assets bundled locally, nothing fetched from a CDN at runtime

### P1 — Should ship if the build holds.

- **Purpose presets** that pre-select which fields to mask: Bank KYC, Rental agreement, College admission, SIM verification, Hotel check-in. Different recipients need different fields hidden; this removes a decision from the user.
- **Live privacy indicator** — visible on-screen element showing zero network requests made. Turns the claim into something the user sees without opening DevTools.
- **Offline support** via service worker — works with the wifi off, which is the most persuasive possible proof.
- **EXIF stripping** on export. Camera photos carry GPS coordinates; a redacted Aadhaar that still contains your home location is a failure.

### P2 — Only if everything else is done and polished.

- Recognise more document types (voter ID, driving licence, passport)
- Multi-page batch within a single PDF
- Shareable redaction presets

---

## 8. User flow

1. **Land.** Single screen. A drop zone and one line explaining what this does. No signup, no tour.
2. **Drop the document.** Preview renders. Detection runs with a visible progress state — the OCR engine takes a few seconds to warm up and silence here reads as broken.
3. **Review.** Detected regions appear as labelled boxes: "Aadhaar number", "Date of birth", "Photo". Each can be toggled off, resized, or deleted. A "draw box" tool handles anything missed.
4. **Set purpose.** Type the purpose, or pick a preset. Date auto-fills.
5. **Export.** Preview the result. Download.

The user should never be asked to make a decision they don't have the context to make. Defaults should be safe: everything detected is masked unless they turn it off.

---

## 9. Competitive landscape

| Alternative | What it does | Gap |
|---|---|---|
| UIDAI masked Aadhaar | Official download with first 8 digits hidden | Aadhaar only, requires login + OTP, no purpose watermark, no other documents, doesn't help with a physical card you photographed |
| Desktop PDF editors (Acrobat, etc.) | Manual redaction | Paid, desktop-only, requires skill, most users' "redaction" is a removable black rectangle |
| Online redaction tools | Upload → redact → download | Requires uploading the document you're protecting. Fundamentally at odds with the use case |
| Manual pen-on-photocopy | The current mainstream behaviour | Inconsistent, illegible, easily ignored, doesn't hide anything already printed |

**Where Pehchaan sits:** the only option that handles any Indian document, requires no account, and provably never transmits the file. The competitive moat isn't features — it's the architecture. A tool with a backend cannot make this claim, and adding one later would break the product's core promise.

---

## 10. Success metrics

**For the hackathon**
- Demo runs start to finish without a failure or a stall
- A judge unfamiliar with the problem understands the value within 15 seconds
- The privacy proof (empty Network tab + unrecoverable mask) is captured on video

**If it lives past the hackathon**
- Time-to-first-redaction under 60 seconds for a first-time user
- Share rate — this is a tool people tell others about or it's nothing
- Detection recall on Aadhaar: the number is found in the large majority of reasonable-quality photos. Recall matters far more than precision; a false positive costs a click, a miss costs an identity.

---

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| OCR fails on crumpled or badly-lit photos | High — breaks the core promise | Manual box tool, built early not last. Detection is framed as a first pass the user reviews, never as authoritative |
| OCR engine's first load is slow and heavy | Medium — first 10s of demo is a blank screen | Pre-warm on page load, real progress state, bundle locally |
| Generic documents detect poorly | Low — expected by design | Generic mode is explicitly pattern-based, not layout-based. Manual boxing carries these cases and the UI frames it that way |
| Detection misses a digit and user trusts it blindly | High — false confidence is worse than no tool | Mandatory review step. Never auto-export. Show clearly what was and wasn't found |
| Large images freeze the browser tab | Medium | Downscale before OCR, run in a Web Worker |
| Building alone in under three weeks | High | P0 list is deliberately short. P1 and P2 are genuinely droppable |

---

## 12. Resolved decisions

**Purpose watermark — optional, on by default.**
The watermark toggle starts enabled with a preset value pre-filled. Users who want it get it without thinking; users who only want fields masked can turn it off in one click. Safe default, no friction.

**Product branding — filename only.**
No "redacted with Pehchaan" mark on the document itself. The output is going to a bank, a landlord, or an admissions office, and a third-party watermark risks the document being questioned or rejected. Branding lives in the exported filename (e.g. `aadhaar-redacted-pehchaan.pdf`), which travels with the file without altering it.

**Failed detection — loud, blocking warning.**
If detection finds no sensitive fields, the tool shows a blocking banner stating clearly that nothing was found and the document must be checked manually. Export stays available but requires dismissing the warning. Rationale: silence would let a user export a fully unredacted Aadhaar believing it was protected. False confidence is the single worst failure mode this product has — worse than the tool not existing.
