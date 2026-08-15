/**
 * Aadhaar number detection.
 *
 * The number is printed as three groups of four, so OCR almost always returns
 * it as three separate words. We walk each line joining consecutive numeric
 * words until they add up to twelve digits, then judge the result.
 *
 * A group that fails the checksum is kept as a *suggestion*, not discarded.
 * The most common reason a real Aadhaar number fails Verhoeff is that OCR read
 * one digit wrong — exactly the case where the user still needs the box.
 * Recall beats precision here: an unwanted box costs one click, a missed number
 * costs everything the product promises (TRD §4.2).
 */

import { clampRect, newBox, type Box } from '../boxes.ts';
import type { Word } from '../ocr/worker.ts';
import { looksLikeAadhaar, verhoeff } from '../ocr/verhoeff.ts';
import { digitsOf, lines, pad, union } from './words.ts';

const LENGTH = 12;

/** Boxes in the coordinate space of the canvas the words were read from. */
export function detectAadhaar(words: Word[], width: number, height: number): Box[] {
  const found: Box[] = [];

  for (const line of lines(words)) {
    const digits = line.map((w) => digitsOf(w.text));

    for (let start = 0; start < line.length; start++) {
      if (!digits[start]) continue;
      let text = '';
      // Extend the run one word at a time; stop at the first non-numeric word,
      // and stop as soon as we are past twelve digits.
      for (let end = start; end < line.length && digits[end]; end++) {
        text += digits[end];
        if (text.length > LENGTH) break;
        if (text.length !== LENGTH || !looksLikeAadhaar(text)) continue;

        const rect = clampRect(pad(union(line.slice(start, end + 1))), width, height);
        found.push(newBox(rect, 'Aadhaar number', verhoeff(text) ? 'auto' : 'suggested'));
        start = end; // this run is spoken for; don't re-detect its tail
        break;
      }
    }
  }
  return found;
}
