# Real-device pass

TRD §11 asks for the full flow on an actual phone, not a resized desktop window.
This is that checklist. It takes about ten minutes.

## Getting it on the phone

Open it:

```
https://usepehchaan.vercel.app
```

Nothing to set up. That replaces the old LAN-server instructions, and with them
both of their caveats: `https` is a secure context, so the **service worker
registers** and offline mode can be tested on the phone itself, which is where
the claim actually matters.

If you want to test an unreleased change instead, serve the build over the LAN
(`npm run build && cd out && python -m http.server 4173 --bind 0.0.0.0`) and
remember that a plain-http address registers no service worker.

## Already measured, so you can skip it

Checked in a 390px viewport against the deployed site. Listed so the ten minutes
go on what only a thumb can answer.

- Header fits one line: `PEHCHAAN` and `0 sent`, 25px tall. The badge drops "off
  this device" below `sm`, as designed.
- No horizontal overflow: the page is exactly 390px wide.
- The box overlay computes `touch-action: none`, so a drag draws rather than
  scrolling the page.
- Canvas 335px wide with the findings panel stacked underneath it.
- Detection on a fabricated card: **5.4s** from drop to boxes.
- Every control is now at least 24px: the hide checkbox is 24px, the label
  select and both style options 36px, delete 44px.

## What only a thumb can tell you

Each line is a pass/fail. The ones marked **critical** are where redaction tools
usually fail on phones.

### Drawing and adjusting

- [ ] **critical** Draw a box over the Aadhaar number with one finger. Does it
      draw cleanly, or does the page fight you?
- [ ] **critical** At 1× the number is tiny. Tap `3×`, scroll to the number,
      draw the box there. Is the zoomed canvas actually usable one-handed?
- [ ] Grab a corner handle and resize. Handles render at 12px with a 44px hit
      area — can you hit one without a fingernail, first try?
- [ ] Drag a box across the document. Does it track the finger, or lag/jump?
- [ ] Does anything get stuck mid-drag if your finger leaves the canvas edge?
- [ ] Tap `block` / `blur` and the hide checkbox. These were just enlarged; are
      they comfortable now, or still fiddly?

### Reading and reaching

- [ ] Is the document legible enough at 1× to know *what* to hide?
- [ ] Can you reach `Continue` with your thumb without shifting grip? It's
      pinned to the bottom above the safe-area inset.
- [ ] Does the pinned bar sit above the home indicator on a notched phone, not
      under it?
- [ ] The findings panel is below the canvas on mobile. Is that enough, or does
      the scroll between document and panel make review annoying? (DESIGN §6
      wants a draggable bottom sheet — deliberately deferred. This checkbox is
      the decision point on whether it's needed.)

### The whole flow

- [ ] Photograph a fabricated document with the phone camera and use that file,
      not a screenshot. This is the real input: angled, uneven light, shadowed.
- [ ] Does EXIF orientation come out right, or is the photo sideways?
- [ ] How long from drop to boxes appearing? Over ~15s the demo loses people.
      A desktop browser does it in about 5s; a mid-range phone will be slower.
- [ ] Does the phone get hot or the tab reload during OCR? A tab reload means
      the browser killed it for memory — that's a real failure on cheap phones,
      and worth knowing before the video.
- [ ] Save the file. Does it land in Downloads and open in the phone's viewer?
- [ ] Open the saved file and try to select the redacted text. Nothing should be
      selectable there.

### Offline, now testable on the phone

- [ ] Load the site, then turn on aeroplane mode.
- [ ] Reload the page. Does it still open?
- [ ] Redact a document with the radio off, start to finish, and save it.

## Report back

For anything that fails, the useful details are: the phone and browser, whether
it was reproducible, and a screen recording if it's a touch-handling issue —
those are nearly impossible to diagnose from a description.
