# Pehchaan — Design Document

**Version:** 1.0
**Owner:** Sourav
**Companion to:** PRD v1.0, TRD v1.0

---

## 1. Design brief

A privacy tool for people who are nervous about their documents. The user is usually mid-errand — filling a rental form, standing at a bank counter, uploading admission paperwork — and needs this done in under a minute on a phone.

**The design's single job:** make a nervous, non-technical person feel that this tool is careful and that they are in control.

That rules out two tempting directions. It is not a developer tool, so no terminal aesthetics, no monospace-everything, no dark-by-default hacker look. It is also not a government portal, so no dense forms, no officialese, no crest-and-banner formality. The register sits between them: careful, quiet, competent.

**Design constraint from the TRD:** every font must be self-hosted. No Google Fonts CDN link, no runtime font fetch. This is not negotiable — a single stylesheet request to `fonts.googleapis.com` breaks the zero-network claim the entire product rests on.

---

## 2. The signature: the redaction bar

Redaction has an icon already. The black bar over text is one of the most recognisable marks in print — everyone knows what it means without being told. Pehchaan uses it as its core visual device rather than inventing decoration.

Where it appears:

**Wordmark.** `PEHCHAAN` set in the display face, with a redaction bar covering the middle four letters. On first load the bar slides away over 400ms to reveal the full word — the product's entire thesis in one gesture: *what's hidden can be revealed, and you decide.* Respects `prefers-reduced-motion` by rendering revealed with no animation.

**Step indicator.** Four horizontal bars across the top of the wizard. Completed steps are solid ink, the current step is stamp-violet, upcoming steps are hairline rule. They read as redaction bars filling in, not as generic progress dots.

**Detected field chips.** Each detected field shows its label and a partially-barred value in mono — `Aadhaar number  •  ████ ████ 9012`. The user sees exactly what will be hidden, without the full value being displayed on screen in a bank queue where someone is standing behind them.

This is the one place boldness is spent. Everything else stays quiet.

---

## 3. Color

Grounded in the subject's own materials: document paper, blue-black ink, and the violet stamp pad that sits on every desk in every records office in India. The violet is the accent — specific to this product's world, and not a colour that shows up in generic app design.

### Light (default)

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#F5F5F2` | Page background. Cool off-white, not cream |
| `--surface` | `#FFFFFF` | Cards, panels, the canvas stage |
| `--ink` | `#17181B` | Primary text |
| `--ink-soft` | `#5C6068` | Secondary text, labels |
| `--rule` | `#DDDDD7` | Borders, dividers, inactive steps |
| `--stamp` | `#4B3C8F` | Accent: current step, primary actions, focus rings |
| `--stamp-wash` | `#EDEAF6` | Accent backgrounds, selected box fill |
| `--redact` | `#0A0A0B` | Redaction bars. Deliberately darker than `--ink` |
| `--safe` | `#2F6F55` | Confirmations, "0 requests" indicator |
| `--alert` | `#A63A2E` | Blocking warnings. Muted brick, not emergency red |

### Dark — P2, do not build in the first pass

**Ship light-only.** Dark mode is not a toggle; it is a second palette maintained across every state, box stroke, warning banner, and disabled control, plus the awkward case of a white document canvas sitting inside dark chrome and reading as a hole punched in the screen. That is roughly a day of work and a steady source of small visual bugs, for something no judge will check.

Tokens are recorded here so it can be added cheaply if there is spare time at the end. Build against light only until then, but author all colours as CSS custom properties from day one so retrofitting is a token swap rather than a refactor.

| Token | Hex |
|---|---|
| `--paper` | `#131417` |
| `--surface` | `#1B1D21` |
| `--ink` | `#ECECE8` |
| `--ink-soft` | `#9AA0A8` |
| `--rule` | `#2E3239` |
| `--stamp` | `#9B8AD6` |
| `--stamp-wash` | `#262240` |
| `--redact` | `#000000` |
| `--safe` | `#5FA787` |
| `--alert` | `#D97A6C` |

If built: follows `prefers-color-scheme` on load, switchable for the session, persists nowhere — no `localStorage`, per TRD §7.

**One rule that overrides theming:** the document canvas stage always renders on white, in both themes. A scanned document viewed against dark chrome is hard to judge, and the user is making a decision about what's visible. Never tint the document.

---

## 4. Typography

Three roles, chosen so the interface sounds like paperwork handled well.

**Display — Newsreader.** Variable serif with optical sizing, editorial rather than decorative. Carries the print-and-document register without the stiffness of an institutional serif. Used with restraint: the wordmark and step titles only. Never for body copy, never for buttons.

**Body / UI — IBM Plex Sans.** Humane and slightly institutional, designed for interfaces that carry responsibility. Calm without being anonymous.

**Data — IBM Plex Mono.** Every detected value, every field label, coordinates, filenames. Mono here isn't stylistic — it signals *this is what the machine read*, which is exactly the distinction the review step needs the user to understand.

### Scale

| Role | Size / Line | Weight | Face |
|---|---|---|---|
| Wordmark | 24px | 500 | Newsreader |
| Step title | 28 / 34 | 400 | Newsreader |
| Step subtitle | 15 / 22 | 400 | Plex Sans |
| Body | 15 / 24 | 400 | Plex Sans |
| Label | 13 / 18, +0.02em | 500 | Plex Sans |
| Data value | 14 / 20 | 400 | Plex Mono |
| Micro / caption | 12 / 16 | 400 | Plex Mono |
| Button | 15 | 500 | Plex Sans |

Sentence case throughout. No all-caps except the wordmark and the eyebrow label on the step indicator.

---

## 5. Layout: the wizard

Four steps. The canvas is present from step 2 onward and never disappears — the user should always be able to see the document they're deciding about.

```
┌──────────────────────────────────────────────────┐
│  PEH████AAN                              ⬤ 0 req │
├──────────────────────────────────────────────────┤
│  ███████  ███████  ─────── ───────                │
│  Add      Review   Purpose  Save                  │
├──────────────────────────────────────────────────┤
│                                                   │
│   Review what's hidden                            │
│   Check every box before you save.                │
│                                                   │
│  ┌────────────────────────┐  ┌─────────────────┐ │
│  │                        │  │ FOUND           │ │
│  │      [document]        │  │ ▸ Aadhaar no.   │ │
│  │   with draggable       │  │   ████ ████ 9012│ │
│  │      overlay boxes     │  │ ▸ Date of birth │ │
│  │                        │  │ ▸ Photograph    │ │
│  │                        │  │                 │ │
│  │                        │  │ + Draw a box    │ │
│  └────────────────────────┘  └─────────────────┘ │
│                                                   │
│                      [ Back ]  [ Continue ]       │
└──────────────────────────────────────────────────┘
```

### Step 1 — Add your document

Single drop zone, generously sized, centre of screen. One line beneath it: *Nothing is uploaded. This runs entirely on your device.* The claim goes here, at the moment of hesitation, not buried in a footer.

Below the drop zone, three quiet mono captions: `works offline` · `no account` · `nothing stored`.

### Step 2 — Review what's hidden

Canvas left (or full-width on mobile), findings panel right. Detected regions render as boxes over the document. The panel lists what was found; each row toggles its box, and clicking a row scrolls the canvas to it.

`+ Draw a box` is a persistent, primary-weight control — not a secondary tool hidden behind an icon. It must read as an expected part of the flow, because it is: the tool tells you it found what it could, and invites you to add the rest.

**Box states:** detected = stamp-violet stroke, 2px, transparent fill. Manual = ink stroke, 2px dashed. Selected = stamp-violet stroke with `--stamp-wash` fill and 8 handles. Disabled = rule stroke, 1px, 40% opacity.

Detected and manual boxes look different on purpose. The user should always be able to tell what the machine claimed versus what they added.

### Step 3 — Add a purpose

Watermark toggle, on by default (PRD §12). Preset chips: `Bank KYC` · `Rental agreement` · `College admission` · `SIM verification` · `Hotel check-in` · `Custom`. Selecting a preset fills the text and pre-selects the fields that recipient doesn't need.

Live preview on the canvas as they type. Date auto-appends and is not editable — a back-dated purpose stamp is a forgery vector.

### Step 4 — Save

Final preview at full size. Format toggle (image / PDF). One primary button: `Save redacted copy`.

Below it, quiet confirmation text: what was hidden, count of regions, and the filename. Then the closing line — *Network requests since you opened this page: 0.*

---

## 6. Mobile

Mobile is the primary case, not a scaled-down desktop. Below 768px:

- Canvas fills the viewport width; the findings panel becomes a bottom sheet at ~40% height, draggable to full
- Step indicator collapses to bars only, with the step title beneath
- Wizard actions pin to the bottom, above the safe area inset
- Box handles enlarge to 44px hit targets while rendering at 12px
- Pinch to zoom, two-finger pan, single-finger drag to draw or move a box
- A zoomed-in mode is essential — drawing a precise box over a 12-digit number on a 390px screen is otherwise impossible

---

## 7. Critical states

**Nothing detected — blocking.** Full-width banner in `--alert` above the canvas: *No sensitive fields found. Check this document yourself before saving.* The Continue button is disabled until the banner is dismissed. This is the one place the interface is deliberately obstructive, and it is correct — silence here would let someone export an unredacted Aadhaar believing it was safe.

**OCR engine unavailable.** Notice, not a blocker: *Automatic detection isn't available. You can still mark and hide anything by hand.* Flow continues in manual mode. The product still works.

**Reading the document.** Real progress with stage text — `Reading the document…`, `Looking for sensitive fields…`. A silent spinner during a five-second OCR pass reads as broken, and this is the exact moment a demo loses its audience.

**Privacy indicator.** Persistent, top right. A small dot in `--safe` and mono text: `0 requests`. If it ever shows anything above zero, something is wrong and the user deserves to see it. Do not hide the failure case.

---

## 8. Motion

Sparing. Three moments only:

1. Wordmark bar reveal on first load, 400ms, ease-out
2. Step transitions — content cross-fades 180ms, bars fill 240ms
3. Box selection — 120ms stroke and fill change

Everything else is instant. `prefers-reduced-motion: reduce` disables all three; the wordmark renders revealed.

---

## 9. Voice

Plain, direct, second person. The interface explains what happens, never sells.

| Don't | Do |
|---|---|
| Submit | Continue |
| Process document | Read the document |
| Redact PII | Hide what's sensitive |
| Your privacy is our priority | Nothing is uploaded |
| Oops! Something went wrong | Couldn't read this file. Try a clearer photo |
| Download | Save redacted copy |

Errors state what happened and what to do. They don't apologise and they're never vague. Empty states invite the next action rather than describing emptiness.

---

## 10. Accessibility floor

Non-negotiable, and cheap to get right if done from the start:

- Visible focus rings, 2px `--stamp`, 2px offset, on every interactive element
- Full keyboard path through the wizard; boxes selectable by Tab, movable by arrow keys, deletable by Delete
- Body text meets 4.5:1 in both themes; `--ink-soft` on `--paper` verified
- Canvas boxes announced to screen readers with label and position
- The blocking warning uses `role="alert"`
- All motion gated on `prefers-reduced-motion`

---

## 11. What was deliberately not done

Recorded so these don't get re-argued mid-build:

- **No dark default.** Dark reads as a security product to developers and as unfamiliar to everyone else. The user is not a developer.
- **No theme toggle in v1.** Light-only ships; dark is P2 (§3). Colours are authored as custom properties throughout so it stays a cheap retrofit.
- **No trust badges, lock icons, or shield graphics.** Security theatre. The live `0 requests` counter is a real claim; a padlock illustration is a decorative one.
- **No onboarding tour, no modal on first visit.** The drop zone and one sentence are the entire explanation needed.
- **No branding on the output document.** PRD §12 — the file goes to a bank or a landlord, and a third-party watermark risks it being questioned.
- **No progress percentage on OCR.** Tesseract's reported progress is unreliable and a stalled 73% is worse than honest stage text.
