/**
 * Finding a QR code without decoding it.
 *
 * `BarcodeDetector` only exists on Android, macOS and ChromeOS; on Windows
 * desktop Chrome, where this will most likely be demonstrated, it is simply
 * absent. Leaving QR detection to that API means the biggest hole in the
 * promise stays open on the most common platform.
 *
 * So this locates the symbol geometrically. Every QR carries three finder
 * patterns (the nested squares in three corners), and they are deliberately
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
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    // `>=` so the last of several equally good splits wins. On a photo the
    // maximum is unique and this makes no difference; on pure black-on-white (
    // a scan, or a generated test page) every level between the two spikes
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
        // The row we happened to sample is rarely the middle of the pattern, so
        // the vertical pass hands back where the middle actually is. Without
        // that the centre can sit a module and a half off, and the box drawn
        // from it clips the edge of the symbol.
        const middle = confirmVertically(grid, cx, y, module);
        if (middle === null) return;
        // A finder pattern is a set of concentric squares, so the 1:1:3:1:1 run
        // holds through its centre in every direction, diagonals included. Dense
        // small print does not survive that: a row of letters can produce the
        // run horizontally and a column of them vertically, but the two are
        // coincidences that do not line up on the diagonals as well. This is
        // what stops the block of fine print on a marksheet reading as a symbol.
        if (!confirmDiagonally(grid, cx, y, module)) return;
        merge(centres, { x: cx, y: middle, module });
      },
    );
  }
  return centres;
}

/** Re-run the ratio test down the column, returning the true centre or null. */
function confirmVertically(grid: Grid, x: number, y: number, module: number): number | null {
  const { dark, width, height } = grid;
  const reach = Math.ceil(module * 5);
  const top = Math.max(0, y - reach);
  const bottom = Math.min(height - 1, y + reach);

  let middle: number | null = null;
  scanLine(
    bottom - top + 1,
    (i) => dark[(top + i) * width + x],
    (centre, verticalModule) => {
      // The same pattern, at the same scale, crossing this point.
      if (Math.abs(verticalModule - module) > module * 0.5) return;
      if (Math.abs(top + centre - y) > module * 2) return;
      middle = top + centre;
    },
  );
  return middle;
}

/** The ratio test along both diagonals through a candidate. */
function confirmDiagonally(grid: Grid, x: number, y: number, module: number): boolean {
  return onDiagonal(grid, x, y, module, 1) && onDiagonal(grid, x, y, module, -1);
}

/** One diagonal: `slope` is +1 for down-right, -1 for down-left. */
function onDiagonal(grid: Grid, x: number, y: number, module: number, slope: number): boolean {
  const { dark, width, height } = grid;
  const reach = Math.ceil(module * 5);

  // How far the diagonal can run before leaving the page in either direction.
  const back = Math.min(reach, y, slope === 1 ? x : width - 1 - x);
  const forward = Math.min(reach, height - 1 - y, slope === 1 ? width - 1 - x : x);
  const startX = x - back * slope;
  const startY = y - back;

  let found = false;
  scanLine(
    back + forward + 1,
    (i) => dark[(startY + i) * width + (startX + i * slope)],
    (centre, diagonalModule) => {
      // Runs are counted in diagonal steps, and one step advances a pixel in x
      // as well as in y, so a band five pixels wide is still five steps: the
      // module measures the same as it does across a row, not √2 larger.
      if (Math.abs(diagonalModule - module) > module * 0.5) return;
      if (Math.abs(centre - back) > module * 2) return;
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
 * Three centres that sit where a QR's finders sit: the corners of a square, so
 * two equal legs meeting at a right angle with the diagonal across them.
 *
 * Without this, any three run-ratio matches at a similar scale were accepted,
 * and a curved rule printed across a card produces plenty of those: a stroke
 * that thickens and thins crosses the 1:1:3:1:1 test again and again along its
 * length. Those matches lie strung out along the curve, which is exactly what
 * the corners of a square are not.
 */
function bestTriple(centres: Centre[]): [Centre, Centre, Centre] | null {
  let best: [Centre, Centre, Centre] | null = null;
  let bestError = Infinity;

  for (let i = 0; i < centres.length - 2; i++) {
    for (let j = i + 1; j < centres.length - 1; j++) {
      for (let k = j + 1; k < centres.length; k++) {
        const trio = [centres[i], centres[j], centres[k]] as [Centre, Centre, Centre];
        const error = squareness(trio);
        if (error !== null && error < bestError) {
          bestError = error;
          best = trio;
        }
      }
    }
  }
  return best;
}

/** How far three centres are from a right isosceles triangle, or null if too far. */
function squareness(trio: [Centre, Centre, Centre]): number | null {
  const [a, b, c] = trio;
  const module = (a.module + b.module + c.module) / 3;
  const sides = [
    { d: Math.hypot(a.x - b.x, a.y - b.y), opposite: c },
    { d: Math.hypot(b.x - c.x, b.y - c.y), opposite: a },
    { d: Math.hypot(a.x - c.x, a.y - c.y), opposite: b },
  ].sort((p, q) => p.d - q.d);

  const [leg1, leg2, diagonal] = sides.map((s) => s.d);

  // Version 1 is 21 modules across, so its finder centres sit 14 apart; the
  // largest QR puts them 170 apart. Anything outside that is not a symbol at
  // this module size, whatever its shape.
  const legModules = leg2 / module;
  if (legModules < 11 || legModules > 190) return null;

  // Two equal legs, and a diagonal √2 longer. Generous enough for a photograph
  // taken at an angle, tight enough that points strung along a curve fail.
  const legError = (leg2 - leg1) / leg2;
  const diagonalError = Math.abs(diagonal - leg2 * Math.SQRT2) / (leg2 * Math.SQRT2);
  if (legError > 0.3 || diagonalError > 0.25) return null;

  return legError + diagonalError;
}

/**
 * The symbol's bounds from the three finder centres, or null.
 *
 * ponytail: returns the single best triple, so a document carrying two QR codes
 * gets the better-formed one boxed and the other missed. Cluster and return a
 * list if a real document ever needs it; today the Aadhaar card has one.
 */
export function boundsFrom(centres: Centre[]): Rect | null {
  if (centres.length < 3) return null;

  // Finder patterns of one symbol share a module size. Drop candidates that
  // nothing else agrees with, which clears stray matches from printed texture.
  const group = centres.filter((candidate) => {
    const alike = centres.filter(
      (other) => Math.abs(other.module - candidate.module) <= candidate.module * 0.35,
    );
    return alike.length >= 3;
  });
  if (group.length < 3) return null;

  const trio = bestTriple(group);
  if (!trio) return null;

  const module = trio.reduce((sum, c) => sum + c.module, 0) / 3;
  const pad = module * EDGE_MODULES;
  const xs = trio.map((c) => c.x);
  const ys = trio.map((c) => c.y);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;

  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

/**
 * The fraction of a region that is dark.
 *
 * A QR is close to half dark by construction. A region that three stray matches
 * happen to span is mostly the card behind them, so this is the cheapest way to
 * tell a symbol from a coincidence, and it costs one pass over the box.
 */
export function darkRatio(grid: Grid, rect: Rect): number {
  const left = Math.max(0, Math.floor(rect.x));
  const top = Math.max(0, Math.floor(rect.y));
  const right = Math.min(grid.width, Math.ceil(rect.x + rect.w));
  const bottom = Math.min(grid.height, Math.ceil(rect.y + rect.h));
  if (right <= left || bottom <= top) return 0;

  let dark = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) dark += grid.dark[y * grid.width + x];
  }
  return dark / ((right - left) * (bottom - top));
}

/** A QR sits near half dark. Wide enough for glare at one end, print gain at the other. */
const DARK_RANGE = [0.2, 0.75] as const;

/** One pass at one scale. Null when this scale finds nothing believable. */
function locateAt(canvas: HTMLCanvasElement, scale: number): Rect | null {
  const width = Math.round(canvas.width * scale);
  const height = Math.round(canvas.height * scale);

  let source: HTMLCanvasElement = canvas;
  if (scale !== 1) {
    const bigger = document.createElement('canvas');
    bigger.width = width;
    bigger.height = height;
    const ctx = bigger.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, width, height);
    source = bigger;
  }

  const ctx = source.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const grid = binarise(ctx.getImageData(0, 0, width, height).data, width, height);
  const bounds = boundsFrom(findCentres(grid));
  if (!bounds) return null;

  const ratio = darkRatio(grid, bounds);
  if (ratio < DARK_RANGE[0] || ratio > DARK_RANGE[1]) return null;

  return {
    x: bounds.x / scale,
    y: bounds.y / scale,
    w: bounds.w / scale,
    h: bounds.h / scale,
  };
}

/**
 * Where the QR is, in canvas pixels, or null. Reads pixels; decodes nothing.
 *
 * Tried at more than one scale. The run-ratio test needs a module at least
 * MIN_MODULE pixels wide, and rows are sampled every third line, so a symbol
 * printed small — or a card cropped out of a larger photo and saved again at a
 * few hundred pixels — falls under both floors and is invisible to a single
 * pass. Enlarging the page interpolates no new detail, but it puts the module
 * width back above the threshold the scan can measure.
 */
export function locateQr(canvas: HTMLCanvasElement): Rect | null {
  for (const scale of scalesFor(Math.max(canvas.width, canvas.height))) {
    const found = locateAt(canvas, scale);
    if (found) return found;
  }
  return null;
}

/** Natural size first, then enlarged, and only for a page small enough to need it. */
export function scalesFor(longEdge: number): number[] {
  if (longEdge <= 0) return [1];
  if (longEdge >= 1600) return [1];
  return longEdge >= 800 ? [1, 2] : [1, 2, 3];
}
