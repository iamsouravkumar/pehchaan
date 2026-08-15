# Real-device pass

TRD §11 asks for the full flow on an actual phone, not a resized desktop window.
This is that checklist. It takes about ten minutes.

## Getting it on the phone

The production build is being served on the LAN:

```
http://192.168.1.15:4173
```

Phone and laptop must be on the same Wi-Fi. If the server isn't running:

```
npm run build
cd out && python -m http.server 4173 --bind 0.0.0.0
```

**Two things behave differently over a LAN address than they will in production,
because `http://192.168.x.x` is not a secure context:**

- **The service worker will not register.** Offline mode can't be tested this
  way. Test offline on `localhost` on the laptop, or on the real HTTPS
  deployment.
- Secure-context-only browser APIs are absent. The one the app used —
  `crypto.randomUUID` for box ids — now falls back, so drawing boxes works over
  plain http. If you see a crash the moment a box is drawn, that fallback has
  regressed.

Everything else — OCR, face detection, redaction, export — is unaffected.

## What only a thumb can tell you

Each line is a pass/fail. The ones marked **critical** are where redaction tools
usually fail on phones.

### Drawing and adjusting

- [ ] **critical** Draw a box over the Aadhaar number with one finger. Does the
      page scroll instead of drawing? (`touch-action: none` should prevent it.)
- [ ] **critical** At 1× the number is tiny. Tap `3×`, scroll to the number,
      draw the box there. Is the zoomed canvas actually usable one-handed?
- [ ] Grab a corner handle and resize. Handles render at 12px with a 44px hit
      area — can you hit one without a fingernail, first try?
- [ ] Drag a box across the document. Does it track the finger, or lag/jump?
- [ ] Does anything get stuck mid-drag if your finger leaves the canvas edge?

### Reading and reaching

- [ ] Is the document legible enough at 1× to know *what* to hide?
- [ ] Can you reach `Continue` with your thumb without shifting grip? It's
      pinned to the bottom above the safe-area inset.
- [ ] Does the pinned bar sit above the home indicator on a notched phone, not
      under it?
- [ ] Header at 390px: does `PEHCHAAN`, the privacy dot, and `Start over` fit on
      one line without wrapping?
- [ ] The findings panel is below the canvas on mobile. Is that enough, or does
      the scroll between document and panel make review annoying? (DESIGN §6
      wants a draggable bottom sheet — deliberately deferred. This checkbox is
      the decision point on whether it's needed.)

### The whole flow

- [ ] Photograph a fabricated document with the phone camera and use that file,
      not a screenshot. This is the real input: angled, uneven light, shadowed.
- [ ] Does EXIF orientation come out right, or is the photo sideways?
- [ ] How long from drop to boxes appearing? Over ~15s the demo loses people.
- [ ] Does the phone get hot or the tab reload during OCR? A tab reload means
      the browser killed it for memory — that's a real failure on cheap phones,
      and worth knowing before the video.
- [ ] Save the file. Does it land in Downloads and open in the phone's viewer?
- [ ] Open the saved file and try to select the redacted text. Nothing should be
      selectable there.

## Report back

For anything that fails, the useful details are: the phone and browser, whether
it was reproducible, and a screen recording if it's a touch-handling issue —
those are nearly impossible to diagnose from a description.
