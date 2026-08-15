/**
 * Finding a QR code without decoding it.
 *
 * `BarcodeDetector` only exists on Android, macOS and ChromeOS — on Windows
 * desktop Chrome, where this will most likely be demonstrated, it is simply
 * absent. Leaving QR detection to that API means the biggest hole in the
 * promise stays open on the most common platform.
 *
 * So this locates the symbol geometrically. Every QR carries three finder
 * patterns — the nested squares in three corners — and they are deliberately
 * designed to be findable from any direction: a line crossing one always reads
 * dark-light-dark-light-dark in a 1:1:3:1:1 ratio, whatever the rotation. Find
 * three of those with a consistent module size and you have located the symbol.
 *
 * We stop there on purpose. Decoding would mean reading the name, address and
 * date of birth the user is trying to protect, and this tool has no business
 * holding that even for a moment. We need to know where the square is, not what
 * it says (TRD §4.2).
 */

import type { Rect } from '../boxes.ts';

/** The 1:1:3:1:1 run ratio, in units of one module. */
const RATIO = [1, 1, 3, 1, 1];
/** How far a run may stray from its expected width, as a fraction of a module. */
const TOLERANCE = 0.55;
/** Finder centres sit three and a half modules inside the symbol's edge. */
const EDGE_MODULES = 3.5;
/** Below this the pattern is more likely to be printed texture than a symbol. */
const MIN_MODULE = 1.4;

export type Grid = {
  /** One byte per pixel: 1 is dark. */
  dark: Uint8Array;
  width: number;
  height: number;
};

/** Grayscale, then a single global threshold from Otsu's method. */
export function binarise(data: Uint8ClampedArray, width: number, height: number): Grid {
  const grey = new Uint8Array(width * height);
  const histogram = new Uint32Array(256);

  for (let i = 0, p = 0; i < grey.length; i++, p += 4) {
    // Rec. 601 luma. Cheaper than a colour-space conversion and enough here.
    const value = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
    grey[i] = value;
    histogram[value]++;
  }

  const threshold = otsu(histogram, grey.length);
  const dark = new Uint8Array(grey.length);
  for (let i = 0; i < grey.length; i++) dark[i] = grey[i] < threshold ? 1 : 0;
  return { dark, width, height };
}

/** The threshold that best separates the histogram into two groups. */
function otsu(histogram: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let threshold = 128;

  for (let value = 0; value < 256; value++) {
    weightBackground += histogram[value];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += value * histogram[value];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance =
      weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    // `>=` so the last of several equally good splits wins. On a photo the
    // maximum is unique and this makes no difference; on pure black-on-white —
    // a scan, or a generated test page — every level between the two spikes
    // scores the same, and taking the first one puts the threshold at 0, where
    // nothing counts as dark.
    if (variance >= best) {
      best = variance;
      threshold = value;
    }
  }
  return threshold;
}

/** True when five consecutive runs hold the finder pattern's proportions. */
export function isFinderRatio(runs: number[]): boolean {
  if (runs.length !== 5) return false;
  const total = runs.reduce((a, b) => a + b, 0);
  const module = total / 7;
  if (module < MIN_MODULE) return false;
  return RATIO.every((expected, i) => Math.abs(runs[i] - expected * module) <= TOLERANCE * module);
}

type Centre = { x: number; y: number; module: number };

/**
 * Scan one axis for finder patterns. `at` reads a pixel in axis order, so the
 * same walk serves rows and columns.
 */
function scanLine(
  length: number,
  at: (i: number) => number,
  onFound: (centre: number, module: number) => void,
) {
  // Five runs, alternating dark, light, dark, light, dark. Even indices are
  // dark, so the run being counted also says what colour we are in.
  const runs = [0, 0, 0, 0, 0];
  let state = 0;

  const complete = (end: number) => {
    if (isFinderRatio(runs)) {
      // Centre of the wide middle band, measured back from where it ended.
      const centre = end - runs[4] - runs[3] - runs[2] / 2;
      onFound(centre, runs.reduce((a, b) => a + b, 0) / 7);
    }
    // Slide the window: this run's last three bands may open the next pattern,
    // which is how two finders separated by one module are both found.
    runs[0] = runs[2];
    runs[1] = runs[3];
    runs[2] = runs[4];
    runs[3] = 1;
    runs[4] = 0;
    state = 3;
  };

  for (let i = 0; i < length; i++) {
    if (at(i) === 1) {
      // Dark. A light run before this one is finished.
      if (state % 2 === 1) state++;
      runs[state]++;
    } else if (state % 2 === 1) {
      runs[state]++; // still light
    } else if (state === 4) {
      complete(i);
    } else if (runs[state] > 0) {
      runs[++state]++; // a dark run just ended
    }
    // else: leading margin before any dark pixel, nothing to count yet
  }
  // A pattern that runs to the very end of the line still counts.
  if (state === 4) complete(length);
}

/** Candidate centres confirmed on both axes. */
export function findCentres(grid: Grid): Centre[] {
  const { dark, width, height } = grid;
  const centres: Centre[] = [];

  // Every third row. A finder pattern is at least seven modules tall, so it
  // cannot hide between the sampled rows, and this is three times less work.
  for (let y = 0; y < height; y += 3) {
    scanLine(
      width,
      (x) => dark[y * width + x],
      (x, module) => {
        const cx = Math.round(x);
        if (!confirmVertically(grid, cx, y, module)) return;
        merge(centres, { x: cx, y, module });
      },
    );
  }
  return centres;
}

/** Re-run the ratio test down the column through a candidate. */
function confirmVertically(grid: Grid, x: number, y: number, module: number): boolean {
  const { dark, width, height } = grid;
  const reach = Math.ceil(module * 5);
  const top = Math.max(0, y - reach);
  const bottom = Math.min(height - 1, y + reach);

  let found = false;
  scanLine(
    bottom - top + 1,
    (i) => dark[(top + i) * width + x],
    (centre, verticalModule) => {
      // The same pattern, at the same scale, crossing this point.
      if (Math.abs(verticalModule - module) > module * 0.5) return;
      if (Math.abs(top + centre - y) > module * 2) return;
      found = true;
    },
  );
  return found;
}

/** Fold a new centre into a nearby one rather than keeping both. */
function merge(centres: Centre[], next: Centre) {
  for (const centre of centres) {
    if (Math.hypot(centre.x - next.x, centre.y - next.y) < centre.module * 3) {
      centre.x = (centre.x + next.x) / 2;
      centre.y = (centre.y + next.y) / 2;
      centre.module = (centre.module + next.module) / 2;
      return;
    }
  }
  centres.push(next);
}

/**
 * The symbol's bounds from three or more finder centres of a consistent size.
 *
 * ponytail: groups every compatible centre into one box, so two QR codes side
 * by side on the same document come back as a single region covering both. That
 * over-covers, which is the safe direction, and the user can resize. Split by
 * distance clustering if a real document ever needs it.
 */
export function boundsFrom(centres: Centre[]): Rect | null {
  if (centres.length < 3) return null;

  // Finder patterns of one symbol share a module size. Take the largest group
  // that agrees, which drops stray matches from printed texture.
  const group = centres.filter((candidate) => {
    const alike = centres.filter((other) => Math.abs(other.module - candidate.module) <= candidate.module * 0.35);
    return alike.length >= 3;
  });
  if (group.length < 3) return null;

  const module = group.reduce((sum, c) => sum + c.module, 0) / group.length;
  const pad = module * EDGE_MODULES;
  const xs = group.map((c) => c.x);
  const ys = group.map((c) => c.y);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;

  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

/** Where the QR is, in canvas pixels, or null. Reads pixels; decodes nothing. */
export function locateQr(canvas: HTMLCanvasElement): Rect | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  return boundsFrom(findCentres(binarise(data, width, height)));
}
