/**
 * PAN detection.
 *
 * The format is rigid: five letters, four digits, one letter. That rigidity is
 * what makes it detectable, and it is also what lets us undo OCR's damage:
 * we know which positions *must* be letters and which *must* be digits, so an
 * "O" in position seven is a zero and a "0" in position two is an O. Reading
 * the character as printed and rejecting the word would fail on scans that a
 * human reads without effort (TRD §4.2).
 */

import { clampRect, newBox, type Box } from '../boxes.ts';
import type { Word } from '../ocr/worker.ts';
import { asDigit, asLetter, clean, pad, union } from './words.ts';

/**
 * The fourth character is the holder type. Anything outside this set is not a
 * PAN, which throws away most of the ten-character noise a page contains.
 */
const HOLDER_TYPES = new Set(['P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G']);

/** The word, coerced position by position, or null if it can't be a PAN. */
export function readPan(text: string): string | null {
  const raw = clean(text);
  if (raw.length !== 10) return null;

  const chars = [...raw];
  const coerced = chars.map((c, i) => (i < 5 || i === 9 ? asLetter(c) : asDigit(c))).join('');

  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(coerced)) return null;
  if (!HOLDER_TYPES.has(coerced[3])) return null;
  return coerced;
}

export function detectPan(words: Word[], width: number, height: number): Box[] {
  return words
    .filter((word) => readPan(word.text))
    .map((word) => newBox(clampRect(pad(union([word])), width, height), 'PAN', 'auto'));
}
