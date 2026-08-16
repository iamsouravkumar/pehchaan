/**
 * Aadhaar number detection.
 *
 * The number is printed as three groups of four, so OCR almost always returns
 * it as three separate words. We walk each line joining consecutive numeric
 * words until they add up to twelve digits, then judge the result.
 *
 * A group that fails the checksum is kept as a *suggestion*, not discarded.
 * The most common reason a real Aadhaar number fails Verhoeff is that OCR read
 * one digit wrong, exactly the case where the user still needs the box.
 * Recall beats precision here: an unwanted box costs one click, a missed number
 * costs everything the product promises (TRD §4.2).
 */

import { clampRect, newBox, type Box } from '../boxes.ts';
import type { Word } from '../ocr/worker.ts';
import { looksLikeAadhaar, verhoeff } from '../ocr/verhoeff.ts';
import { clean, digitsOf, lines, pad, union } from './words.ts';

const LENGTH = 12;
/** The virtual ID printed under the number on newer cards. */
const VID_LENGTH = 16;

/** Boxes in the coordinate space of the canvas the words were read from. */
export function detectAadhaar(words: Word[], width: number, height: number): Box[] {
  const found: Box[] = [];

  for (const line of lines(words)) {
    for (const run of numericRuns(line)) {
      // A VID is sixteen digits where the number is twelve, and it is printed
      // directly underneath in the same four-digit groups. Checked before the
      // twelve-digit scan, because otherwise the first three groups of a VID
      // look exactly like an Aadhaar number and the box lands over three
      // quarters of it, leaving the last four digits in the clear.
      const whole = digitsIn(run);
      if (whole.length === VID_LENGTH) {
        const rect = clampRect(pad(union(run)), width, height);
        found.push(newBox(rect, 'VID', verhoeff(whole) ? 'auto' : 'suggested'));
        continue;
      }
      found.push(...twelveIn(run, width, height));
    }
  }
  return found;
}

/** Maximal stretches of consecutive numeric words within one line. */
function numericRuns(line: Word[]): Word[][] {
  const runs: Word[][] = [];
  let current: Word[] = [];

  for (const word of line) {
    if (digitsOf(word.text)) current.push(word);
    else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

/** Every digit in a run, in order. */
function digitsIn(run: Word[]): string {
  return run.map((word) => digitsOf(word.text) ?? '').join('');
}

/** Aadhaar numbers found inside one numeric run. */
function twelveIn(words: Word[], width: number, height: number): Box[] {
  const found: Box[] = [];
  const digits = words.map((w) => digitsOf(w.text) ?? '');

  for (let start = 0; start < words.length; start++) {
    let text = '';
    // Extend the run one word at a time, stopping as soon as we are past twelve.
    for (let end = start; end < words.length; end++) {
      text += digits[end];
      if (text.length > LENGTH) break;
      if (text.length !== LENGTH) continue;

      const run = words.slice(start, end + 1);
      // An Aadhaar number never begins 0 or 1, which is a cheap way to throw
      // out other twelve-digit numbers, until OCR misreads that first digit on
      // a worn card and throws out the real thing with them. So the rule is
      // kept, and waived only where the first character was not a digit at all
      // before we mapped it, and the run is printed as three groups of four.
      // Nothing else on an ID card is laid out that way.
      if (!looksLikeAadhaar(text) && !(wasConfused(run[0]) && groupedFourFourFour(run))) continue;

      const rect = clampRect(pad(union(run)), width, height);
      found.push(newBox(rect, 'Aadhaar number', verhoeff(text) ? 'auto' : 'suggested'));
      start = end; // this run is spoken for; don't re-detect its tail
      break;
    }
  }
  return found;
}

/** Exactly three words of four digits each: how the number is printed. */
function groupedFourFourFour(run: Word[]): boolean {
  return run.length === 3 && run.every((word) => digitsOf(word.text)?.length === 4);
}

/** True when the word's first character only became a digit through mapping. */
function wasConfused(word: Word): boolean {
  return !/\d/.test(clean(word.text).slice(0, 1));
}
