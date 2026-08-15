# Pehchaan — Landing Page & Motion Design

**Version:** 1.0
**Owner:** Sourav
**Companion to:** DESIGN.md (tokens, type, voice all inherit from it)

---

## 1. Tagline

> **Share your document. Not your identity.**

Used as the hero headline, the meta description, the OG card, and the first line of the Devfolio submission. Do not paraphrase it anywhere — a tagline becomes memorable through exact repetition, and every variant spends the same attention twice.

**Supporting line (hero subhead):**
*Hide the parts they don't need — the Aadhaar number, the address, the photo — and stamp what it's for. Runs entirely in your browser. Your document never leaves your device.*

---

## 2. What this page has to do

The visitor arrives suspicious. They've been told before that something is private and found out otherwise. The page has one job: **make the privacy claim feel provable rather than promised, before they upload anything.**

Everything else — features, steps, document types — is secondary to that. A visitor who trusts the claim will figure the rest out inside the tool.

**Design split, decided:** the landing page is rich and animated; the tool itself is quiet and precise. This contrast is deliberate. The landing page persuades; the tool reassures. A redaction canvas that bounces and springs while someone decides what to hide reads as unserious.

---

## 3. Structure

```
┌───────────────────────────────────────────────────┐
│  PEH████AAN                          [ Open tool ]│
├───────────────────────────────────────────────────┤
│                                                    │
│   Share your document.                             │
│   Not your identity.                               │
│                                                    │
│   Hide what they don't need. Stamp what it's for.  │
│   Runs entirely in your browser.                   │
│                                                    │
│   [ Open Pehchaan ]   no account · nothing uploaded│
│                                                    │
│        ┌──────────────────────────┐                │
│        │  ▓▓▓▓▓ SAMPLE CARD ▓▓▓▓▓ │  ← self-redacts│
│        │  Name    ████████        │     on loop    │
│        │  DOB     ██/██/████      │                │
│        │  No.     ████ ████ 9012  │                │
│        │  ╱ For HDFC KYC only ╱   │                │
│        └──────────────────────────┘                │
├───────────────────────────────────────────────────┤
│  ⬤  Requests made while you've been reading: 0     │
├───────────────────────────────────────────────────┤
│  1 Add   2 Review   3 Purpose   4 Save             │
├───────────────────────────────────────────────────┤
│  Why nothing is uploaded  (the technical proof)    │
├───────────────────────────────────────────────────┤
│  What it handles                                   │
├───────────────────────────────────────────────────┤
│  Open Pehchaan                                     │
└───────────────────────────────────────────────────┘
```

---

## 4. Section by section

### Hero — the self-redacting card

**This is the page's thesis and its one memorable moment.** A sample ID card sits below the headline. On load, it renders complete and readable. Then, one field at a time, redaction bars sweep across it — name, DOB, address — leaving the last four digits of the number visible. Finally a purpose stamp rotates in at a slight angle: *For HDFC KYC only · 14 Aug 2026*.

It then holds for three seconds and reverses, looping. The entire product is understood before a single word of feature copy is read.

Build it as real DOM elements — divs with the actual card layout — not a video or GIF. It stays crisp at any size, respects reduced motion, and weighs nothing. Use fabricated data throughout: a made-up name, a checksum-invalid number.

CTA: `Open Pehchaan`. Beneath it, mono micro-copy: `no account · nothing uploaded · works offline`.

### Proof strip — the live counter

A full-width band immediately under the hero:

> ⬤ **Requests made while you've been reading: 0**
> *Open your browser's Network tab and watch. This page doesn't talk to anyone either.*

Wired to a real `PerformanceObserver` counting resource entries after load — not a hardcoded zero. It is the single most persuasive element on the page because it's checkable in five seconds, and it makes the landing page itself an instance of the claim rather than an argument for it.

If the number is ever above zero, show the real number. A privacy tool that lies about a counter has no second chance.

### How it works — four steps

Mirrors the wizard exactly, so the tool feels familiar on first open. Numbered `01–02–03–04` — numbering is appropriate here because it genuinely is a sequence.

1. **Add your document** — Photo or PDF. Aadhaar, PAN, marksheet, bill, anything.
2. **Review what's hidden** — It finds the sensitive fields. You check them, and box anything it missed.
3. **Add a purpose** — Stamp what the copy is for, so it can't be quietly reused.
4. **Save** — The hidden parts are gone from the pixels, not covered by a removable layer.

Step 4's phrasing carries real weight — most people don't know that a black box in a PDF can be deleted. Stating it plainly here is a differentiator most visitors won't have considered.

### Why nothing is uploaded — the technical proof

Three claims, each with the mechanism, not the marketing:

**There's no server to send it to.** Pehchaan is a static site. There is no backend, no API, no database. Even if the code wanted to upload your document, there's nowhere for it to go.

**The engine runs in your browser.** Text recognition happens locally in WebAssembly. The engine and its language data are served from this site, not fetched from anyone else's.

**Turn off your wifi and it still works.** The strongest proof available. Load the page, disconnect, redact a document. Nothing changes.

Below these, a quieter line: *The code is open — read it yourself.* with a link to the repo.

### What it handles

Two columns, honest about the split:

**Detected automatically** — Aadhaar (number, DOB, address, photo, QR), PAN (number, DOB, father's name, photo).

**Everything else, your call** — Marksheets, certificates, bills, agreements, offer letters. Common patterns like dates and addresses are found automatically; anything else, you box it yourself in two seconds.

Being upfront about the limit here builds more trust than claiming universal detection and failing in front of the user.

### Closing CTA

The tagline again, at full size, with a single button. No newsletter, no email capture, no social proof counters. Asking for an email address on a privacy tool's landing page is a contradiction the visitor will feel even if they can't name it.

---

## 5. Motion specification

Framer Motion, landing page only. `useReducedMotion()` gates every animation in this document — when true, elements render in final state with no transition.

### Shared easing and timing

```js
const ease = [0.22, 1, 0.36, 1];   // ease-out-expo, calm and decisive
const fast = 0.24;
const base = 0.5;
const slow = 0.8;
```

Nothing springs, nothing bounces, nothing overshoots. The motion vocabulary is *settling into place*, not *arriving with energy*. Spring physics with visible wobble would fight the product's register.

### Page load sequence

Orchestrated, not scattered. One `staggerChildren` parent over the hero:

```js
const hero = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } }
};
const riseIn = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: base, ease } }
};
```

Order: wordmark → headline line 1 → headline line 2 → subhead → CTA → sample card. Total under 1.2s. The card's own redaction loop starts after the sequence completes.

**Wordmark reveal.** The bar over the middle letters animates `scaleX: 1 → 0` from the right, `transformOrigin: 'right'`, 400ms, same easing. Runs once on load. This is the brand gesture — everywhere else in the app the wordmark renders already revealed.

### The self-redacting card

The centrepiece. A timeline, not independent animations:

```js
// Each bar sweeps in from left, 320ms, 180ms apart
const bar = {
  hidden: { scaleX: 0 },
  show: (i) => ({
    scaleX: 1,
    transition: { duration: 0.32, ease, delay: i * 0.18 }
  })
};
// transformOrigin: 'left'
```

Then the purpose stamp: `opacity 0→1`, `scale 1.06→1`, `rotate -3deg`, 380ms, delayed until the last bar lands. A stamp presses down; it doesn't fade in politely. This is the one place a very slight overshoot on scale is correct.

Hold 3s, reverse the whole timeline, pause 1s, repeat. Pause the loop when the card is out of viewport (`useInView`) so it isn't burning frames while someone reads the footer.

### Scroll reveals

Every section below the hero uses one pattern, applied consistently:

```js
<motion.section
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-15%' }}
  transition={{ duration: base, ease }}
>
```

Children within a section stagger at 0.07s. `once: true` matters — content that re-animates on every scroll pass becomes irritating by the third pass.

**Do not** add parallax, scroll-linked scale, sticky-pinned sections, or horizontal scroll hijacking. They're the current fashion, they're a day of work each, and they actively conflict with a page whose message is *this tool is careful and does not show off*.

### Micro-interactions

- Buttons: `scale: 1.015` on hover, `0.985` on tap, 140ms
- Step cards: border colour shifts `--rule` → `--stamp` on hover, 180ms
- Counter: when it renders, the digit does a single subtle `y: 4 → 0` fade. If it ever increments, no animation — a privacy counter should not celebrate

### In-tool motion (restrained, for contrast)

Unchanged from DESIGN.md §8 — step transitions cross-fade 180ms, bars fill 240ms, box selection 120ms. Framer Motion can drive these via `AnimatePresence` on wizard steps with `mode="wait"`, but the values stay small. **Resist adding more once the landing page's motion feels good.** The restraint inside the tool is doing work.

---

## 6. Technical notes

- Framer Motion is ~50KB gzipped. Acceptable, and it must be bundled — no CDN import, same rule as every other dependency (TRD §2)
- Landing page is a separate static route from the tool. The tool's heavy WASM payload should not load until the user opens it — pre-warm Tesseract on the *tool* route, not on the landing page
- Serve the landing page as a fully static export; it must render with JavaScript disabled, degrading to no animation
- OG image: the sample card mid-redaction, with the tagline. This is what appears when the Devfolio link is shared
- Lighthouse target: 95+ on performance. A privacy tool that loads slowly undermines its own competence claim

---

## 7. Copy reference

| Element | Text |
|---|---|
| Headline | Share your document. Not your identity. |
| Subhead | Hide the parts they don't need — the Aadhaar number, the address, the photo — and stamp what it's for. Runs entirely in your browser. Your document never leaves your device. |
| Primary CTA | Open Pehchaan |
| CTA micro-copy | no account · nothing uploaded · works offline |
| Counter | Requests made while you've been reading: 0 |
| Counter sub | Open your browser's Network tab and watch. This page doesn't talk to anyone either. |
| Closing CTA | Share your document. Not your identity. |

No exclamation marks. No "revolutionary", "seamless", "powerful", "cutting-edge". The page's confidence comes from the counter reading zero, not from adjectives.
