/**
 * Runs every detector over one page and hands back a clean set of boxes.
 *
 * Detectors overlap by design — an address block contains a PIN, a labelled
 * number sits inside a line another rule also matched. Two boxes over the same
 * ink is not a second finding, it is one finding the user has to dismiss twice,
 * so overlaps collapse to whichever detector was more specific.
 */

import type { Box } from '../boxes.ts';
import type { Word } from '../ocr/worker.ts';
import { detectAadhaar } from './aadhaar.ts';
import { detectPan } from './pan.ts';
import { detectAddress, detectDates, detectLabelledNumbers } from './generic.ts';

/**
 * Order matters: earlier detectors win an overlap. Aadhaar and PAN are
 * checksum- or format-verified, so they outrank a heuristic that happened to
 * cover the same pixels.
 */
export function detectAll(
  words: Word[],
  width: number,
  height: number,
  /** Findings from detectors that don't read text — faces, today. */
  extra: Box[] = [],
): Box[] {
  const all = [
    ...detectAadhaar(words, width, height),
    ...detectPan(words, width, height),
    ...detectDates(words, width, height),
    ...detectLabelledNumbers(words, width, height),
    ...detectAddress(words, width, height),
    ...extra,
  ];

  const kept: Box[] = [];
  for (const box of all) {
    // An address block legitimately contains other findings, so it only loses
    // to a box that covers most of *it* — not to every field inside it.
    if (!kept.some((k) => covers(k, box) > 0.6)) kept.push(box);
  }
  return kept;
}

/** Fraction of `b` that sits inside `a`. */
function covers(a: Box, b: Box): number {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const area = b.w * b.h;
  return area > 0 ? (w * h) / area : 0;
}
